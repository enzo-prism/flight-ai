import {
  SAMPLE_NOW,
  SAMPLE_DATE,
  TEAMMATES,
  SOURCES,
  PERIODS,
} from "./demo/fixtures.mjs";
import {
  getFinding,
  getConversation,
  getRows,
  getOverview,
  waitingLabel,
  priorityLabel,
  statusLabel,
} from "./demo/selectors.mjs";
import { createStore } from "./demo/state.mjs";
import { createRouter, routeHref } from "./demo/router.mjs";

const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
const toast = document.querySelector("#toast");
const smallScreen = matchMedia("(max-width: 900px)");
const store = createStore();
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const person = (id) => TEAMMATES.find((t) => t.id === id)?.name || "Unassigned";
const source = (id) =>
  SOURCES.find((s) => s.id === id)?.name || "Sample conversation";
const isActive = (f) => ["open", "in-progress"].includes(f.status);
const time = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
let route;
let lastRoute;
let toastTimer;
let searchTimer;
let modalReturnFocus;
let draftOpen = new Set();
const scrollPositions = new Map();
const router = createRouter({
  onChange: (next) => {
    route = next;
    render(true);
  },
});
route = router.getRoute();

function href(patch) {
  return routeHref(route, patch);
}
function nav(patch, options) {
  clearTimeout(searchTimer);
  rememberScroll();
  router.navigate(patch, options);
}
function key(r = route) {
  return `${r.lens}:${JSON.stringify(r.filters)}`;
}
function rememberScroll() {
  const list = document.querySelector(".conversation-list");
  if (list && !document.body.classList.contains("detail-open"))
    scrollPositions.set(key(), { list: list.scrollTop, page: scrollY });
}
function announce(text) {
  document.querySelector("#announcement").textContent = text;
}
function notify(text, undo = false) {
  clearTimeout(toastTimer);
  toast.innerHTML = `<span>${esc(text)}</span>${undo && store.canUndo ? '<button class="button quiet small" data-action="undo">Undo</button>' : ""}<button class="icon-button" aria-label="Dismiss notification" data-action="close-toast">×</button>`;
  toast.hidden = false;
  if (!undo)
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 8000);
}
function apply(id, patch, text) {
  if (store.update(id, patch, text) !== false) notify(text, true);
}
function render(fromRoute = false) {
  if (route.conversationId) {
    const selected = getConversation(route.conversationId);
    const finding =
      route.findingId && getFinding(route.findingId, store.getState());
    if (!selected || selected.lens !== route.lens) {
      router.navigate(
        { conversationId: null, findingId: null },
        { replace: true },
      );
      notify(
        "That conversation is not in this sample lens. Showing the conversation list.",
      );
      return;
    }
    if (route.findingId && finding?.conversationId !== selected.id) {
      router.navigate({ findingId: null }, { replace: true });
      return;
    }
  }
  document.body.append(toast);
  const disclosureState = [...document.querySelectorAll("details[open]")].map(
    (el) => el.className || "ranking",
  );
  const focused = document.activeElement;
  const focusId = focused?.id;
  const focusAction = focused?.dataset?.action;
  const focusFinding = focused?.dataset?.id;
  const selection =
    focused instanceof HTMLInputElement
      ? [focused.selectionStart, focused.selectionEnd]
      : null;
  const listPosition =
    document.querySelector(".conversation-list")?.scrollTop || 0;
  const detailPosition = document.querySelector(".detail-pane")?.scrollTop || 0;
  const changedSelection =
    fromRoute &&
    (route.conversationId !== lastRoute?.conversationId ||
      route.findingId !== lastRoute?.findingId);
  const changedPage =
    fromRoute &&
    (route.lens !== lastRoute?.lens ||
      route.destination !== lastRoute?.destination);
  const title = {
    priorities: "Priorities",
    overview: "Overview",
    connections: "Connections",
  }[route.destination];
  document.title = `${title} · ${route.lens === "support" ? "Support" : "Sales"} · Mach 1 preview`;
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar" aria-label="Workspace navigation">
      <a class="brand" href="product.html" aria-label="Mach 1 product website"><img src="assets/brand/mach1-logo.png" alt="Mach 1" width="98" height="28"></a>
      <span class="sample-badge"><span class="sample-status-dot" aria-hidden="true"></span>Sample workspace</span>
      <div class="lens-switch" role="group" aria-label="Team lens">${["support", "sales"].map((lens) => `<button data-lens="${lens}" aria-pressed="${route.lens === lens}">${lens === "support" ? "Support" : "Sales"}</button>`).join("")}</div>
      <nav class="primary-nav" aria-label="Workspace">${[
        ["priorities", "Priorities", "list"],
        ["overview", "Overview", "overview"],
        ["connections", "Connections", "connections"],
      ]
        .map(
          ([destination, label, icon]) =>
            `<a href="${href({ destination, conversationId: null, findingId: null, filters: defaultFilters() })}" ${route.destination === destination ? 'aria-current="page"' : ""}>${iconSvg(icon)}<span>${label}</span></a>`,
        )
        .join("")}</nav>
      <div class="sidebar-bottom"><p class="sidebar-promise">A little clarity.<br>A better next step.</p><a class="text-link replay-preview" href="preview.html">Replay the welcome experience →</a><a class="text-link" href="product.html">Explore Mach 1 <span aria-hidden="true">↗</span></a>
      <details class="demo-menu"><summary>Preview options</summary><div><p>Fictional workspace. Changes stay in this browser.</p><button class="button quiet" data-action="about">About this preview</button><button class="button quiet" data-action="reset">Reset sample workspace</button></div></details></div>
    </aside>
    <div class="workspace"><header class="workspace-bar"><div class="workspace-context"><span class="workspace-avatar" aria-hidden="true">M</span> Meridian <span class="muted">/ ${route.lens === "support" ? "Support" : "Sales"}</span></div><span class="sample-clock" title="${esc(SAMPLE_DATE)}">September 18 <span aria-hidden="true">·</span> Sample day</span></header>
    ${store.notice ? `<p class="storage-notice" role="status">${esc(store.notice)}</p>` : ""}
    <main id="main-content" tabindex="-1">${route.destination === "priorities" ? priorities() : route.destination === "overview" ? overview() : connections()}</main></div></div>`;
  for (const d of document.querySelectorAll("details")) {
    if (
      disclosureState.includes(d.className || "ranking") &&
      !(fromRoute && (d.classList.contains("context-thread") || !d.className))
    )
      d.open = true;
  }
  const pane = document.querySelector(".detail-pane");
  document.body.classList.toggle(
    "detail-open",
    Boolean(pane && smallScreen.matches),
  );
  if (pane && smallScreen.matches) {
    pane.setAttribute("role", "dialog");
    pane.setAttribute("aria-modal", "true");
    pane.append(toast);
    for (const el of document.querySelectorAll(
      ".sidebar,.workspace-bar,.page-heading,.focus-brief,.toolbar,.list-intro,.conversation-list,.storage-notice",
    ))
      el.inert = true;
  }
  const list = document.querySelector(".conversation-list");
  if (list) list.scrollTop = listPosition;
  if (pane && !changedSelection) pane.scrollTop = detailPosition;
  if (changedPage) document.querySelector("h1")?.focus({ preventScroll: true });
  else if (changedSelection && pane)
    pane.querySelector(".detail-heading")?.focus({ preventScroll: true });
  else if (changedSelection && !pane) {
    const prior = lastRoute?.conversationId;
    (
      document.querySelector(
        `[data-conversation="${CSS.escape(prior || "")}"]`,
      ) || document.querySelector("#conversation-search")
    )?.focus({ preventScroll: true });
    const saved = scrollPositions.get(key());
    if (saved) {
      if (list) list.scrollTop = saved.list;
      window.scrollTo(0, saved.page);
    }
  } else if (focusId) {
    const next = document.getElementById(focusId);
    next?.focus({ preventScroll: true });
    if (selection && next instanceof HTMLInputElement && next.type === "search")
      next.setSelectionRange(...selection);
  } else if (focusAction) {
    const same = [...document.querySelectorAll("[data-action]")].find(
      (el) =>
        el.dataset.action === focusAction && el.dataset.id === focusFinding,
    );
    (
      same ||
      document.querySelector('.detail-pane [data-action="draft"]') ||
      document.querySelector(".detail-heading")
    )?.focus({ preventScroll: true });
  }
  lastRoute = structuredClone(route);
}
function iconSvg(name) {
  return window.icon({ list: "list", overview: "chart-column", connections: "plug" }[name] || name, 19);
}
function defaultFilters() {
  return {
    status: "active",
    owner: "all",
    q: "",
    type: "all",
    priority: "all",
    period: "current",
    tag: "all",
    metric: "all",
  };
}
function options(items, value) {
  return items
    .map(
      ([id, label]) =>
        `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
}
function field(label, name, items) {
  return `<label class="filter-field">${label}<select id="filter-${name}" data-filter="${name}">${options(items, route.filters[name])}</select></label>`;
}
function priorities() {
  const rows = getRows(route.lens, route.filters, store.getState());
  const selected =
    route.conversationId && getConversation(route.conversationId);
  const validSelected = selected?.lens === route.lens ? selected : null;
  const narrowed = Object.entries(defaultFilters()).some(
    ([k, v]) => route.filters[k] !== v,
  );
  return `<div class="page-heading"><p class="eyebrow">${route.lens === "support" ? "Customer support" : "Sales conversations"}</p><h1 tabindex="-1">What needs attention</h1><p>${route.lens === "support" ? "Every conversation deserves a clear next step. Start with the ones that matter most." : "Keep good conversations moving. Find the question, commitment, or opportunity to follow up."}</p></div>
  ${!narrowed && !validSelected && rows[0]?.primary ? focusBrief(rows) : ""}
  <div class="toolbar" role="search" aria-label="Filter conversations"><label class="search-field"><span class="sr-only">Search conversations</span><input id="conversation-search" type="search" placeholder="Search conversations" value="${esc(route.filters.q)}" autocomplete="off"></label>
  ${field("Status", "status", [
    ["active", "Open & in progress"],
    ["open", "Open"],
    ["in-progress", "In progress"],
    ["handled", "Handled"],
    ["dismissed", "Dismissed"],
    ["all", "All conversations"],
  ])}
  ${field("Owner", "owner", [["all", "Anyone"], ["unassigned", "Unassigned"], ...TEAMMATES.map((t) => [t.id, t.name])])}
  <details class="filter-popover"><summary>More filters${["type", "priority", "period", "tag", "metric"].some((k) => route.filters[k] !== defaultFilters()[k]) ? " · Active" : ""}</summary><div>
  ${field("Priority", "priority", [
    ["all", "Any priority"],
    ["high", "High priority"],
    ["attention", "Needs attention"],
    ["review", "Review needed"],
  ])}
  ${field("Finding type", "type", [
    ["all", "All types"],
    ["unanswered", "Unanswered question"],
    ["promise", "Overdue promise"],
    ["repeat", "Repeated request"],
    ["handoff", "Incomplete handoff"],
    ["objection", "Buying objection"],
  ])}
  ${field("Sample period", "period", [
    ["current", PERIODS.current.label],
    ["previous", PERIODS.previous.label],
  ])}
  <p class="muted">${route.filters.tag !== "all" ? `Pattern: ${esc(route.filters.tag)}. ` : ""}${route.filters.metric !== "all" ? `Showing ${esc(route.filters.metric)} records. ` : ""}All times use the frozen sample clock.</p><button class="button quiet" data-action="clear-filters">Reset filters</button></div></details>
  ${narrowed ? '<button class="button quiet small" data-action="clear-filters">Clear filters</button>' : ""}</div>
  <div class="list-intro"><span>${rows.length} ${rows.length === 1 ? "conversation" : "conversations"}${route.filters.period === "previous" ? " · Previous sample week" : ""}</span><span>Open a finding to see why it needs attention.</span></div>
  <div class="workspace-split ${validSelected ? "has-detail" : ""}"><div class="conversation-list" role="region" aria-label="Conversations">${rows.length ? rows.map((row) => rowHTML(row)).join("") : `<div class="empty-state"><h2>No conversations match</h2><p>${narrowed ? "Try a different filter or return to all open work." : "There are no open findings in this sample lens. View handled work or reset the sample to explore again."}</p><button class="button" data-action="clear-filters">Show open work</button><button class="button quiet" data-action="all-conversations">View all conversations</button></div>`}</div>${validSelected ? detail(validSelected) : ""}</div>`;
}
function focusBrief(rows) {
  const first = rows[0];
  const f = first.primary;
  const overview = getOverview(route.lens, store.getState());
  return `<section class="focus-brief" aria-label="Your next clear step"><div class="focus-copy"><span class="focus-eyebrow">${iconSvg("brain")} Your next clear step</span><h2>${esc(f.title)}</h2><p>${esc(f.summary)}</p><a class="button primary" href="${href({ conversationId: first.conversation.id, findingId: f.id })}">See the conversation <span aria-hidden="true">→</span></a></div><div class="focus-summary"><span class="focus-number">${overview.open}</span><span>conversations need attention</span><div class="focus-summary-rule"></div><p>${overview.reviewed} conversations reviewed.<br>One clear place to begin.</p></div></section>`;
}
function rowHTML({ conversation: c, findings, primary: f }) {
  return `<button class="conversation-row" data-conversation="${esc(c.id)}" data-finding="${esc(f?.id || "")}" ${route.conversationId === c.id ? 'aria-current="true"' : ""}><span class="row-avatar" aria-hidden="true">${esc(c.customer.name.split(" ").map((part) => part[0]).slice(0, 2).join(""))}</span><span class="row-person">${esc(c.customer.name)} <span class="muted">· ${esc(c.customer.company)}</span></span><span class="row-title">${esc(f?.title || c.subject)}</span><span class="row-summary">${esc(f?.summary || "Reviewed sample conversation. No finding was identified.")}</span><span class="row-meta">${f ? `<span class="priority ${f.priority}">${esc(priorityLabel(f.priority))}</span><span class="owner">${esc(person(f.ownerId))}</span><span>${isActive(f) ? "Waiting " + esc(waitingLabel(f.waitingSince)) : esc(statusLabel(f.status))}</span>${f.status === "in-progress" ? '<span class="status">In progress</span>' : ""}${findings.length > 1 ? `<span class="row-count">${findings.length} findings</span>` : ""}` : "<span>No finding</span>"}</span><span class="row-arrow" aria-hidden="true">→</span></button>`;
}
function detail(c) {
  const state = store.getState();
  const all =
    getRows(
      route.lens,
      { ...defaultFilters(), status: "all", period: c.period },
      state,
    ).find((r) => r.conversation.id === c.id)?.findings || [];
  const requested = route.findingId && getFinding(route.findingId, state);
  const f = requested?.conversationId === c.id ? requested : all[0];
  const relevant = f
    ? c.messages.filter((m) => f.evidence.some((e) => e.messageId === m.id))
    : c.messages;
  return `<section class="detail-pane" aria-labelledby="detail-title"><div class="detail-top"><button class="button quiet back-button" data-action="back">← <span>Back to conversations</span></button><span class="muted">${esc(source(c.sourceId))} · Sample</span></div>
    <p class="eyebrow">${esc(c.customer.name)} · ${esc(c.customer.company)}</p><h2 id="detail-title" class="detail-heading" tabindex="-1">${esc(f?.title || c.subject)}</h2>
    ${all.length > 1 ? `<div class="finding-switch" role="group" aria-label="Findings in this conversation">${all.map((item, i) => `<a class="button quiet small" href="${href({ findingId: item.id })}" ${f?.id === item.id ? 'aria-current="true"' : ""}>Finding ${i + 1}: ${esc(item.type)}</a>`).join("")}</div>` : ""}
    ${
      f
        ? `<div class="detail-meta"><span class="priority ${f.priority}">${esc(priorityLabel(f.priority))}</span><span class="pill">${esc(statusLabel(f.status))}</span>${isActive(f) ? `<span>Waiting ${esc(waitingLabel(f.waitingSince))}</span>` : ""}</div><p>${esc(f.summary)}</p>
    <section class="detail-section"><h3>Why this needs attention</h3><p>${esc(f.reason)}</p>${f.priority === "review" ? '<p class="boundary-note">Review needed means the interpretation is uncertain. Check the evidence before acting.</p>' : ""}<details><summary>Why this is here</summary><p>Findings are ordered by priority, then overdue commitments, then longest waiting time. ${esc(priorityLabel(f.priority))} is the recorded severity for this example.${f.dueAt ? ` The recorded commitment was due ${esc(time(f.dueAt))}${new Date(f.dueAt) < new Date(SAMPLE_NOW) ? ", before the sample clock" : ""}.` : ""} Waiting is measured from ${esc(time(f.waitingSince))} to the frozen sample clock. No numerical AI score is used.</p></details></section>`
        : '<p class="boundary-note">This conversation was reviewed. No finding was identified in the sample. It still contributes to the reviewed-conversation total.</p>'
    }
    <section class="detail-section"><h3>Conversation evidence</h3><p class="muted">The messages behind this insight</p><div class="evidence-list">${relevant.map((m) => messageHTML(m, f)).join("")}</div>${f && relevant.length < c.messages.length ? `<details class="context-thread"><summary>View full conversation (${c.messages.length} messages)</summary>${c.messages.map((m) => messageHTML(m, f)).join("")}</details>` : ""}</section>
    ${f ? actionsHTML(f) : '<div class="detail-section"><p>No action is needed for this sample conversation.</p></div>'}
  </section>`;
}
function messageHTML(m, f) {
  let body = esc(m.text);
  const quotes = [
    ...new Set(
      (f?.evidence || [])
        .filter((e) => e.messageId === m.id)
        .map((e) => e.quote),
    ),
  ].sort((a, b) => b.length - a.length);
  // Highlight only source substrings; source and quotes are escaped before markup is added.
  for (const quote of quotes)
    if (quote && m.text.includes(quote))
      body = body.replace(esc(quote), `<mark>${esc(quote)}</mark>`);
  return `<article class="message"><div class="message-header"><strong>${esc(m.sender)}</strong><time datetime="${esc(m.at)}">${esc(time(m.at))}</time></div><p class="message-text">${body}</p></article>`;
}
function actionsHTML(f) {
  const active = isActive(f);
  const openDraft = draftOpen.has(f.id);
  const recorded = f.status === "handled" ? f.outcome : f.dismissReason;
  return `<section class="detail-section"><h3>Suggested next step</h3><p>${esc(f.suggestion)}</p>
  ${!active ? `<p class="boundary-note">${f.status === "handled" ? "Marked handled by the sample team. This does not confirm that the customer’s issue is resolved." : "Dismissed for review quality. This does not mean the customer’s experience improved."}</p>${recorded ? `<p><strong>Recorded ${f.status === "handled" ? "outcome" : "reason"}:</strong> ${esc(recorded)}</p>` : ""}` : ""}
  <div class="action-row">${active ? `<button class="button ${openDraft ? "quiet" : "primary"}" data-action="draft" data-id="${f.id}">${openDraft ? "Close draft" : f.draft ? "Draft follow-up" : "Draft follow-up"}</button>${f.status === "open" ? `<button class="button" data-action="start" data-id="${f.id}">Start working</button>` : ""}<button class="button quiet" data-action="handle" data-id="${f.id}">Mark handled</button><button class="button quiet" data-action="dismiss" data-id="${f.id}">Dismiss</button>` : `<button class="button primary" data-action="reopen" data-id="${f.id}">Reopen finding</button>${f.draft ? `<button class="button quiet" data-action="draft" data-id="${f.id}">Review draft</button>` : ""}`}</div>
  ${openDraft ? `<div class="draft-editor"><label for="follow-up-draft">Follow-up draft</label><textarea id="follow-up-draft" data-draft="${f.id}" maxlength="20000" rows="7">${esc(f.draft)}</textarea><p class="draft-note">Make it yours. Check bracketed details before using this draft. Nothing is sent.</p><div class="action-row"><button class="button primary" data-action="copy" data-id="${f.id}">Copy draft</button><span class="muted" id="draft-save-status">Edits stay in this browser when storage is available.</span></div></div>` : ""}</section>
  <section class="detail-section"><h3>Ownership & activity</h3><label class="owner-field" for="finding-owner">Assign to<select id="finding-owner" data-owner="${f.id}">${options([["", "Unassigned"], ...TEAMMATES.map((t) => [t.id, t.name])], f.ownerId || "")}</select></label><p class="muted">Keep the next step with the right person.</p><ol class="activity-list">${
    [...(f.activity || f.initialActivity || [])]
      .reverse()
      .map(
        (event) =>
          `<li><p>${esc(event.text)}</p><time datetime="${esc(event.at)}">${esc(time(event.at))}</time></li>`,
      )
      .join("") || "<li>Finding recorded in this sample.</li>"
  }</ol></section>
  <section class="tower-prompt"><p class="eyebrow">Tower · Workflow preview</p><h3>Make this follow-up automatic</h3><p>Tower can coordinate the next step using a process your team approves.</p><button class="button" data-action="tower" data-id="${f.id}">Preview the workflow <span aria-hidden="true">→</span></button></section>`;
}
function overview() {
  const data = getOverview(route.lens, store.getState());
  return `<div class="page-heading"><p class="eyebrow">Team overview</p><h1 tabindex="-1">Where the team needs help</h1><p>${esc(PERIODS.current.label)} · compared with ${esc(PERIODS.previous.label)}</p></div>
  <p class="overview-brief">${data.open} of ${data.reviewed} reviewed conversations have open findings. ${route.lens === "support" ? "Use the evidence below to spot recurring gaps and give follow-through a clear owner." : "Use the evidence below to find unanswered buying questions and unblock the next step."}</p>
  <div class="metrics-grid">${data.metrics.map((m) => `<a class="metric" href="${href({ destination: "priorities", conversationId: null, findingId: null, filters: { ...defaultFilters(), ...m.filters } })}"><span class="metric-value">${m.count}</span><span class="metric-label">${esc(m.label)} <span aria-hidden="true">↗</span></span><span class="muted">View underlying conversations</span></a>`).join("")}</div>
  <p class="muted metric-note">Each count is a number of conversations. A conversation may contain several findings.</p><section class="overview-section"><div class="section-heading"><h2>Patterns worth a closer look</h2><p>Conversation counts, not performance scores.</p></div><div class="pattern-list">${data.patterns.map((p) => `<article class="pattern-row"><div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div><a class="button" href="${href({ destination: "priorities", conversationId: null, findingId: null, filters: { ...defaultFilters(), status: "all", ...p.filters } })}">Review conversations <span aria-hidden="true">→</span></a></article>`).join("")}</div></section>
  <section class="overview-section"><div class="section-heading"><h2>Decisions to consider</h2><p>Start with the process, then inspect the individual conversation.</p></div><div class="decision-list">${data.decisions.map((d) => `<article class="decision-row"><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p><a class="text-link" href="${href({ destination: "priorities", conversationId: null, findingId: null, filters: { ...defaultFilters(), ...d.filters } })}">Inspect the evidence →</a></article>`).join("")}</div></section>`;
}
function selectedTools() {
  const catalog = { gmail: "Gmail", zendesk: "Zendesk", hubspot: "HubSpot", intercom: "Intercom", salesforce: "Salesforce", slack: "Slack" };
  let tools = [];
  try {
    const setup = JSON.parse(localStorage.getItem("mach1.preview.setup.v1") || "null");
    if (Array.isArray(setup?.tools)) tools = [...new Set(setup.tools.filter((id) => typeof id === "string" && Object.hasOwn(catalog, id)))];
  } catch { /* Preferences are optional; the sample works without storage. */ }
  if (!tools.length) return '<p class="selected-tools-empty"><a class="text-link" href="preview.html">Choose your tools to personalize the preview →</a></p>';
  return `<section class="selected-tools" aria-label="Your selected tools"><div><h2>Your selected tools</h2><p>Preview preferences. No accounts are connected.</p></div><div class="selected-tools-list">${tools.map((id) => `<span class="selected-tool"><img src="assets/connectors/${id}.svg" alt="" width="20" height="20">${catalog[id]}</span>`).join("")}</div><a class="text-link" href="preview.html">Edit selection →</a></section>`;
}
function connections() {
  return `<div class="page-heading"><p class="eyebrow">Workspace sources</p><h1 tabindex="-1">Understand the source</h1><p>Good decisions start with a conversation you can trace.</p></div><p class="overview-brief">Your conversations, brought into focus. Explore these fictional sources to see how Mach 1 connects the dots.</p>
  ${selectedTools()}
  <div class="source-list">${SOURCES.map((s) => `<article class="source-row"><span class="source-art" aria-hidden="true">${iconSvg("message-square")}</span><div><h2>${esc(s.name)}</h2><p>${esc(s.description)}</p></div><span class="sample-badge">Sample source</span></article>`).join("")}</div>
  <section class="detail-section"><h2>A workspace that fits your work.</h2><p>Choose your tools and explore a different focus. Your sample findings stay here when you return.</p><div class="action-row"><a class="button primary" href="preview.html">Personalize the preview →</a><button class="button quiet" data-action="pilot">Analyze your conversations</button></div></section><p class="boundary-note">Use fictional data only. This preview has no uploads, credential entry, or live integrations.</p>`;
}
function openModal(title, body, actions = "") {
  modalReturnFocus = document.activeElement;
  modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div>${actions ? `<div class="modal-actions">${actions}</div>` : ""}`;
  modal.showModal();
}
function closeModal() {
  modal.close();
}
modal.addEventListener("close", () => {
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
  else document.querySelector(".detail-heading, h1")?.focus();
});
function outcomeDialog(id, dismiss) {
  openModal(
    dismiss ? "Dismiss this finding" : "Mark this finding handled",
    `<p>${dismiss ? "Record why this finding was unhelpful. Dismissing it does not say the customer’s problem improved." : "Record what the team did. Handled means this finding is closed; it does not confirm customer success."}</p><form id="outcome-form" data-id="${id}" data-kind="${dismiss ? "dismiss" : "handle"}"><label class="field" for="outcome-text">${dismiss ? "Reason for dismissal" : "What was done?"}<textarea id="outcome-text" name="outcome" required minlength="3" maxlength="1000" rows="4" placeholder="${dismiss ? "For example: The request was answered in the next message." : "For example: Assigned the access recovery steps for review."}"></textarea></label></form>`,
    `<button class="button quiet" data-action="close-modal">Cancel</button><button class="button primary" type="submit" form="outcome-form">${dismiss ? "Dismiss finding" : "Save outcome"}</button>`,
  );
}
function towerDialog(id) {
  const f = getFinding(id, store.getState());
  const c = getConversation(f.conversationId);
  openModal(
    "Make this follow-up automatic",
    `<p>Tower could coordinate an approved process for <strong>${esc(c.customer.company)}</strong>. This is a local walkthrough, not a running automation.</p><ol class="workflow-steps"><li class="workflow-step"><strong>Detect the ${f.type === "promise" ? "overdue promise" : f.type === "objection" ? "unresolved buying question" : "unanswered request"}</strong><p>Use the finding and its source messages: ${esc(f.title)}.</p></li><li class="workflow-step"><strong>Prepare a response for review</strong><p>Draft a next step using verified details. Leave unknown information for a person to complete.</p></li><li class="workflow-step"><strong>After approval, act and record</strong><p>Send through the permitted source tool, then record the result. This preview stops before approval.</p></li></ol><div class="workflow-controls"><label class="field">Who approves<select id="workflow-approver">${options(
      TEAMMATES.map((t) => [t.id, t.name]),
      f.ownerId || TEAMMATES[0].id,
    )}</select></label><label class="field">Tool that would act<select id="workflow-tool">${options(
      SOURCES.map((s) => [s.id, s.name]),
      c.sourceId,
    )}</select></label><label class="field">Escalate if still waiting<select id="workflow-escalation"><option>After 4 hours</option><option>After 1 business day</option><option>After 2 business days</option></select></label><label class="field">Record history in<select id="workflow-history"><option>Source + workspace activity</option><option>Workspace activity only</option></select></label></div><div id="workflow-result" class="approval-state" role="status"><strong>Ready to preview</strong><p>Nothing will be sent. Your choices apply only to this walkthrough.</p></div>`,
    `<button class="button primary" data-action="simulate">Run preview</button><a class="button" href="sales.html">Discuss automation</a>`,
  );
}

app.addEventListener("click", (event) => {
  if (event.target.closest('a[href^="#"]')) {
    clearTimeout(searchTimer);
    rememberScroll();
  }
  const lens = event.target.closest("[data-lens]");
  if (lens) {
    nav({
      lens: lens.dataset.lens,
      conversationId: null,
      findingId: null,
      filters: defaultFilters(),
    });
    return;
  }
  const row = event.target.closest("[data-conversation]");
  if (row) {
    nav({
      conversationId: row.dataset.conversation,
      findingId: row.dataset.finding || null,
    });
    return;
  }
});
app.addEventListener("change", (event) => {
  if (event.target.matches("[data-filter]")) {
    clearTimeout(searchTimer);
    nav({
      filters: {
        [event.target.dataset.filter]: event.target.value,
        metric: "all",
        q: document.querySelector("#conversation-search").value,
      },
      conversationId: null,
      findingId: null,
    });
  }
  if (event.target.matches("[data-owner]")) {
    const id = event.target.dataset.owner;
    const ownerId = event.target.value || null;
    apply(
      id,
      { ownerId },
      ownerId ? `Assigned to ${person(ownerId)}.` : "Returned to unassigned.",
    );
  }
});
app.addEventListener("input", (event) => {
  if (event.target.id === "conversation-search") {
    const q = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () =>
        nav(
          { filters: { q }, conversationId: null, findingId: null },
          { replace: true },
        ),
      180,
    );
  }
  if (event.target.matches("[data-draft]")) {
    if (!store.saveDraft(event.target.dataset.draft, event.target.value)) {
      document.querySelector("#draft-save-status").textContent =
        "Draft is too long to save. Keep it under 20,000 characters.";
      return;
    }
    document.querySelector("#draft-save-status").textContent = store.notice
      ? "Saved for this visit. Browser storage is unavailable."
      : "Draft saved in this browser. Nothing sent.";
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "back") nav({ conversationId: null, findingId: null });
  if (action === "clear-filters")
    nav({ filters: defaultFilters(), conversationId: null, findingId: null });
  if (action === "all-conversations")
    nav({
      filters: { ...defaultFilters(), status: "all" },
      conversationId: null,
      findingId: null,
    });
  if (action === "close-toast") toast.hidden = true;
  if (action === "undo") {
    if (store.undo()) notify("Change undone. Activity history is preserved.");
  }
  if (action === "close-modal") closeModal();
  if (action === "start")
    apply(
      id,
      { status: "in-progress" },
      "Started working. No message has been sent.",
    );
  if (action === "reopen")
    apply(
      id,
      { status: "open" },
      "Finding reopened. Earlier activity is preserved.",
    );
  if (action === "handle" || action === "dismiss")
    outcomeDialog(id, action === "dismiss");
  if (action === "draft") {
    draftOpen.has(id) ? draftOpen.delete(id) : draftOpen.add(id);
    render();
    if (draftOpen.has(id)) document.querySelector("#follow-up-draft")?.focus();
  }
  if (action === "copy") {
    const draft = document.querySelector("#follow-up-draft").value;
    try {
      await navigator.clipboard.writeText(draft);
      notify("Draft copied. Nothing has been sent.");
    } catch {
      document.querySelector("#follow-up-draft")?.select();
      notify(
        "Copy is unavailable here. The draft is selected; use your keyboard to copy.",
      );
    }
  }
  if (action === "tower") towerDialog(id);
  if (action === "simulate") {
    const approver =
      document.querySelector("#workflow-approver").selectedOptions[0]
        .textContent;
    const tool =
      document.querySelector("#workflow-tool").selectedOptions[0].textContent;
    const escalation = document.querySelector("#workflow-escalation").value;
    const history = document.querySelector("#workflow-history").value;
    document.querySelector("#workflow-result").innerHTML =
      `<strong>Awaiting approval</strong><p>Sample response prepared for ${esc(approver)} to review. ${esc(tool)} would act only after approval; escalation: ${esc(escalation.toLowerCase())}. History: ${esc(history.toLowerCase())}. No message was sent and no external tool was called.</p>`;
    button.textContent = "Run preview again";
  }
  if (action === "reset")
    openModal(
      "Reset sample workspace?",
      "<p>This clears assignments, statuses, drafts, and activity changes made in this preview. Other website and browser data stay untouched.</p>",
      '<button class="button quiet" data-action="close-modal">Keep changes</button><button class="button primary" data-action="confirm-reset">Reset sample workspace</button>',
    );
  if (action === "confirm-reset") {
    closeModal();
    draftOpen.clear();
    store.reset();
    nav({
      lens: "support",
      destination: "priorities",
      conversationId: null,
      findingId: null,
      filters: defaultFilters(),
    });
    notify("Sample workspace reset.");
  }
  if (action === "about")
    openModal(
      "A focused concept preview",
      '<p>Know what needs attention. See why. Move it forward.</p><p>Meridian, its customers, and its conversations are fictional. Findings are precomputed examples, not live AI analysis. The clock is fixed so waits and sample comparisons stay consistent.</p><p>Assignments, drafts, and outcomes stay in this browser when storage is available. Nothing is sent. This proposed experience is separate from the capabilities documented on the Mach 1 product website.</p><p><a class="text-link" href="product.html">Read about the Mach 1 product →</a></p>',
    );
  if (action === "pilot")
    openModal(
      "Explore a conversation-analysis pilot",
      "<p>This preview cannot ingest or analyze your data. A pilot conversation would establish permitted sources, access controls, retention, and a useful first question to test.</p><p>Continue to our contact page to prepare an email. You review and send it from your own email app; this site does not submit the inquiry.</p><p>Please do not include customer conversations, credentials, or private data in your inquiry.</p>",
      '<button class="button quiet" data-action="close-modal">Back to preview</button><a class="button primary" href="sales.html">Discuss a pilot</a>',
    );
});
modal.addEventListener("submit", (event) => {
  if (event.target.id !== "outcome-form") return;
  event.preventDefault();
  const text = new FormData(event.target).get("outcome").trim();
  if (text.length < 3) {
    document
      .querySelector("#outcome-text")
      .setCustomValidity("Add a short explanation with at least 3 characters.");
    document.querySelector("#outcome-text").reportValidity();
    return;
  }
  const { id, kind } = event.target.dataset;
  closeModal();
  apply(
    id,
    kind === "dismiss"
      ? { status: "dismissed", dismissReason: text }
      : { status: "handled", outcome: text },
    `${kind === "dismiss" ? "Dismissed" : "Marked handled"}: ${text}`,
  );
});
modal.addEventListener("input", (event) => {
  if (event.target.id === "outcome-text") event.target.setCustomValidity("");
});
document.addEventListener("keydown", (event) => {
  if (modal.open) return;
  if (event.key === "Escape") {
    const disclosure = document.querySelector(
      "details.demo-menu[open], details.filter-popover[open]",
    );
    if (disclosure) {
      disclosure.open = false;
      disclosure.querySelector("summary").focus();
      return;
    }
    if (route.conversationId) {
      event.preventDefault();
      nav({ conversationId: null, findingId: null });
    }
  }
  if (
    event.key === "Tab" &&
    smallScreen.matches &&
    document.querySelector(".detail-pane")
  ) {
    const items = [
      ...document
        .querySelector(".detail-pane")
        .querySelectorAll(
          'a[href],button,select,textarea,input,summary,[tabindex="0"]',
        ),
    ].filter((el) => el.getClientRects().length);
    const first = items[0],
      last = items.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !items.includes(document.activeElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
document.addEventListener("click", (event) => {
  for (const d of document.querySelectorAll(
    ".demo-menu[open],.filter-popover[open]",
  ))
    if (!d.contains(event.target)) d.open = false;
});
window.addEventListener("scroll", rememberScroll, { passive: true });
smallScreen.addEventListener("change", () => render());
store.subscribe(() => {
  render();
  announce("Workspace updated.");
});
render();
