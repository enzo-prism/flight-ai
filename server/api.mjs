import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  createAuth,
  authSettings,
  appOrigin,
  sameOrigin,
  serviceReady,
} from "./auth.mjs";
import {
  createAdmin,
  result,
  workspaceFor,
  publicConnections,
  runFields,
} from "./db.mjs";
import {
  randomToken,
  hashToken,
  challenge,
  encrypt,
  decrypt,
  encryptionReady,
} from "./crypto.mjs";
import * as connectors from "./connectors.mjs";
import * as analysis from "./analysis.mjs";
const id = z.string().uuid(),
  email = z.string().email().max(254),
  password = z.string().min(12).max(128);
const credential = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
const provider = z.enum([
  "gmail",
  "microsoft",
  "hubspot",
  "zendesk",
  "intercom",
]);
const schemas = {
  "auth.signup": z.object({ email, password }).strict(),
  "auth.login": credential,
  "auth.oauth": z.object({ provider: z.enum(["google", "apple"]) }).strict(),
  "auth.sso": z
    .object({
      domain: z
        .string()
        .max(253)
        .regex(
          /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
        ),
    })
    .strict(),
  "auth.recover": z.object({ email }).strict(),
  "auth.password": z.object({ password }).strict(),
  workspace: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      lens: z.enum(["sales", "support"]).optional(),
    })
    .strict(),
  "connector.start": z
    .object({
      provider,
      config: z
        .object({
          subdomain: z
            .string()
            .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
            .optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  "connector.disconnect": z.object({ id }).strict(),
  scan: z.object({ connectionId: id }).strict(),
  "finding.update": z
    .object({
      id,
      status: z
        .enum(["open", "in-progress", "handled", "dismissed"])
        .optional(),
      owner: z.string().trim().max(120).nullable().optional(),
      draft: z.string().max(10000).optional(),
      outcome: z.string().trim().min(1).max(2000).optional(),
      dismissReason: z.string().trim().min(1).max(2000).optional(),
    })
    .strict(),
  "auth.logout": z.object({}).strict(),
};
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code, message) => {
  throw new HttpError(status, code, message);
};
export function validateBody(action, body) {
  const schema = schemas[action];
  if (!schema) fail(404, "not_found", "This action is not available.");
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    fail(400, "invalid_input", "Please check the information you entered.");
  return parsed.data;
}
export async function readBody(req) {
  if (
    !String(req.headers["content-type"] || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    fail(415, "content_type", "Use a JSON request.");
  if (Number(req.headers["content-length"] || 0) > 65536)
    fail(413, "too_large", "Request is too large.");
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += Buffer.byteLength(chunk);
      if (length > 65536) fail(413, "too_large", "Request is too large.");
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString();
  }
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body) > 65536)
      fail(413, "too_large", "Request is too large.");
    try {
      return JSON.parse(body.toString() || "{}");
    } catch {
      fail(400, "invalid_json", "Request is not valid JSON.");
    }
  }
  if (Buffer.byteLength(JSON.stringify(body || {})) > 65536)
    fail(413, "too_large", "Request is too large.");
  return body || {};
}
function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
function redirect(res, url) {
  res.statusCode = 303;
  res.setHeader("Location", url);
  res.end();
}
function requireAuthResult(value) {
  if (value.error)
    fail(
      400,
      "auth_failed",
      "Unable to complete authentication. Check your details or try again.",
    );
  return value.data;
}
export function createHandler(dependencies = {}) {
  const env = dependencies.env || process.env,
    makeAuth = dependencies.createAuth || createAuth,
    makeAdmin = dependencies.createAdmin || createAdmin,
    adapters = dependencies.connectors || connectors,
    evaluator = dependencies.analysis || analysis,
    settings = dependencies.authSettings || authSettings;
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Cookie, Origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    let action = "";
    try {
      const url = new URL(req.url, appOrigin(env));
      action = url.searchParams.get("action") || "";
      if (!["GET", "POST"].includes(req.method))
        fail(405, "method", "Method not allowed.");
      const getActions = [
        "config",
        "session",
        "workspace",
        "auth.callback",
        "connector.callback",
      ];
      if (req.method === "GET" && !getActions.includes(action))
        fail(405, "method", "This action requires POST.");
      if (
        req.method === "POST" &&
        ["config", "session", "auth.callback", "connector.callback"].includes(
          action,
        )
      )
        fail(405, "method", "This action requires GET.");
      if (req.method === "POST" && !sameOrigin(req, env))
        fail(403, "origin", "Request origin was not accepted.");
      if (action === "config") {
        const auth = await settings(env);
        return reply(res, 200, {
          auth,
          connectors: adapters.CONNECTORS.map((c) => ({
            ...c,
            ready: adapters.connectorReady(c.id, env) && encryptionReady(env),
          })),
          analysisReady: Boolean(env.AI_GATEWAY_API_KEY),
          serviceReady: serviceReady(env),
        });
      }
      if (!serviceReady(env))
        fail(
          503,
          "service_unavailable",
          "The workspace service is not configured yet.",
        );
      const auth = makeAuth(req, res, env);
      const body =
        req.method === "POST"
          ? validateBody(action, await readBody(req))
          : null;
      const callback = `${appOrigin(env)}/api/product?action=auth.callback`;
      if (action === "auth.signup") {
        const data = requireAuthResult(
          await auth.auth.signUp({
            ...body,
            options: { emailRedirectTo: callback },
          }),
        );
        return reply(res, 200, {
          ok: true,
          confirmationRequired: !data.session,
        });
      }
      if (action === "auth.login") {
        requireAuthResult(await auth.auth.signInWithPassword(body));
        return reply(res, 200, { ok: true });
      }
      if (action === "auth.oauth") {
        const available = await settings(env);
        if (!available[body.provider])
          fail(
            503,
            "provider_unavailable",
            "This sign-in provider has not been configured.",
          );
        const data = requireAuthResult(
          await auth.auth.signInWithOAuth({
            provider: body.provider,
            options: { redirectTo: callback, skipBrowserRedirect: true },
          }),
        );
        return reply(res, 200, { url: data.url });
      }
      if (action === "auth.sso") {
        const available = await settings(env);
        if (!available.sso)
          fail(
            503,
            "provider_unavailable",
            "SSO is not configured for this workspace.",
          );
        const data = requireAuthResult(
          await auth.auth.signInWithSSO({
            domain: body.domain,
            options: { redirectTo: callback, skipBrowserRedirect: true },
          }),
        );
        return reply(res, 200, { url: data.url });
      }
      if (action === "auth.recover") {
        // Always return the same public response to avoid account enumeration.
        await auth.auth.resetPasswordForEmail(body.email, {
          redirectTo: `${callback}&recovery=1`,
        });
        return reply(res, 200, { ok: true });
      }
      if (action === "auth.callback") {
        const code = url.searchParams.get("code");
        if (!code || code.length > 2048)
          fail(400, "auth_failed", "Sign-in could not be completed.");
        requireAuthResult(await auth.auth.exchangeCodeForSession(code));
        return redirect(
          res,
          `${appOrigin(env)}/app${url.searchParams.get("recovery") === "1" ? "?recovery=1" : ""}`,
        );
      }
      const verified = await auth.auth.getUser();
      const user = verified.error ? null : verified.data.user;
      if (action === "session" && !user)
        return reply(res, 200, {
          user: null,
          workspace: null,
          connections: [],
          onboarding: { step: "auth" },
        });
      if (!user) fail(401, "unauthorized", "Sign in to continue.");
      if (action === "auth.logout") {
        requireAuthResult(await auth.auth.signOut({ scope: "local" }));
        return reply(res, 200, { ok: true });
      }
      if (action === "auth.password") {
        requireAuthResult(await auth.auth.updateUser(body));
        return reply(res, 200, { ok: true });
      }
      const db = makeAdmin(env);
      let workspace = await workspaceFor(db, user.id);
      if (action === "workspace" && req.method === "POST") {
        if (workspace && Object.keys(body).length) {
          const updated = await result(
            db.rpc("product_update_workspace", {
              p_workspace: workspace.id,
              p_owner: user.id,
              p_patch: body,
            }),
          );
          if (!updated)
            fail(
              409,
              "role_locked",
              "The work type cannot change after analysis has started or while a scan is active.",
            );
          workspace = updated;
        } else if (!workspace) {
          workspace =
            (await result(
              db
                .from("product_workspaces")
                .upsert(
                  {
                    owner_id: user.id,
                    name: body.name || "My workspace",
                    lens: body.lens || null,
                  },
                  { onConflict: "owner_id", ignoreDuplicates: true },
                )
                .select("id,name,lens")
                .maybeSingle(),
            )) || (await workspaceFor(db, user.id));
        }
        return reply(res, 200, { ok: true, workspace });
      }
      if (action === "session") {
        const connections = workspace
          ? await publicConnections(db, workspace.id)
          : [];
        return reply(res, 200, {
          user: { id: user.id, email: user.email },
          workspace,
          connections,
          onboarding: {
            step: !workspace
              ? "connectors"
              : !workspace.lens
                ? "role"
                : "ready",
          },
        });
      }
      if (!workspace)
        fail(409, "workspace_required", "Create your workspace first.");
      if (action === "workspace") {
        const [connections, conversations, findings, runs] = await Promise.all([
          publicConnections(db, workspace.id),
          result(
            db
              .from("product_conversations")
              .select("*")
              .eq("workspace_id", workspace.id)
              .order("reviewed_at", { ascending: false })
              .limit(500),
          ),
          result(
            db
              .from("product_findings")
              .select("*")
              .eq("workspace_id", workspace.id)
              .order("created_at", { ascending: false })
              .limit(1000),
          ),
          result(
            db
              .from("product_runs")
              .select(runFields)
              .eq("workspace_id", workspace.id)
              .order("started_at", { ascending: false })
              .limit(50),
          ),
        ]);
        return reply(res, 200, {
          workspace,
          connections,
          conversations,
          findings,
          runs,
          coverage: {
            conversationLimit: 500,
            findingLimit: 1000,
            partial: conversations.length === 500 || findings.length === 1000,
          },
        });
      }
      if (action === "connector.start") {
        if (
          !adapters.connectorReady(body.provider, env) ||
          !encryptionReady(env)
        )
          fail(
            503,
            "connector_unavailable",
            "This connector has not been configured yet.",
          );
        const state = randomToken(),
          verifier = randomToken(),
          config = body.config || {};
        const authorization = adapters.authorizationUrl(
          body.provider,
          {
            redirectUri: `${appOrigin(env)}/api/product?action=connector.callback`,
            state,
            codeChallenge: challenge(verifier),
            config,
          },
          env,
        );
        await result(
          db.from("product_oauth_states").insert({
            state_hash: hashToken(state),
            user_id: user.id,
            workspace_id: workspace.id,
            provider: body.provider,
            config,
            verifier_encrypted: encrypt(
              verifier,
              `oauth:${user.id}:${hashToken(state)}`,
              env,
            ),
            expires_at: new Date(Date.now() + 600000).toISOString(),
          }),
        );
        return reply(res, 200, { url: authorization });
      }
      if (action === "connector.callback") {
        const state = url.searchParams.get("state"),
          code = url.searchParams.get("code");
        if (!state || state.length > 128 || !code || code.length > 4096)
          fail(400, "connector_failed", "Connection could not be completed.");
        // DELETE ... RETURNING consumes exactly once, and never consumes another user's state.
        const pending = await result(
          db
            .from("product_oauth_states")
            .delete()
            .eq("state_hash", hashToken(state))
            .eq("user_id", user.id)
            .eq("workspace_id", workspace.id)
            .gt("expires_at", new Date().toISOString())
            .select("*")
            .maybeSingle(),
        );
        if (!pending)
          fail(
            400,
            "connector_failed",
            "The connection request expired or was already used. Please try again.",
          );
        const tokens = await adapters.exchangeCode(
          pending.provider,
          {
            code,
            redirectUri: `${appOrigin(env)}/api/product?action=connector.callback`,
            codeVerifier: decrypt(
              pending.verifier_encrypted,
              `oauth:${user.id}:${hashToken(state)}`,
              env,
            ),
            config: pending.config,
          },
          env,
        );
        const label = String(tokens.accountLabel || pending.provider).slice(
          0,
          320,
        );
        const prior = await result(
          db
            .from("product_connections")
            .select("id,label,account_id")
            .eq("workspace_id", workspace.id)
            .eq("provider", pending.provider)
            .maybeSingle(),
        );
        if (
          !tokens.accountId ||
          (prior && prior.account_id !== tokens.accountId)
        )
          fail(
            409,
            "account_mismatch",
            "Reconnect the original source account to preserve its history.",
          );
        const connectionId = prior?.id || randomUUID();
        const connected = await result(
          db.rpc("product_connect", {
            p_workspace: workspace.id,
            p_owner: user.id,
            p_id: connectionId,
            p_provider: pending.provider,
            p_label: label,
            p_account: tokens.accountId,
            p_config: pending.config,
            p_encrypted: encrypt(
              tokens,
              `connection:${workspace.id}:${connectionId}`,
              env,
            ),
          }),
        );
        if (!connected)
          fail(
            409,
            "connection_busy",
            "A scan or another connection request is active. Please retry shortly.",
          );
        return redirect(res, `${appOrigin(env)}/app?connected=1`);
      }
      if (action === "connector.disconnect") {
        const connection = await scopedConnection(db, workspace.id, body.id);
        const disconnected = await result(
          db.rpc("product_disconnect", {
            p_workspace: workspace.id,
            p_owner: user.id,
            p_id: connection.id,
          }),
        );
        if (!disconnected)
          fail(
            409,
            "connection_busy",
            "A scan is active. Disconnect after the current batch finishes.",
          );
        return reply(res, 200, { ok: true });
      }
      if (action === "finding.update") {
        if (body.status === "handled" && !body.outcome)
          fail(
            400,
            "outcome_required",
            "Describe the outcome before marking this handled.",
          );
        if (body.status === "dismissed" && !body.dismissReason)
          fail(
            400,
            "reason_required",
            "Describe why this finding should be dismissed.",
          );
        const patch = { ...body };
        delete patch.id;
        if (patch.dismissReason) {
          patch.dismiss_reason = patch.dismissReason;
          delete patch.dismissReason;
        }
        const finding = await result(
          db.rpc("product_update_finding", {
            p_workspace: workspace.id,
            p_owner: user.id,
            p_id: body.id,
            p_patch: patch,
          }),
        );
        if (!finding) fail(404, "not_found", "Finding not found.");
        return reply(res, 200, { ok: true, finding });
      }
      if (action === "scan")
        return reply(
          res,
          200,
          await scan({
            db,
            env,
            workspace,
            user,
            connectionId: body.connectionId,
            adapters,
            evaluator,
          }),
        );
      fail(404, "not_found", "This action is not available.");
    } catch (error) {
      if (action.endsWith(".callback"))
        return redirect(
          res,
          `${appOrigin(env)}/app?error=${action === "auth.callback" ? "auth" : "connector"}`,
        );
      const safe = error instanceof HttpError;
      reply(res, safe ? error.status : 500, {
        error: {
          code: safe ? error.code : "service_error",
          message: safe
            ? error.message
            : "The request could not be completed. Please try again.",
        },
      });
    }
  };
}
async function scopedConnection(db, workspaceId, connectionId) {
  const c = await result(
    db
      .from("product_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  );
  if (!c) fail(404, "not_found", "Connection not found.");
  return c;
}
async function scan({
  db,
  env,
  workspace,
  user,
  connectionId,
  adapters,
  evaluator,
}) {
  if (!workspace.lens)
    fail(
      409,
      "role_required",
      "Choose Sales or Support before analyzing conversations.",
    );
  if (!env.AI_GATEWAY_API_KEY)
    fail(
      503,
      "analysis_unavailable",
      "Conversation analysis has not been configured yet.",
    );
  let connection = await scopedConnection(db, workspace.id, connectionId);
  if (connection.status !== "authorized")
    fail(409, "connection_required", "Reconnect this source before analyzing.");
  const lease = randomToken();
  const acquired = await result(
    db.rpc("product_acquire_scan", {
      p_workspace: workspace.id,
      p_owner: user.id,
      p_lease: lease,
    }),
  );
  if (!acquired)
    fail(409, "scan_running", "A scan is already running. Try again shortly.");
  let run = null,
    reviewed = 0,
    skipped = 0;
  try {
    // Re-read configuration only after acquiring the lease. Role changes and
    // reconnects now cannot race the configuration used for this batch.
    const currentWorkspace = await workspaceFor(db, user.id);
    workspace = { ...workspace, lens: currentWorkspace.lens };
    connection = await scopedConnection(db, workspace.id, connectionId);
    if (connection.status !== "authorized")
      throw new Error("Connection unavailable");
    // A killed worker leaves an honest failed run after the lease expires.
    await result(
      db
        .from("product_runs")
        .update({
          status: "failed",
          error: "The previous scan did not finish. Retry to continue.",
          finished_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspace.id)
        .eq("status", "running"),
    );
    run = await result(
      db
        .from("product_runs")
        .insert({
          workspace_id: workspace.id,
          connection_id: connection.id,
          status: "running",
        })
        .select("id")
        .single(),
    );
    const secret = await result(
      db
        .from("product_connector_secrets")
        .select("encrypted")
        .eq("connection_id", connection.id)
        .maybeSingle(),
    );
    if (!secret) throw new Error("Missing authorization");
    let token = decrypt(
      secret.encrypted,
      `connection:${workspace.id}:${connection.id}`,
      env,
    );
    if (
      token.expiresAt &&
      new Date(token.expiresAt).getTime() < Date.now() + 60000
    ) {
      if (!token.refreshToken)
        throw new HttpError(
          409,
          "reauthorize",
          "Reconnect this source to renew access.",
        );
      const refreshed = await adapters.refreshAccess(
        connection.provider,
        { refreshToken: token.refreshToken, config: connection.config },
        env,
      );
      token = {
        ...token,
        ...refreshed,
        refreshToken: refreshed.refreshToken || token.refreshToken,
      };
      await result(
        db
          .from("product_connector_secrets")
          .update({
            encrypted: encrypt(
              token,
              `connection:${workspace.id}:${connection.id}`,
              env,
            ),
          })
          .eq("connection_id", connection.id),
      );
    }
    const batch = await adapters.fetchConversations(connection.provider, {
      accessToken: token.accessToken,
      config: connection.config,
      cursor: connection.cursor,
      limit: 5,
    });
    if (
      !Array.isArray(batch.conversations) ||
      batch.conversations.length > 5 ||
      (batch.hasMore && !batch.nextCursor)
    )
      throw new Error("Invalid connector coverage");
    for (const source of batch.conversations) {
      const evaluated = await evaluator.evaluateConversation(
        source,
        workspace.lens,
        { apiKey: env.AI_GATEWAY_API_KEY },
      );
      if (evaluated.skipped === true) {
        skipped++;
        await result(
          db
            .from("product_runs")
            .update({ skipped_count: skipped })
            .eq("id", run.id)
            .eq("workspace_id", workspace.id),
        );
        continue;
      }
      await result(
        db.rpc("product_save_analysis", {
          p_workspace: workspace.id,
          p_owner: user.id,
          p_connection: connection.id,
          p_lease: lease,
          p_source: source,
          p_analysis: evaluated,
        }),
      );
      reviewed++;
      await result(
        db
          .from("product_runs")
          .update({ reviewed_count: reviewed })
          .eq("id", run.id)
          .eq("workspace_id", workspace.id),
      );
    }
    // Disconnect during a scan cannot restore authorization. Do not write tokens here.
    await result(
      db
        .from("product_connections")
        .update({
          cursor: batch.nextCursor || null,
          has_more: Boolean(batch.hasMore),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", connection.id)
        .eq("workspace_id", workspace.id)
        .eq("status", "authorized"),
    );
    const completed = await result(
      db
        .from("product_runs")
        .update({
          status: "completed",
          reviewed_count: reviewed,
          skipped_count: skipped,
          has_more: Boolean(batch.hasMore),
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .eq("workspace_id", workspace.id)
        .select(runFields)
        .single(),
    );
    return { ok: true, run: completed };
  } catch (error) {
    const safeCodes = {
      reauthorize: "Reconnect this source to renew access.",
      permission_denied: "The source did not grant the required read access.",
      rate_limited: "The source is rate limited. Try again later.",
      incomplete_history:
        "The source conversation history is incomplete. No partial history was analyzed.",
    };
    const message =
      safeCodes[error.code] ||
      "Scan stopped before completion. Your progress is saved; retry or reconnect the source.";
    if (error.code === "reauthorize" || error.code === "permission_denied")
      await result(
        db
          .from("product_connections")
          .update({ status: "error" })
          .eq("id", connection.id)
          .eq("workspace_id", workspace.id),
      );
    if (run)
      await result(
        db
          .from("product_runs")
          .update({
            status: "failed",
            reviewed_count: reviewed,
            skipped_count: skipped,
            has_more: true,
            error: message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", run.id)
          .eq("workspace_id", workspace.id),
      );
    fail(
      error.code === "reauthorize"
        ? 409
        : error.code === "rate_limited"
          ? 429
          : 502,
      safeCodes[error.code] ? error.code : "scan_failed",
      message,
    );
  } finally {
    await result(
      db
        .from("product_workspaces")
        .update({ scan_lock_until: null, scan_lease: null })
        .eq("id", workspace.id)
        .eq("owner_id", user.id)
        .eq("scan_lease", lease),
    );
  }
}
export default createHandler();
