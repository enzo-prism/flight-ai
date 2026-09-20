import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRoute,
  routeHref,
  createRouter,
  DEFAULT_FILTERS,
} from "../demo/router.mjs";

test("public landing and retired routes safely normalize to Support priorities", () => {
  for (const hash of [
    "",
    "#agents",
    "#/settings/secrets",
    "#/support/nope",
    "#/sales/priorities/extra",
  ]) {
    assert.equal(routeHref(parseRoute(hash)), "#/support/priorities");
  }
  assert.equal(parseRoute("#/sales/overview").lens, "sales");
});

test("deep links roundtrip encoded search, filters, conversation, and finding", () => {
  const hash = routeHref(parseRoute("#/sales/priorities"), {
    filters: {
      q: "A & B + “reply”? <test>",
      status: "all",
      period: "previous",
    },
    conversationId: "sales-jordan",
    findingId: "sales-jordan-question",
  });
  const result = parseRoute(hash);
  assert.equal(result.filters.q, "A & B + “reply”? <test>");
  assert.equal(result.filters.status, "all");
  assert.equal(result.filters.period, "previous");
  assert.equal(result.conversationId, "sales-jordan");
  assert.equal(result.findingId, "sales-jordan-question");
  assert.equal(routeHref(result), hash);
  assert.equal(
    parseRoute(routeHref(result, { conversationId: null, findingId: null }))
      .conversationId,
    null,
  );
});

test("invalid query values are bounded and never become arbitrary route state", () => {
  const route = parseRoute(
    "#/support/priorities?status=sent&type=unknown&priority=urgent&conversation=%3Cscript%3E&finding=x&owner=bad%20owner&q=" +
      "x".repeat(400),
  );
  assert.equal(route.filters.status, DEFAULT_FILTERS.status);
  assert.equal(route.filters.type, "all");
  assert.equal(route.filters.owner, "all");
  assert.equal(
    parseRoute("#/support/priorities?owner=unknown-teammate").filters.owner,
    "all",
  );
  assert.equal(route.filters.q.length, 300);
  assert.equal(route.conversationId, null);
  assert.equal(route.findingId, null);
  assert.equal(
    parseRoute("#/support/overview?conversation=maya&finding=access")
      .conversationId,
    null,
  );
});

test("navigation emits once and supports history events, replace, and cleanup", () => {
  const previous = globalThis.window;
  const handlers = new Set();
  const calls = [];
  const location = { hash: "#legacy" };
  const history = {
    replaceState(_state, _title, hash) {
      location.hash = hash;
      calls.push(hash);
    },
  };
  globalThis.window = {
    location,
    history,
    addEventListener: (_event, handler) => handlers.add(handler),
    removeEventListener: (_event, handler) => handlers.delete(handler),
  };
  try {
    const changes = [];
    const router = createRouter({ onChange: (route) => changes.push(route) });
    assert.equal(location.hash, "#/support/priorities");
    assert.equal(changes.length, 0);
    router.navigate({ lens: "sales" });
    assert.equal(changes.length, 1);
    for (const handler of handlers) handler();
    assert.equal(changes.length, 1);
    router.navigate({ filters: { q: "Maya" } }, { replace: true });
    assert.equal(changes.length, 2);
    assert.match(calls.at(-1), /q=Maya/);
    location.hash = "#/support/priorities";
    for (const handler of handlers) handler();
    assert.equal(changes.length, 3);
    assert.equal(router.getRoute().filters.q, "");
    router.destroy();
    assert.equal(handlers.size, 0);
  } finally {
    globalThis.window = previous;
  }
});
