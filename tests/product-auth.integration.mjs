// Creates only a random @example.invalid account, sends no email, and removes that exact account.
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const origin = process.env.PRODUCT_TEST_ORIGIN || "http://127.0.0.1:8093";
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Integration test requires explicit test-project credentials.",
  );
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const email = `mach1-integration-${randomUUID()}@example.invalid`,
  password = randomBytes(32).toString("base64url");
let id;
const jar = new Map();
async function request(action, body, extra = {}) {
  const response = await fetch(`${origin}/api/product?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0],
      index = pair.indexOf("=");
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return { response, data: await response.json() };
}
try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw new Error("Synthetic auth account creation failed.");
  id = created.data.user.id;
  let result = await request("workspace");
  assert.equal(result.response.status, 401);
  result = await request(
    "auth.login",
    { email, password },
    { Origin: "https://not-this-site.invalid" },
  );
  assert.equal(result.response.status, 403);
  result = await request("auth.login", { email, password });
  assert.equal(result.response.status, 200);
  assert.ok(
    result.response.headers.getSetCookie().some((c) => /HttpOnly/i.test(c)),
  );
  result = await request("session");
  assert.equal(result.data.user.id, id);
  assert.equal(result.data.workspace, null);
  result = await request("workspace", { name: "Integration test workspace" });
  assert.equal(result.response.status, 200);
  const wid = result.data.workspace.id;
  result = await request("workspace", { lens: "support" });
  assert.equal(result.data.workspace.id, wid);
  assert.equal(result.data.workspace.lens, "support");
  result = await request("workspace");
  assert.equal(result.data.conversations.length, 0);
  assert.equal(result.data.findings.length, 0);
  assert.equal(result.data.connections.length, 0);
  result = await request("connector.start", { provider: "gmail" });
  assert.equal(result.response.status, 503);
  result = await request("scan", { connectionId: randomUUID() });
  assert.equal(result.response.status, 503);
  result = await request("auth.logout", {});
  assert.equal(result.response.status, 200);
  result = await request("session");
  assert.equal(result.data.user, null);
  console.log(
    "PASS: actual Supabase sign-in, HTTPOnly session, CSRF rejection, private workspace persistence, no sample data, unavailable-service gates, and logout. No email/model/connector requests made.",
  );
} catch (error) {
  console.error(
    "Auth integration failed:",
    error instanceof assert.AssertionError
      ? error.message
      : "Service request failed",
  );
  process.exitCode = 1;
} finally {
  if (id) {
    const cleanup = await admin.auth.admin.deleteUser(id);
    if (cleanup.error) {
      console.error(
        "Synthetic account cleanup failed; inspect test-created account.",
      );
      process.exitCode = 1;
    } else
      console.log(
        "Removed exact synthetic test account and its test workspace.",
      );
  }
}
