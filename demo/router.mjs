import { TEAMMATES } from "./fixtures.mjs";

export const DEFAULT_FILTERS = Object.freeze({
  status: "active",
  owner: "all",
  q: "",
  type: "all",
  priority: "all",
  period: "current",
  tag: "all",
  metric: "all",
});
const choices = {
  status: ["active", "open", "in-progress", "handled", "dismissed", "all"],
  type: ["all", "unanswered", "promise", "repeat", "handoff", "objection"],
  priority: ["all", "high", "attention", "review"],
  period: ["current", "previous"],
  metric: ["all", "reviewed", "open", "overdue", "unanswered"],
  owner: ["all", "unassigned", ...TEAMMATES.map((person) => person.id)],
};
const identifier = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(value)
    ? value
    : null;

export function parseRoute(hash = "") {
  const value = String(hash).replace(/^#/, "");
  const [path, query = ""] = value.split("?");
  const parts = path.split("/").filter(Boolean);
  const valid =
    parts.length === 2 &&
    ["support", "sales"].includes(parts[0]) &&
    ["priorities", "overview", "connections"].includes(parts[1]);
  const route = {
    lens: "support",
    destination: "priorities",
    filters: { ...DEFAULT_FILTERS },
    conversationId: null,
    findingId: null,
  };
  if (!valid) return route;
  route.lens = parts[0];
  route.destination = parts[1];
  const params = new URLSearchParams(query);
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    const incoming = params.get(key);
    if (incoming === null) continue;
    if (key === "q") route.filters.q = incoming.slice(0, 300);
    else if (choices[key]) {
      if (choices[key].includes(incoming)) route.filters[key] = incoming;
    } else route.filters[key] = identifier(incoming) || DEFAULT_FILTERS[key];
  }
  if (route.destination === "priorities") {
    route.conversationId = identifier(params.get("conversation"));
    route.findingId = route.conversationId
      ? identifier(params.get("finding"))
      : null;
  }
  return route;
}

export function routeHref(route, patch = {}) {
  const merged = {
    ...route,
    ...patch,
    filters: { ...DEFAULT_FILTERS, ...route?.filters, ...patch.filters },
  };
  const params = new URLSearchParams();
  for (const [key, fallback] of Object.entries(DEFAULT_FILTERS)) {
    const value = merged.filters[key];
    if (value != null && value !== fallback) params.set(key, String(value));
  }
  if (merged.conversationId) params.set("conversation", merged.conversationId);
  if (merged.findingId) params.set("finding", merged.findingId);
  const safe = parseRoute(`#/${merged.lens}/${merged.destination}?${params}`);
  const canonical = new URLSearchParams();
  for (const [key, fallback] of Object.entries(DEFAULT_FILTERS)) {
    if (safe.filters[key] !== fallback) canonical.set(key, safe.filters[key]);
  }
  if (safe.conversationId) canonical.set("conversation", safe.conversationId);
  if (safe.findingId) canonical.set("finding", safe.findingId);
  return `#/${safe.lens}/${safe.destination}${canonical.size ? `?${canonical}` : ""}`;
}

/** Hash navigation emits once immediately; browser Back/Forward emits through hashchange. */
export function createRouter({ onChange = () => {} } = {}) {
  const browser = globalThis.window;
  if (!browser) throw new Error("createRouter requires a browser window");
  let route = parseRoute(browser.location.hash);
  let currentHash = routeHref(route);
  if (browser.location.hash !== currentHash)
    browser.history.replaceState(null, "", currentHash);
  function accept() {
    const next = parseRoute(browser.location.hash);
    const canonical = routeHref(next);
    if (browser.location.hash !== canonical)
      browser.history.replaceState(null, "", canonical);
    if (canonical === currentHash) return;
    currentHash = canonical;
    route = next;
    onChange(parseRoute(currentHash));
  }
  browser.addEventListener("hashchange", accept);
  return {
    getRoute() {
      return parseRoute(currentHash);
    },
    navigate(patch, { replace = false } = {}) {
      const hash = routeHref(route, patch);
      if (hash === currentHash) return;
      if (replace) browser.history.replaceState(null, "", hash);
      else browser.location.hash = hash;
      accept();
    },
    destroy() {
      browser.removeEventListener("hashchange", accept);
    },
  };
}
