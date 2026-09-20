// Run only against the configured development project. Every synthetic record rolls back.
import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
const url = new URL(
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
);
url.searchParams.delete("sslmode");
url.searchParams.delete("pgbouncer");
const db = new pg.Client({
  connectionString: url.toString(),
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(process.env.POSTGRES_CA_PATH, "utf8"),
  },
});
const a = randomUUID(),
  b = randomUUID(),
  wa = randomUUID(),
  wb = randomUUID(),
  connection = randomUUID();
try {
  await db.connect();
  await db.query("BEGIN");
  await db.query("INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)", [
    a,
    `test-${a}@example.invalid`,
    b,
    `test-${b}@example.invalid`,
  ]);
  await db.query(
    "INSERT INTO product_workspaces(id,owner_id,lens) VALUES ($1,$2,$3),($4,$5,$3)",
    [wa, a, "support", wb, b],
  );
  let r = await db.query(
    "SELECT product_connect($1,$2,$3,$4,$5,$6,$7,$8) AS ok",
    [
      wa,
      a,
      connection,
      "gmail",
      "Synthetic source",
      "account-a",
      "{}",
      "synthetic-encrypted",
    ],
  );
  assert.equal(r.rows[0].ok, true);
  r = await db.query("SELECT product_acquire_scan($1,$2,$3) AS ok", [
    wa,
    a,
    "test-lease",
  ]);
  assert.equal(r.rows[0].ok, true);
  r = await db.query("SELECT product_disconnect($1,$2,$3) AS ok", [
    wa,
    a,
    connection,
  ]);
  assert.equal(r.rows[0].ok, false);
  r = await db.query("SELECT product_update_workspace($1,$2,$3) AS value", [
    wa,
    a,
    JSON.stringify({ lens: "sales" }),
  ]);
  assert.equal(r.rows[0].value, null);
  const source = {
    externalId: "synthetic-thread",
    subject: "Access",
    customer: { name: "Synthetic Customer" },
    messages: [
      {
        id: "msg-1",
        sender: "Synthetic Customer",
        role: "customer",
        at: new Date().toISOString(),
        text: "How do I restore access?",
      },
    ],
  };
  const finding = {
    type: "unanswered",
    title: "Access question",
    summary: "Question in reviewed thread",
    reason: "Review evidence",
    priority: "attention",
    waitingSince: new Date().toISOString(),
    dueAt: null,
    evidence: [{ messageId: "msg-1", quote: "How do I restore access?" }],
    suggestion: "Review source",
    draft: "[Verified steps]",
  };
  r = await db.query("SELECT product_save_analysis($1,$2,$3,$4,$5,$6) AS id", [
    wa,
    a,
    connection,
    "test-lease",
    JSON.stringify(source),
    JSON.stringify({ findings: [finding], coverage: { truncated: false } }),
  ]);
  const cid = r.rows[0].id;
  const fr = await db.query(
    "SELECT id FROM product_findings WHERE conversation_id=$1",
    [cid],
  );
  const fid = fr.rows[0].id;
  await db.query("SELECT product_update_finding($1,$2,$3,$4)", [
    wa,
    a,
    fid,
    JSON.stringify({
      status: "handled",
      outcome: "Synthetic outcome",
      draft: "Edited draft",
    }),
  ]);
  await db.query("SELECT product_save_analysis($1,$2,$3,$4,$5,$6)", [
    wa,
    a,
    connection,
    "test-lease",
    JSON.stringify(source),
    JSON.stringify({ findings: [], coverage: { truncated: false } }),
  ]);
  r = await db.query(
    "SELECT status,outcome,draft,analysis_current FROM product_findings WHERE id=$1",
    [fid],
  );
  assert.deepEqual(r.rows[0], {
    status: "handled",
    outcome: "Synthetic outcome",
    draft: "Edited draft",
    analysis_current: false,
  });
  const save = async (nextSource, nextFinding) =>
    db.query("SELECT product_save_analysis($1,$2,$3,$4,$5,$6) AS id", [
      wa,
      a,
      connection,
      "test-lease",
      JSON.stringify(nextSource),
      JSON.stringify({
        findings: [nextFinding],
        coverage: { truncated: false },
      }),
    ]);
  const readFinding = async () =>
    (
      await db.query(
        "SELECT status,priority,outcome,draft,dismiss_reason,activity FROM product_findings WHERE id=$1",
        [fid],
      )
    ).rows[0];
  // Exact evidence and a different quote from an unchanged source preserve closure.
  await save(source, finding);
  assert.equal((await readFinding()).status, "handled");
  await save(source, {
    ...finding,
    evidence: [{ messageId: "msg-1", quote: "restore access?" }],
  });
  assert.equal((await readFinding()).status, "handled");
  const newSource = {
    ...source,
    messages: [
      ...source.messages,
      {
        id: "msg-2",
        sender: "Synthetic Customer",
        role: "customer",
        at: new Date().toISOString(),
        text: "Which email address should I use now?",
      },
    ],
  };
  const newFinding = {
    ...finding,
    evidence: [
      { messageId: "msg-2", quote: "Which email address should I use now?" },
    ],
  };
  await save(newSource, newFinding);
  let reopened = await readFinding();
  assert.equal(reopened.status, "open");
  assert.equal(reopened.priority, "review");
  assert.equal(reopened.outcome, "Synthetic outcome");
  assert.equal(reopened.draft, "Edited draft");
  assert.equal(reopened.activity.at(-1).action, "reopened_new_evidence");
  assert.equal(reopened.activity.at(-1).previous_status, "handled");
  assert.equal(reopened.activity.at(-1).previous_outcome, "Synthetic outcome");
  // Re-dismissal stays closed on identical evidence; genuinely new source data reopens.
  await db.query("SELECT product_update_finding($1,$2,$3,$4)", [
    wa,
    a,
    fid,
    JSON.stringify({
      status: "dismissed",
      dismiss_reason: "Already answered offline",
    }),
  ]);
  await save(newSource, newFinding);
  assert.equal((await readFinding()).status, "dismissed");
  const editedSource = {
    ...newSource,
    messages: newSource.messages.map((m) =>
      m.id === "msg-2"
        ? { ...m, text: "Which account should I use for my new team?" }
        : m,
    ),
  };
  await save(editedSource, {
    ...newFinding,
    evidence: [
      {
        messageId: "msg-2",
        quote: "Which account should I use for my new team?",
      },
    ],
  });
  reopened = await readFinding();
  assert.equal(reopened.status, "open");
  assert.equal(reopened.dismiss_reason, "Already answered offline");
  assert.equal(reopened.activity.at(-1).previous_status, "dismissed");
  assert.equal(
    reopened.activity.at(-1).previous_dismiss_reason,
    "Already answered offline",
  );
  // A skipped evaluation must never replace stored conversation state.
  r = await db.query("SELECT product_save_analysis($1,$2,$3,$4,$5,$6) AS id", [
    wa,
    a,
    connection,
    "test-lease",
    JSON.stringify({ ...source, subject: "Skipped content must not replace" }),
    JSON.stringify({ skipped: true, findings: [] }),
  ]);
  assert.equal(r.rows[0].id, null);
  r = await db.query("SELECT subject FROM product_conversations WHERE id=$1", [
    cid,
  ]);
  assert.equal(r.rows[0].subject, "Access");
  await db.query("SAVEPOINT atomiccheck");
  try {
    await db.query("SELECT product_save_analysis($1,$2,$3,$4,$5,$6)", [
      wa,
      a,
      connection,
      "test-lease",
      JSON.stringify({ ...source, subject: "Must roll back" }),
      JSON.stringify({ findings: [{ ...finding, priority: "invalid" }] }),
    ]);
    assert.fail("Invalid priority must fail");
  } catch {
    await db.query("ROLLBACK TO SAVEPOINT atomiccheck");
  }
  r = await db.query("SELECT subject FROM product_conversations WHERE id=$1", [
    cid,
  ]);
  assert.equal(r.rows[0].subject, "Access");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [b]);
  await db.query("SET LOCAL ROLE authenticated");
  r = await db.query("SELECT id FROM product_workspaces");
  assert.deepEqual(
    r.rows.map((x) => x.id),
    [wb],
  );
  r = await db.query("SELECT id FROM product_conversations");
  assert.equal(r.rowCount, 0);
  r = await db.query("SELECT id FROM product_findings");
  assert.equal(r.rowCount, 0);
  await db.query("SAVEPOINT secrettest");
  try {
    await db.query("SELECT * FROM product_connector_secrets");
    assert.fail("Secrets must be denied");
  } catch (err) {
    assert.equal(err.code, "42501");
    await db.query("ROLLBACK TO SAVEPOINT secrettest");
  }
  await db.query("RESET ROLE");
  await db.query("ROLLBACK");
  console.log(
    "PASS: live database transaction verifies RLS tenant isolation, secrets denied, scan locks, atomic analysis, skipped records, recurrence detection, stale flags, and preserved outcomes. All synthetic data rolled back.",
  );
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(
    "Database integration failed:",
    error.code || error.name,
    error instanceof assert.AssertionError ? error.message : "",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
