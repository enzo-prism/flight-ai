import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Execute the actual rendering/selector functions in isolation. Do not initialize
// browser handlers or bootstrap, so no credentials or network calls are involved.
const source = await readFile(
  new URL("../live-app.js", import.meta.url),
  "utf8",
);
const handlerStart = source.search(/root\.addEventListener\s*\(/);
assert.ok(handlerStart > 0, "UI function boundary must exist");
function ui() {
  const element = { innerHTML: "", focus() {} };
  const context = vm.createContext({
    document: { querySelector: () => element, activeElement: null },
    location: { hash: "#/page=priorities" },
    URL,
    URLSearchParams,
    Intl,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(source.slice(0, handlerStart), context);
  vm.runInContext(
    `config={connectors:[],analysisReady:true};session={workspace:{name:'Test',lens:'support'},user:{email:'test@example.test'},connections:[]};workspaceData={conversations:[],findings:[],runs:[]};`,
    context,
  );
  return {
    run: (expression) => vm.runInContext(expression, context),
    set: (value) => {
      context.fixture = value;
      vm.runInContext("workspaceData=fixture;", context);
    },
  };
}
const conversation = (id, name = "Maya") => ({
  id,
  subject: "Access question",
  customer: { name, company: "Example" },
  messages: [],
});
const finding = (id, conversationId, overrides = {}) => ({
  id,
  conversation_id: conversationId,
  type: "unanswered",
  priority: "attention",
  status: "open",
  analysis_current: true,
  title: "Question needs an answer",
  summary: "Review source",
  evidence: [],
  ...overrides,
});

test("overview metrics and pattern denominators use only loaded distinct conversations", () => {
  const page = ui();
  page.set({
    conversations: [conversation("a")],
    findings: [
      finding("a1", "a"),
      finding("a2", "a", { type: "repeat" }),
      finding("outside", "outside-loaded-page"),
    ],
    runs: [],
  });
  const html = page.run("overviewView()");
  assert.match(html, /1 of 1 reviewed conversations have open findings/);
  assert.doesNotMatch(html, /[23] of 1/);
  assert.match(html, /1 of 1 reviewed conversations have this open finding/);
  assert.equal(page.run("currentFindings().length"), 2);
});

test("reviewed metric searches conversations including those without findings", () => {
  const page = ui();
  page.set({
    conversations: [conversation("a", "Maya"), conversation("b", "Jordan")],
    findings: [finding("f", "a")],
    runs: [],
  });
  page.run(
    `location.hash='#/page=priorities&metric=reviewed';search='Jordan';`,
  );
  const html = page.run("prioritiesView()");
  assert.match(html, /data-conversation="b"/);
  assert.doesNotMatch(html, /data-conversation="a"/);
  assert.match(html, /Reviewed · No finding/);
  page.run(`search='no such customer';`);
  assert.doesNotMatch(page.run("prioritiesView()"), /data-conversation=/);
});

test("Open and In progress exclude stale analysis while All retains historical records", () => {
  const page = ui();
  page.set({
    conversations: [conversation("a")],
    findings: [
      finding("current", "a"),
      finding("old-open", "a", { analysis_current: false }),
      finding("old-working", "a", {
        analysis_current: false,
        status: "in-progress",
      }),
    ],
    runs: [],
  });
  page.run(`filter='open';`);
  assert.equal(
    page.run("JSON.stringify(currentFindings().map(f=>f.id))"),
    '["current"]',
  );
  page.run(`filter='in-progress';`);
  assert.equal(page.run("currentFindings().length"), 0);
  page.run(`filter='all';`);
  assert.equal(page.run("currentFindings().length"), 3);
});

test("original source links reject executable and non-web schemes", () => {
  const page = ui();
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//evil.test",
    "not a URL",
  ]) {
    assert.equal(page.run(`sourceLink(${JSON.stringify(value)})`), "");
  }
  const html = page.run(
    `sourceLink('https://support.example.test/ticket/1?a=1&b=2')`,
  );
  assert.match(
    html,
    /href="https:\/\/support.example.test\/ticket\/1\?a=1&amp;b=2"/,
  );
  assert.match(html, /rel="noopener noreferrer"/);
});

test("evidence renders original source safely and never inserts unmatched model quotes", () => {
  const page = ui();
  const html = page.run(
    `evidenceMessage({id:'m',sender:'<img src=x onerror=alert(1)>',at:'2026-09-19T12:00:00Z',text:'I need <help>.'},[{messageId:'m',quote:'<help>'},{messageId:'m',quote:'invented evidence'}])`,
  );
  assert.match(html, /<mark>&lt;help&gt;<\/mark>/);
  assert.doesNotMatch(html, /<img|invented evidence/);
  assert.match(html, /&lt;img/);
});
