import test from "node:test";
import assert from "node:assert/strict";
import { createStore, STORAGE_KEY } from "../demo/state.mjs";
import { FINDINGS, TEAMMATES, SAMPLE_NOW } from "../demo/fixtures.mjs";

const id = "support-maya-access";
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("assignment persists without resolving; undo retains history and later draft edits", () => {
  const disk = storage();
  const store = createStore({ storage: disk });
  const before = store.getState().findings[id];
  assert.equal(
    store.update(id, { ownerId: TEAMMATES[0].id }, "Assigned to a teammate"),
    true,
  );
  assert.equal(store.getState().findings[id].status, before.status);
  assert.equal(
    createStore({ storage: disk }).getState().findings[id].ownerId,
    TEAMMATES[0].id,
  );
  let notified = 0;
  store.subscribe(() => notified++);
  store.saveDraft(id, "An edited draft with [confirmed instructions].");
  assert.equal(notified, 0);
  assert.equal(store.undo(), true);
  const after = store.getState().findings[id];
  assert.equal(after.ownerId, before.ownerId);
  assert.equal(after.draft, "An edited draft with [confirmed instructions].");
  assert.equal(after.activity.length, before.activity.length + 2);
  assert.equal(after.activity.at(-1).at, SAMPLE_NOW);
  assert.match(after.activity.at(-1).text, /^Undid:/);
  assert.equal(store.canUndo, false);
  assert.equal(store.undo(), false);
});

test("closing and reopening preserve outcome and activity while snapshots cannot mutate state", () => {
  const store = createStore({ storage: storage() });
  const before = store.getState().findings[id];
  store.update(
    id,
    {
      status: "handled",
      outcome: "Reviewed the source and recorded the next step.",
    },
    "Marked handled; customer success is unconfirmed.",
  );
  store.update(id, { status: "open" }, "Reopened for further review.");
  const after = store.getState().findings[id];
  assert.equal(after.status, "open");
  assert.equal(
    after.outcome,
    "Reviewed the source and recorded the next step.",
  );
  assert.equal(after.activity.length, before.activity.length + 2);
  after.status = "dismissed";
  assert.equal(store.getState().findings[id].status, "open");
});

test("invalid mutations cannot introduce users, statuses, HTML fields, or unknown findings", () => {
  const store = createStore({ storage: storage() });
  const before = store.getState();
  for (const patch of [
    { status: "sent" },
    { ownerId: "real-person" },
    { html: "<b>x</b>" },
    {},
    { activity: [] },
    { draft: 3 },
  ]) {
    assert.equal(store.update(id, patch, "Invalid"), false);
  }
  assert.equal(
    store.update("__proto__", { status: "handled" }, "Invalid"),
    false,
  );
  assert.equal(store.saveDraft("unknown", "draft"), false);
  assert.deepEqual(store.getState(), before);
});

test("malformed or obsolete storage restores usable sample and explains recovery", () => {
  for (const raw of [
    "{bad",
    "null",
    JSON.stringify({ version: 1, findings: {} }),
    JSON.stringify({ version: 2, findings: { unexpected: {} } }),
  ]) {
    const store = createStore({ storage: storage({ [STORAGE_KEY]: raw }) });
    assert.equal(
      Object.keys(store.getState().findings).length,
      FINDINGS.length,
    );
    assert.match(store.notice, /could not be read/);
    assert.equal(
      store.update(id, { status: "in-progress" }, "Started working"),
      true,
    );
  }
});

test("blocked reads and writes keep edits in memory and explain reload boundary", () => {
  const blocked = createStore({
    storage: {
      getItem() {
        throw new Error("blocked");
      },
    },
  });
  assert.match(blocked.notice, /may reset on reload/);
  assert.equal(
    blocked.update(id, { status: "in-progress" }, "Started working"),
    true,
  );
  assert.equal(blocked.getState().findings[id].status, "in-progress");
  const quota = createStore({
    storage: {
      getItem: () => null,
      setItem() {
        throw new Error("quota");
      },
    },
  });
  quota.saveDraft(id, "This remains in memory.");
  assert.equal(quota.getState().findings[id].draft, "This remains in memory.");
  assert.match(quota.notice, /may reset on reload/);
});

test("reset only removes new preview namespace, preserving unrelated and retired data", () => {
  const disk = storage({
    "mach1.v1.secret": "untouched",
    "another-app": "untouched",
  });
  const store = createStore({ storage: disk });
  store.update(
    id,
    { status: "dismissed", dismissReason: "Already answered elsewhere." },
    "Dismissed",
  );
  store.reset();
  assert.equal(disk.getItem(STORAGE_KEY), null);
  assert.equal(disk.getItem("mach1.v1.secret"), "untouched");
  assert.equal(disk.getItem("another-app"), "untouched");
  assert.equal(
    store.getState().findings[id].status,
    FINDINGS.find((finding) => finding.id === id).status,
  );
  assert.equal(store.canUndo, false);
});
