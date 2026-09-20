import test from "node:test";
import assert from "node:assert/strict";
import {
  CONVERSATIONS,
  FINDINGS,
  SAMPLE_NOW,
  TEAMMATES,
} from "../demo/fixtures.mjs";
import {
  getRows,
  getFinding,
  getOverview,
  waitingLabel,
} from "../demo/selectors.mjs";
import { analyzeConversation } from "../demo/analysis.mjs";

test("fixtures have unique IDs, comparable periods and traceable chronological evidence", () => {
  assert.equal(
    new Set(CONVERSATIONS.map((c) => c.id)).size,
    CONVERSATIONS.length,
  );
  assert.equal(new Set(FINDINGS.map((f) => f.id)).size, FINDINGS.length);
  for (const lens of ["support", "sales"])
    for (const [period, count] of [
      ["current", 24],
      ["previous", 20],
    ])
      assert.equal(
        CONVERSATIONS.filter((c) => c.lens === lens && c.period === period)
          .length,
        count,
      );
  for (const c of CONVERSATIONS) {
    assert.ok(c.messages.length);
    assert.equal(new Set(c.messages.map((m) => m.id)).size, c.messages.length);
    c.messages.forEach((m, i) => {
      assert.ok(Date.parse(m.at) <= Date.parse(SAMPLE_NOW));
      if (i) assert.ok(Date.parse(c.messages[i - 1].at) <= Date.parse(m.at));
    });
  }
  for (const f of FINDINGS) {
    const c = CONVERSATIONS.find((c) => c.id === f.conversationId);
    assert.ok(c);
    assert.ok(f.evidence.length);
    assert.ok(!f.ownerId || TEAMMATES.some((t) => t.id === f.ownerId));
    for (const e of f.evidence)
      assert.ok(
        c.messages.find((m) => m.id === e.messageId)?.text.includes(e.quote),
      );
    assert.ok(Date.parse(f.waitingSince) <= Date.parse(SAMPLE_NOW));
    if (f.dueAt)
      assert.ok(f.evidence.some((e) => e.quote.includes("September 17")));
  }
});
test("first support journey and grouping obey the contract", () => {
  const rows = getRows("support");
  assert.equal(rows.length, 7);
  assert.equal(rows[0].conversation.id, "support-maya");
  assert.equal(rows[0].primary.id, "support-maya-access");
  assert.equal(waitingLabel(rows[0].primary.waitingSince), "3h");
  assert.equal(
    rows.filter((r) => r.conversation.id === "support-jon").length,
    1,
  );
  assert.equal(
    rows.find((r) => r.conversation.id === "support-jon").findings.length,
    2,
  );
  const unassigned = getRows("support", { owner: "unassigned" }).find(
    (r) => r.conversation.id === "support-jon",
  );
  assert.equal(unassigned.primary.id, "support-jon-owner");
  assert.ok(
    rows.findIndex((r) => r.conversation.id === "support-theo") <
      rows.findIndex((r) => r.conversation.id === "support-amara"),
  );
  assert.equal(rows.at(-1).primary.priority, "review");
});
test("all metric and pattern links enumerate exactly their underlying records", () => {
  for (const lens of ["support", "sales"]) {
    const overview = getOverview(lens);
    assert.equal(overview.reviewed, 24);
    assert.equal(overview.open, 7);
    for (const metric of overview.metrics)
      assert.equal(
        getRows(lens, metric.filters).length,
        metric.count,
        metric.label,
      );
    for (const pattern of overview.patterns)
      assert.equal(
        getRows(lens, pattern.filters).length,
        pattern.current,
        pattern.title,
      );
    assert.ok(
      getRows(lens, { metric: "reviewed" }).some((r) => r.primary === null),
    );
  }
  const p = getOverview("support").patterns[0];
  assert.deepEqual(
    [p.current, p.currentTotal, p.previous, p.previousTotal, p.open],
    [4, 24, 2, 20, 3],
  );
  assert.equal(getOverview("support").third, 1);
  assert.equal(getOverview("sales").third, 4);
});
test("state changes propagate through all derived counts without conflating assignment and resolution", () => {
  const assign = { findings: { "support-maya-access": { ownerId: "alex" } } };
  assert.equal(getOverview("support", assign).open, 7);
  assert.equal(
    getRows("support", { owner: "unassigned" }, assign).some(
      (r) => r.conversation.id === "support-maya",
    ),
    false,
  );
  const handled = {
    findings: { "support-maya-access": { status: "handled" } },
  };
  assert.equal(getOverview("support", handled).open, 6);
  assert.equal(getOverview("support", handled).patterns[0].open, 2);
  const oneOfTwo = {
    findings: { "support-jon-invitation": { status: "handled" } },
  };
  assert.equal(getOverview("support", oneOfTwo).open, 7);
  const both = {
    findings: {
      "support-jon-invitation": { status: "handled" },
      "support-jon-owner": { status: "dismissed" },
    },
  };
  assert.equal(getOverview("support", both).open, 6);
  assert.equal(
    getOverview("support", {
      findings: { "support-theo-update": { status: "handled" } },
    }).third,
    0,
  );
});
test("negative timing example is unflagged and still appears in reviewed records", () => {
  assert.equal(analyzeConversation("sales-ruby").length, 0);
  assert.equal(
    getRows("sales").some((r) => r.conversation.id === "sales-ruby"),
    false,
  );
  assert.equal(
    getRows("sales", { metric: "reviewed", q: "return next month" }).length,
    1,
  );
  assert.equal(
    getRows("sales", { metric: "reviewed", q: "return next month" })[0].primary,
    null,
  );
});
test("filter intersections preserve conversation grouping and matching primary", () => {
  const rows = getRows("sales", { owner: "alex", type: "unanswered" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].primary.id, "sales-omar-question");
  assert.equal(
    getRows("support", { status: "handled", tag: "access" }).length,
    1,
  );
  assert.equal(
    getRows("support", { period: "previous", status: "all", tag: "access" })
      .length,
    2,
  );
  assert.equal(
    getRows("support", { q: "no matching fictional customer" }).length,
    0,
  );
});
test("analysis returns isolated findings, and selectors preserve fixture data", () => {
  const output = analyzeConversation("support-maya");
  output[0].evidence[0].quote = "changed";
  assert.notEqual(
    analyzeConversation("support-maya")[0].evidence[0].quote,
    "changed",
  );
  assert.equal(getFinding("missing"), undefined);
  assert.equal(waitingLabel("bad"), "—");
});
