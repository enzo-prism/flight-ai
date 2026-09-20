import test from "node:test";
import assert from "node:assert/strict";
import { createHandler, validateBody, readBody } from "../server/api.mjs";
import {
  encrypt,
  decrypt,
  randomToken,
  hashToken,
  challenge,
} from "../server/crypto.mjs";
import { authSettings, sameOrigin, createAuth } from "../server/auth.mjs";
import { readFile } from "node:fs/promises";
const env = {
  SUPABASE_URL: "https://project.example",
  SUPABASE_ANON_KEY: "public-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
  APP_ORIGIN: "https://mach.example",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  NODE_ENV: "production",
};
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "test@example.com",
};
const workspace = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Team",
  lens: "support",
};
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
    end(value = "") {
      this.body = value;
    },
  };
}
function authStub({ authenticated = true } = {}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? user : null },
        error: null,
      }),
      signInWithPassword: async () => ({
        data: {},
        error: { message: "private upstream secret" },
      }),
    },
  };
}
function dbStub(handler) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [], operation: "select" };
      calls.push(call);
      const q = {
        select(fields) {
          call.fields = fields;
          return q;
        },
        eq(k, v) {
          call.filters.push([k, v]);
          return q;
        },
        gt(k, v) {
          call.filters.push([k, v]);
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        maybeSingle() {
          call.single = true;
          return q;
        },
        single() {
          call.single = true;
          return q;
        },
        delete() {
          call.operation = "delete";
          return q;
        },
        update(patch) {
          call.operation = "update";
          call.patch = patch;
          return q;
        },
        insert(patch) {
          call.operation = "insert";
          call.patch = patch;
          return q;
        },
        upsert(patch) {
          call.operation = "upsert";
          call.patch = patch;
          return q;
        },
        then(resolve, reject) {
          return Promise.resolve(handler(call)).then(
            (data) => resolve({ data, error: null }),
            reject,
          );
        },
      };
      return q;
    },
    rpc(name, args) {
      calls.push({ rpc: name, args });
      return Promise.resolve({
        data: handler({ rpc: name, args }),
        error: null,
      });
    },
  };
}
async function request(
  handler,
  action,
  { method = "GET", body, origin = env.APP_ORIGIN, query = "" } = {},
) {
  const res = response();
  await handler(
    {
      method,
      url: `/api/product?action=${action}${query}`,
      headers: { origin, "content-type": "application/json" },
      body,
    },
    res,
  );
  return { ...res, json: res.body ? JSON.parse(res.body) : null };
}
const adapters = {
  CONNECTORS: [{ id: "gmail", name: "Gmail" }],
  connectorReady: () => false,
};
function handler(overrides = {}) {
  return createHandler({
    env,
    createAuth: () => authStub(),
    connectors: adapters,
    authSettings: async () => ({
      email: true,
      google: false,
      apple: false,
      sso: false,
    }),
    ...overrides,
  });
}
test("AES-GCM authenticates ciphertext and tenant context", () => {
  const secret = { accessToken: "only-test-token" };
  const data = encrypt(secret, "tenant:a", env);
  assert.deepEqual(decrypt(data, "tenant:a", env), secret);
  assert.throws(() => decrypt(data, "tenant:b", env));
  const parts = data.split(".");
  parts[3] = (parts[3][0] === "a" ? "b" : "a") + parts[3].slice(1);
  assert.throws(() => decrypt(parts.join("."), "tenant:a", env));
  assert.equal(randomToken().length, 43);
  assert.equal(hashToken("same"), hashToken("same"));
  assert.equal(challenge("same").length, 43);
});
test("CSRF requires exact origin and rejects cross-site metadata", async () => {
  assert.equal(
    sameOrigin({ headers: { origin: "https://mach.example.evil" } }, env),
    false,
  );
  assert.equal(
    sameOrigin(
      { headers: { origin: env.APP_ORIGIN, "sec-fetch-site": "cross-site" } },
      env,
    ),
    false,
  );
  const res = await request(handler(), "auth.login", {
    method: "POST",
    body: { email: "test@example.com", password: "password" },
    origin: "https://evil.example",
  });
  assert.equal(res.statusCode, 403);
});
test("private API uses verified getUser and does not create admin without user", async () => {
  let admin = false;
  const res = await request(
    handler({
      createAuth: () => authStub({ authenticated: false }),
      createAdmin: () => {
        admin = true;
        throw new Error();
      },
    }),
    "workspace",
  );
  assert.equal(res.statusCode, 401);
  assert.equal(admin, false);
});
test("anonymous session is truthful and no-store", async () => {
  const res = await request(
    handler({ createAuth: () => authStub({ authenticated: false }) }),
    "session",
  );
  assert.equal(res.json.user, null);
  assert.equal(res.json.onboarding.step, "auth");
  assert.match(res.headers["Cache-Control"], /no-store/);
});
test("upstream errors never expose credentials or internals", async () => {
  const res = await request(handler(), "auth.login", {
    method: "POST",
    body: { email: "test@example.com", password: "password" },
  });
  assert.equal(res.statusCode, 400);
  assert.doesNotMatch(res.body, /private upstream secret/);
});
test("validates closed outcomes, IDs, strict inputs and password strength", () => {
  assert.throws(() =>
    validateBody("auth.signup", { email: "a@example.com", password: "short" }),
  );
  assert.throws(() => validateBody("connector.disconnect", { id: "not-uuid" }));
  assert.throws(() =>
    validateBody("connector.start", {
      provider: "zendesk",
      config: { subdomain: "https://evil.example" },
    }),
  );
  assert.throws(() => validateBody("workspace", { owner_id: user.id }));
  assert.equal(validateBody("workspace", { lens: "sales" }).lens, "sales");
});
test("body limit rejects both parsed and streamed oversized requests", async () => {
  await assert.rejects(
    () =>
      readBody({
        headers: { "content-type": "application/json" },
        body: { data: "x".repeat(65537) },
      }),
    (e) => e.status === 413,
  );
  const req = {
    headers: { "content-type": "application/json" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(65537);
    },
  };
  await assert.rejects(
    () => readBody(req),
    (e) => e.status === 413,
  );
});
test("disabled OAuth provider never returns a pretend auth URL", async () => {
  const res = await request(handler(), "auth.oauth", {
    method: "POST",
    body: { provider: "google" },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(res.json.url, undefined);
});
test("auth settings fails closed on unavailable provider configuration", async () => {
  const settings = await authSettings(env, async () => {
    throw new Error("network");
  });
  assert.equal(settings.verified, false);
  assert.equal(settings.email, false);
});
test("all workspace data queries are tenant scoped and connection secrets are omitted", async () => {
  const db = dbStub((call) =>
    call.table === "product_workspaces" ? workspace : [],
  );
  const res = await request(handler({ createAdmin: () => db }), "workspace");
  assert.equal(res.statusCode, 200);
  for (const call of db.calls.filter((c) => c.table !== "product_workspaces"))
    assert.ok(
      call.filters.some(([k, v]) => k === "workspace_id" && v === workspace.id),
    );
  assert.ok(
    db.calls
      .find((c) => c.table === "product_workspaces")
      .filters.some(([k, v]) => k === "owner_id" && v === user.id),
  );
  assert.doesNotMatch(
    db.calls.find((c) => c.table === "product_connections").fields,
    /config|cursor|encrypted/,
  );
});
test("foreign connection IDs cannot disconnect another tenant", async () => {
  const db = dbStub((call) =>
    call.table === "product_workspaces" ? workspace : null,
  );
  const res = await request(
    handler({ createAdmin: () => db }),
    "connector.disconnect",
    { method: "POST", body: { id: "33333333-3333-4333-8333-333333333333" } },
  );
  assert.equal(res.statusCode, 404);
  assert.equal(
    db.calls.some((c) => c.operation === "delete"),
    false,
  );
});
test("finding outcome is required before any mutation", async () => {
  const db = dbStub(() => workspace);
  const res = await request(
    handler({ createAdmin: () => db }),
    "finding.update",
    {
      method: "POST",
      body: { id: "33333333-3333-4333-8333-333333333333", status: "handled" },
    },
  );
  assert.equal(res.statusCode, 400);
  assert.equal(
    db.calls.some((c) => c.rpc),
    false,
  );
});
test("finding update atomically binds owner/workspace and preserves draft in RPC", async () => {
  const db = dbStub((call) =>
    call.rpc ? { id: "f", status: "handled" } : workspace,
  );
  const res = await request(
    handler({ createAdmin: () => db }),
    "finding.update",
    {
      method: "POST",
      body: {
        id: "33333333-3333-4333-8333-333333333333",
        status: "handled",
        outcome: "Called customer",
      },
    },
  );
  assert.equal(res.statusCode, 200);
  const call = db.calls.find((c) => c.rpc);
  assert.equal(call.args.p_owner, user.id);
  assert.equal(call.args.p_workspace, workspace.id);
  assert.equal(call.args.p_patch.outcome, "Called customer");
});
test("OAuth state consumption binds user/workspace and expiry, rejecting replay before exchange", async () => {
  let exchanges = 0;
  const db = dbStub((call) =>
    call.table === "product_workspaces" ? workspace : null,
  );
  const res = await request(
    handler({
      createAdmin: () => db,
      connectors: {
        ...adapters,
        exchangeCode: async () => {
          exchanges++;
        },
      },
    }),
    "connector.callback",
    { query: "&state=old&code=code" },
  );
  assert.equal(res.statusCode, 303);
  assert.match(res.headers.Location, /error=connector/);
  assert.equal(exchanges, 0);
  const consume = db.calls.find((c) => c.table === "product_oauth_states");
  assert.equal(consume.operation, "delete");
  assert.ok(consume.filters.some(([k, v]) => k === "user_id" && v === user.id));
  assert.ok(consume.filters.some(([k]) => k === "expires_at"));
});
test("scan cannot run without configured model key", async () => {
  const db = dbStub(() => workspace);
  const res = await request(handler({ createAdmin: () => db }), "scan", {
    method: "POST",
    body: { connectionId: "33333333-3333-4333-8333-333333333333" },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(
    db.calls.some((c) => c.rpc),
    false,
  );
});
test("migration enables RLS on every product table and denies token/state user access", async () => {
  const sql = await readFile(
    new URL("../db/001_product.sql", import.meta.url),
    "utf8",
  );
  const tables = [
    ...sql.matchAll(/create table if not exists public\.(\w+)/g),
  ].map((m) => m[1]);
  for (const table of tables)
    assert.ok(
      sql.includes(`alter table public.${table} enable row level security;`),
    );
  assert.doesNotMatch(
    sql,
    /grant select[^;]*product_connector_secrets[^;]*to authenticated/,
  );
  assert.match(sql, /for update/);
  assert.match(sql, /revoke all on function public\.product_acquire_scan/);
});
test("scan persists actual progress and coverage, preserving previous draft and outcome", async () => {
  const connection = {
    id: "33333333-3333-4333-8333-333333333333",
    provider: "gmail",
    status: "authorized",
    config: {},
    cursor: "next",
  };
  const runId = "44444444-4444-4444-8444-444444444444";
  const db = dbStub((call) => {
    if (call.rpc === "product_acquire_scan") return true;
    if (call.table === "product_workspaces") return workspace;
    if (call.table === "product_connections") return connection;
    if (call.table === "product_connector_secrets")
      return {
        encrypted: encrypt(
          { accessToken: "mock-token" },
          `connection:${workspace.id}:${connection.id}`,
          env,
        ),
      };
    if (call.table === "product_runs") return { id: runId, ...call.patch };
    if (call.table === "product_conversations")
      return { id: "conversation-id" };
    if (call.table === "product_findings")
      return call.operation === "select" ? { id: "existing-finding" } : null;
  });
  let evaluations = 0;
  const res = await request(
    handler({
      env: { ...env, AI_GATEWAY_API_KEY: "mock-only" },
      createAdmin: () => db,
      connectors: {
        ...adapters,
        fetchConversations: async (_, { cursor, limit }) => {
          assert.equal(cursor, "next");
          assert.equal(limit, 5);
          return {
            conversations: [
              {
                externalId: "a",
                subject: "Example",
                customer: {},
                messages: [],
              },
            ],
            nextCursor: "next2",
            hasMore: true,
          };
        },
      },
      analysis: {
        evaluateConversation: async () => {
          evaluations++;
          return {
            coverage: { truncated: true },
            findings: [
              {
                type: "unanswered",
                title: "Question",
                summary: "Summary",
                reason: "Reason",
                priority: "review",
                evidence: [],
                suggestion: "Review",
                draft: "New suggested draft",
              },
            ],
          };
        },
      },
    }),
    "scan",
    { method: "POST", body: { connectionId: connection.id } },
  );
  assert.equal(res.statusCode, 200);
  assert.equal(evaluations, 1);
  assert.equal(res.json.run.reviewed_count, 1);
  assert.equal(res.json.run.has_more, true);
  const saved = db.calls.find((c) => c.rpc === "product_save_analysis");
  assert.equal(saved.args.p_workspace, workspace.id);
  assert.equal(saved.args.p_owner, user.id);
  assert.deepEqual(saved.args.p_analysis.coverage, { truncated: true });
  assert.ok(saved.args.p_lease);
  const sql = await readFile(
    new URL("../db/002_product.sql", import.meta.url),
    "utf8",
  );
  const clause = sql
    .split("on conflict(conversation_id,type) do update set")[1]
    .split(";")[0];
  assert.doesNotMatch(clause, /draft=|outcome=|dismiss_reason=/);
  const unlock = db.calls.find(
    (c) => c.table === "product_workspaces" && c.operation === "update",
  );
  assert.ok(unlock.filters.some(([k]) => k === "scan_lease"));
});
test("scan lock prevents model/provider calls in another concurrent request", async () => {
  let calls = 0;
  const connection = {
    id: "33333333-3333-4333-8333-333333333333",
    status: "authorized",
  };
  const db = dbStub((c) =>
    c.rpc ? false : c.table === "product_workspaces" ? workspace : connection,
  );
  const res = await request(
    handler({
      env: { ...env, AI_GATEWAY_API_KEY: "mock-only" },
      createAdmin: () => db,
      connectors: {
        ...adapters,
        fetchConversations: async () => {
          calls++;
        },
      },
    }),
    "scan",
    { method: "POST", body: { connectionId: connection.id } },
  );
  assert.equal(res.statusCode, 409);
  assert.equal(calls, 0);
});
test("failed scans retain reviewed count and never advance the source cursor", async () => {
  const connection = {
    id: "33333333-3333-4333-8333-333333333333",
    status: "authorized",
    provider: "gmail",
    config: {},
  };
  const db = dbStub((c) =>
    c.rpc
      ? true
      : c.table === "product_workspaces"
        ? workspace
        : c.table === "product_connections"
          ? connection
          : c.table === "product_connector_secrets"
            ? {
                encrypted: encrypt(
                  { accessToken: "test" },
                  `connection:${workspace.id}:${connection.id}`,
                  env,
                ),
              }
            : c.table === "product_runs"
              ? { id: "run" }
              : null,
  );
  const res = await request(
    handler({
      env: { ...env, AI_GATEWAY_API_KEY: "mock-only" },
      createAdmin: () => db,
      connectors: {
        ...adapters,
        fetchConversations: async () => {
          throw new Error("private PII and token");
        },
      },
    }),
    "scan",
    { method: "POST", body: { connectionId: connection.id } },
  );
  assert.equal(res.statusCode, 502);
  assert.doesNotMatch(res.body, /private PII/);
  assert.equal(
    db.calls.some(
      (c) => c.table === "product_connections" && c.operation === "update",
    ),
    false,
  );
  assert.ok(
    db.calls.some(
      (c) => c.patch?.status === "failed" && c.patch.reviewed_count === 0,
    ),
  );
});
test("OAuth callback atomically connects a verified account and never exposes tokens", async () => {
  const state = "new-state",
    connectionId = "33333333-3333-4333-8333-333333333333";
  const pending = {
    provider: "gmail",
    config: {},
    verifier_encrypted: encrypt(
      "verifier",
      `oauth:${user.id}:${hashToken(state)}`,
      env,
    ),
  };
  const db = dbStub((c) =>
    c.rpc
      ? true
      : c.table === "product_workspaces"
        ? workspace
        : c.table === "product_oauth_states"
          ? pending
          : { id: connectionId, account_id: "mailbox-id", label: "old label" },
  );
  const res = await request(
    handler({
      createAdmin: () => db,
      connectors: {
        ...adapters,
        exchangeCode: async () => ({
          accountId: "mailbox-id",
          accountLabel: "New label",
          accessToken: "never-public",
        }),
      },
    }),
    "connector.callback",
    { query: `&state=${state}&code=test-code` },
  );
  assert.equal(res.statusCode, 303);
  assert.match(res.headers.Location, /connected=1/);
  assert.doesNotMatch(JSON.stringify(res), /never-public/);
  const rpc = db.calls.find((c) => c.rpc === "product_connect");
  assert.equal(rpc.args.p_account, "mailbox-id");
  assert.equal(rpc.args.p_id, connectionId);
  assert.equal(
    decrypt(
      rpc.args.p_encrypted,
      `connection:${workspace.id}:${connectionId}`,
      env,
    ).accessToken,
    "never-public",
  );
  assert.equal(
    db.calls.some((c) => c.operation === "upsert"),
    false,
  );
});
test("OAuth callback rejects different stable account identity even with identical label", async () => {
  const state = "same-label",
    pending = {
      provider: "gmail",
      config: {},
      verifier_encrypted: encrypt(
        "verifier",
        `oauth:${user.id}:${hashToken(state)}`,
        env,
      ),
    };
  const db = dbStub((c) =>
    c.table === "product_workspaces"
      ? workspace
      : c.table === "product_oauth_states"
        ? pending
        : {
            id: "previous-id",
            account_id: "first-account",
            label: "Same name",
          },
  );
  const res = await request(
    handler({
      createAdmin: () => db,
      connectors: {
        ...adapters,
        exchangeCode: async () => ({
          accountId: "second-account",
          accountLabel: "Same name",
          accessToken: "test",
        }),
      },
    }),
    "connector.callback",
    { query: `&state=${state}&code=test-code` },
  );
  assert.match(res.headers.Location, /error=connector/);
  assert.equal(
    db.calls.some((c) => c.rpc === "product_connect"),
    false,
  );
});
test("disconnect respects active scan guard and preserves stored authorization on refusal", async () => {
  const db = dbStub((c) =>
    c.rpc
      ? false
      : c.table === "product_workspaces"
        ? workspace
        : { id: "33333333-3333-4333-8333-333333333333" },
  );
  const res = await request(
    handler({ createAdmin: () => db }),
    "connector.disconnect",
    { method: "POST", body: { id: "33333333-3333-4333-8333-333333333333" } },
  );
  assert.equal(res.statusCode, 409);
  assert.equal(
    db.calls.some((c) => c.operation === "delete"),
    false,
  );
  assert.equal(db.calls.find((c) => c.rpc)?.rpc, "product_disconnect");
});
test("workspace role mutation is guarded atomically by the database", async () => {
  const db = dbStub((c) => (c.rpc ? null : workspace));
  const res = await request(handler({ createAdmin: () => db }), "workspace", {
    method: "POST",
    body: { lens: "sales" },
  });
  assert.equal(res.statusCode, 409);
  assert.equal(db.calls.find((c) => c.rpc)?.rpc, "product_update_workspace");
});

test("Unicode drafts fit the bounded JSON body and retain field length validation", async () => {
  const body = {
    id: "33333333-3333-4333-8333-333333333333",
    draft: "界".repeat(10000),
  };
  const parsed = await readBody({
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(validateBody("finding.update", parsed).draft.length, 10000);
  assert.throws(() =>
    validateBody("finding.update", { ...body, draft: "界".repeat(10001) }),
  );
  await assert.rejects(
    () =>
      readBody({
        headers: {
          "content-type": "application/json",
          "content-length": "65537",
        },
        body: {},
      }),
    (error) => error.status === 413,
  );
});
test("expired credentials without refresh mark source for reauthorization before any provider or model call", async () => {
  const connection = {
    id: "33333333-3333-4333-8333-333333333333",
    provider: "gmail",
    status: "authorized",
    config: {},
  };
  const db = dbStub((c) =>
    c.rpc
      ? true
      : c.table === "product_workspaces"
        ? workspace
        : c.table === "product_connections"
          ? connection
          : c.table === "product_connector_secrets"
            ? {
                encrypted: encrypt(
                  {
                    accessToken: "expired-test-token",
                    expiresAt: "2020-01-01T00:00:00Z",
                  },
                  `connection:${workspace.id}:${connection.id}`,
                  env,
                ),
              }
            : c.table === "product_runs"
              ? { id: "run" }
              : null,
  );
  let calls = 0;
  const forbidden = async () => {
    calls++;
    throw new Error("Unexpected provider/model call");
  };
  const res = await request(
    handler({
      env: { ...env, AI_GATEWAY_API_KEY: "mock-only" },
      createAdmin: () => db,
      connectors: {
        ...adapters,
        refreshAccess: forbidden,
        fetchConversations: forbidden,
      },
      analysis: { evaluateConversation: forbidden },
    }),
    "scan",
    { method: "POST", body: { connectionId: connection.id } },
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.json.error.code, "reauthorize");
  assert.match(res.json.error.message, /Reconnect/);
  assert.equal(calls, 0);
  assert.ok(
    db.calls.some(
      (c) =>
        c.table === "product_connections" &&
        c.patch?.status === "error" &&
        c.filters.some(
          ([key, value]) => key === "workspace_id" && value === workspace.id,
        ),
    ),
  );
  assert.ok(
    db.calls.some(
      (c) =>
        c.table === "product_runs" &&
        c.patch?.status === "failed" &&
        c.patch.reviewed_count === 0,
    ),
  );
  assert.ok(
    db.calls.some(
      (c) =>
        c.table === "product_workspaces" && c.patch?.scan_lock_until === null,
    ),
  );
});

test("skipped evaluations advance source coverage without overwriting records or inflating reviewed counts", async () => {
  const connection = {
    id: "33333333-3333-4333-8333-333333333333",
    provider: "gmail",
    status: "authorized",
    config: {},
  };
  const db = dbStub((c) =>
    c.rpc
      ? true
      : c.table === "product_workspaces"
        ? workspace
        : c.table === "product_connections"
          ? connection
          : c.table === "product_connector_secrets"
            ? {
                encrypted: encrypt(
                  { accessToken: "test" },
                  `connection:${workspace.id}:${connection.id}`,
                  env,
                ),
              }
            : c.table === "product_runs"
              ? { id: "run", ...c.patch }
              : null,
  );
  const res = await request(
    handler({
      env: { ...env, AI_GATEWAY_API_KEY: "mock-only" },
      createAdmin: () => db,
      connectors: {
        ...adapters,
        fetchConversations: async () => ({
          conversations: [
            {
              externalId: "empty",
              subject: "Empty",
              customer: {},
              messages: [],
            },
          ],
          nextCursor: "next",
          hasMore: true,
        }),
      },
      analysis: {
        evaluateConversation: async () => ({
          skipped: true,
          skipReason: "no_eligible_messages",
          findings: [],
          coverage: { analyzedMessages: 0 },
        }),
      },
    }),
    "scan",
    { method: "POST", body: { connectionId: connection.id } },
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.run.reviewed_count, 0);
  assert.equal(res.json.run.skipped_count, 1);
  assert.equal(
    db.calls.some((c) => c.rpc === "product_save_analysis"),
    false,
  );
  assert.ok(
    db.calls.some(
      (c) => c.table === "product_connections" && c.patch?.cursor === "next",
    ),
  );
});
