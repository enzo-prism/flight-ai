const root = document.querySelector("#product-root");
const statusBox = document.querySelector("#live-status");
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const e = escapeHTML;
const labels = {
  open: "Open",
  "in-progress": "In progress",
  handled: "Handled",
  dismissed: "Dismissed",
};
const priorities = {
  high: "High priority",
  attention: "Needs attention",
  review: "Review needed",
};
let config = null,
  session = null,
  workspaceData = null,
  mode = "signup",
  busy = false,
  currentError = "",
  scanConnection = null;
let statusTimer;
const draftEdits = new Map();
let filter = "active";
let search = "";
const isActive = (f) =>
  f.analysis_current !== false && ["open", "in-progress"].includes(f.status);
const dateLabel = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Time unavailable";
const catalog = () =>
  Array.isArray(config?.connectors) ? config.connectors : [];
const connectionName = (item) =>
  catalog().find((c) => c.id === item.provider)?.name || item.provider;
function flash(message) {
  clearTimeout(statusTimer);
  statusBox.textContent = message;
  statusBox.hidden = false;
  statusTimer = setTimeout(() => (statusBox.hidden = true), 8000);
}
async function api(action, body) {
  const response = await fetch(
    `/api/product?action=${encodeURIComponent(action)}`,
    {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => ({
    error: { message: "The service did not return a valid response." },
  }));
  if (!response.ok)
    throw new Error(
      data.error?.message ||
        (typeof data.error === "string"
          ? data.error
          : "The request could not be completed. Please try again."),
    );
  return data;
}
function route() {
  const query = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
  return {
    page: query.get("page") || "",
    finding: query.get("finding") || "",
    metric: query.get("metric") || "",
  };
}
function go(page, extra = {}) {
  const q = new URLSearchParams({ page, ...extra });
  location.hash = "/" + q;
}
function header() {
  return `<header class="entry-header"><a href="index.html" aria-label="Mach 1 home"><img src="assets/brand/mach1-logo.png" alt="Mach 1"></a><a href="product.html">Explore the product <span aria-hidden="true">↗</span></a></header>`;
}
function steps(active) {
  return `<ol class="setup-steps" aria-label="Setup progress">${["Account", "Connect tools", "Choose your work"].map((name, i) => `<li ${i === active ? 'aria-current="step"' : ""}><span>${i + 1}</span>${name}</li>`).join("")}</ol>`;
}
function notice() {
  return currentError
    ? `<p class="setup-notice error" role="alert">${e(currentError)}</p>`
    : "";
}
function entry(title, summary, step, content) {
  return `<div class="onboarding-shell">${header()}<main id="main-content" class="onboarding"><section class="onboarding-intro"><p class="eyebrow">Mach 1 · Your next clear step</p><h1 tabindex="-1">${title}</h1><p>${summary}</p>${steps(step)}<p class="privacy-note">Connect the conversations your team works with. See the evidence behind each insight and keep control of what happens next.</p></section><section class="entry-card">${content}</section></main></div>`;
}
function authView() {
  const auth = config?.auth || {};
  const recovery = mode === "recover",
    reset = mode === "reset",
    sso = mode === "sso";
  const title = recovery
    ? "Reset your password"
    : reset
      ? "Choose a new password"
      : sso
        ? "Sign in with your organization"
        : mode === "signup"
          ? "Create your account"
          : "Welcome back";
  return entry(
    "Know what needs attention.<br>Move it forward.",
    "Bring your sales and support conversations into focus, with insights grounded in the original evidence.",
    0,
    `
  <h2>${title}</h2><p>${recovery ? "We’ll send a password reset link if an eligible account exists." : reset ? "Set a strong password for your account." : sso ? "Use the domain your organization has registered for single sign-on." : "Start with your account. Then connect your tools and choose your team’s focus."}</p>${notice()}
  ${!config?.serviceReady ? '<p class="setup-notice">Account setup is being completed. Sign-in will become available once the service is configured.</p>' : ""}
  ${!recovery && !reset && !sso ? `<div class="provider-buttons"><button class="button" data-action="oauth" data-provider="google" ${auth.google ? "" : "disabled"}><span class="provider-monogram" aria-hidden="true">G</span>Continue with Google</button><button class="button" data-action="oauth" data-provider="apple" ${auth.apple ? "" : "disabled"}>Continue with Apple</button><button class="button sso" data-action="auth-mode" data-mode="sso" ${auth.sso ? "" : "disabled"}>Continue with SSO</button></div>${!auth.google || !auth.apple || !auth.sso ? '<p class="entry-footnote">Unavailable sign-in methods are not enabled for this deployment yet.</p>' : ""}<div class="or-line">or use your email</div>` : ""}
  <form id="auth-form" data-mode="${mode}">${sso ? '<label class="field" for="company-domain">Company domain<input id="company-domain" name="domain" placeholder="company.com" autocomplete="organization" required maxlength="253"></label>' : `${!reset ? '<label class="field" for="account-email">Work email<input id="account-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@company.com"></label>' : ""}${!recovery ? `<label class="field" for="account-password">Password<input id="account-password" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="${mode === "login" ? 1 : 12}" maxlength="128" required ${auth.email || reset ? "" : "disabled"}></label>${mode === "signup" || reset ? '<p class="entry-footnote">Use at least 12 characters.</p>' : ""}` : ""}`}
  <button class="button primary" type="submit" ${((sso ? auth.sso : auth.email) || reset) && !busy ? "" : "disabled"}>${busy ? "Please wait…" : recovery ? "Request reset link" : reset ? "Save password" : sso ? "Continue with SSO" : mode === "signup" ? "Get Started" : "Sign in"}</button></form>
  <div class="auth-links">${mode === "signup" ? '<button data-action="auth-mode" data-mode="login">Already have an account? Sign in</button>' : '<button data-action="auth-mode" data-mode="signup">Create an account</button>'}${mode === "login" ? '<button data-action="auth-mode" data-mode="recover">Forgot password?</button>' : recovery || reset || sso ? '<button data-action="auth-mode" data-mode="login">Back to sign in</button>' : ""}</div>
  <p class="entry-footnote">Your password is handled by the authentication service. Mach 1 does not store it in your browser.</p><a class="text-link" href="sample.html">Explore a sample workspace first →</a>`,
  );
}
function connectorCard(c, onboarding = false) {
  const connected = (session?.connections || []).find(
    (x) => x.provider === c.id && x.status !== "disconnected",
  );
  const working = scanConnection === connected?.id;
  if (connected?.status === "error")
    return `<article class="connector-option"><span class="connector-icon" aria-hidden="true">${e(c.name[0])}</span><div><h3>${e(c.name)}</h3><p>Authorization needs attention. Reconnect the same account to continue.</p><span class="connection-state">${connected.last_synced_at ? "Last sync " + e(dateLabel(connected.last_synced_at)) : "Not scanned yet"}</span></div><div class="source-actions"><button class="button" data-action="connect" data-provider="${c.id}" ${c.ready && !busy && !scanConnection ? "" : "disabled"}>Reconnect</button><button class="button quiet" data-action="disconnect" data-id="${connected.id}" ${scanConnection ? "disabled" : ""}>Disconnect</button></div></article>`;
  return `<article class="connector-option"><span class="connector-icon" aria-hidden="true">${e(c.name[0])}</span><div><h3>${e(c.name)}</h3><p>${e(c.description)}</p><span class="connection-state">${connected ? `${e(connected.status === "error" ? "Needs attention" : "Authorized")} · ${connected.last_synced_at ? "Last sync " + e(dateLabel(connected.last_synced_at)) : "Not scanned yet"}` : c.ready ? "Ready to authorize" : "Provider setup pending"}</span></div><div class="source-actions">${connected ? `${!onboarding ? `<button class="button" data-action="scan" data-id="${connected.id}" ${config.analysisReady && !scanConnection ? "" : "disabled"}>${working ? "Analyzing…" : connected.has_more ? "Scan next batch" : "Scan conversations"}</button><button class="button quiet" data-action="disconnect" data-id="${connected.id}" ${scanConnection ? "disabled" : ""}>Disconnect</button>` : '<span class="pill">Authorized</span>'}` : `<button class="button" data-action="connect" data-provider="${c.id}" ${c.ready && !busy ? "" : "disabled"}>Connect</button>`}</div></article>`;
}
function connectorsView() {
  const hasConnection = (session?.connections || []).some(
    (c) => c.status === "authorized",
  );
  return entry(
    "Bring your conversations together.",
    "Choose where Mach 1 should look. Each tool asks you to authorize access before any conversation can be analyzed.",
    1,
    `<h2>Connect your tools</h2><p>Read-only access for analysis. Mach 1 does not send messages through these connections.</p>${notice()}<div class="connector-options">${catalog()
      .map((c) => connectorCard(c, true))
      .join(
        "",
      )}</div><p class="privacy-note">Start with one source. You can add more later. Authorization does not mean a scan has run.</p><div class="setup-actions"><button class="button quiet" data-action="logout">Sign out</button><button class="button primary" data-action="next-role" ${hasConnection ? "" : "disabled"}>Continue →</button></div>`,
  );
}
function roleView() {
  return entry(
    "Built around your work.",
    "Mach 1 uses your team’s focus to choose what to look for and how to organize the findings.",
    2,
    `<h2>How will you use Mach 1?</h2><p>Choose a focus for this workspace.</p>${notice()}<form id="role-form"><fieldset><legend class="sr-only">Workspace focus</legend><div class="role-options"><label class="role-option"><input type="radio" name="lens" value="sales" required ${session?.workspace?.lens === "sales" ? "checked" : ""}><strong>Sales</strong><p>Find unanswered buying questions, unresolved objections, and outstanding team commitments.</p><small>Buying questions · Commitments · Follow-through</small></label><label class="role-option"><input type="radio" name="lens" value="support" required ${session?.workspace?.lens !== "sales" ? "checked" : ""}><strong>Support</strong><p>Find repeated requests, unanswered questions, unresolved blockers, and outstanding promises.</p><small>Customer needs · Response gaps · Commitments</small></label></div></fieldset><p class="privacy-note">Analysis uses the conversations you authorized. Insights link back to the messages that support them.</p><button class="button primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Open my workspace"}</button></form><div class="auth-links"><button data-action="back-connectors">← Back to connectors</button></div>`,
  );
}
function shell(content, page) {
  return `<div class="app-shell live-shell"><aside class="sidebar" aria-label="Workspace navigation"><a class="brand" href="product.html" aria-label="Mach 1 product"><img src="assets/brand/mach1-logo.png" alt="Mach 1"></a><span class="live-badge">${e(session.workspace.lens === "sales" ? "Sales workspace" : "Support workspace")}</span><nav class="primary-nav" aria-label="Workspace">${[
    ["priorities", "Priorities"],
    ["overview", "Overview"],
    ["connections", "Connections"],
  ]
    .map(
      ([id, label]) =>
        `<a href="#/page=${id}" ${page === id ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><p>Know what needs attention.<br>See why. Move it forward.</p><a href="product.html">Explore Mach 1 ↗</a><div class="account-menu"><p>${e(session.user.email)}</p><button class="button quiet" data-action="logout">Sign out</button></div></div></aside><div class="workspace"><header class="workspace-bar"><span class="workspace-context">${e(session.workspace.name)} <span class="muted">/ ${e(session.workspace.lens === "sales" ? "Sales" : "Support")}</span></span><div class="live-top-actions"><span>${e(session.user.email)}</span><button class="button quiet" data-action="logout">Sign out</button></div></header><main id="main-content" tabindex="-1">${currentError ? `<div class="live-error" role="alert">${e(currentError)}</div>` : ""}${content}</main></div></div>`;
}
function currentFindings() {
  return (workspaceData?.findings || [])
    .filter((f) => {
      const c = workspaceData.conversations.find(
        (c) => c.id === f.conversation_id,
      );
      return (
        c &&
        (filter === "all" || filter === "active"
          ? filter === "all" || isActive(f)
          : f.status === filter &&
            (!["open", "in-progress"].includes(filter) ||
              f.analysis_current !== false)) &&
        (!search ||
          `${c.subject} ${c.customer?.name} ${c.customer?.company} ${f.title}`
            .toLowerCase()
            .includes(search.toLowerCase()))
      );
    })
    .sort(
      (a, b) =>
        (({ high: 0, attention: 1, review: 2 })[a.priority] ?? 2) -
          ({ high: 0, attention: 1, review: 2 }[b.priority] ?? 2) ||
        new Date(a.waiting_since) - new Date(b.waiting_since),
    );
}
function heading(eyebrow, title, description) {
  return `<div class="page-heading"><p class="eyebrow">${e(eyebrow)}</p><h1 tabindex="-1">${e(title)}</h1><p>${e(description)}</p></div>`;
}
function readiness() {
  return !config.analysisReady
    ? '<div class="live-banner">Analysis is not available until the Jev service is configured. Your connections and workspace settings remain saved.</div>'
    : "";
}
function coverage() {
  const runs = workspaceData?.runs || [];
  const last = runs[0];
  const limited = workspaceData?.coverage?.partial
    ? " Only the most recent loaded records are counted; this view has reached its record limit."
    : "";
  return last
    ? `<p class="coverage-note">Last analysis: ${e(dateLabel(last.finished_at || last.started_at))} · ${e(last.status)} · ${Number(last.reviewed_count) || 0} conversations reviewed in that run.${last.skipped_count ? ` ${Number(last.skipped_count)} skipped because no eligible messages were available.` : ""}${last.has_more ? " More source records remain. Scan the next batch to expand coverage." : ""} Counts reflect reviewed records only.${limited}</p>`
    : '<p class="coverage-note">No analysis has run yet. No sample findings are mixed into your workspace.</p>';
}
function prioritiesView() {
  const findings = currentFindings();
  const grouped = new Map();
  for (const f of findings) {
    if (!grouped.has(f.conversation_id)) grouped.set(f.conversation_id, []);
    grouped.get(f.conversation_id).push(f);
  }
  const reviewedMetric = route().metric === "reviewed";
  const rows = reviewedMetric
    ? (workspaceData.conversations || [])
        .filter(
          (c) =>
            !search ||
            `${c.subject} ${c.customer?.name} ${c.customer?.company}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .map((c) => ({
          c,
          items: (workspaceData.findings || []).filter(
            (f) => f.conversation_id === c.id,
          ),
        }))
    : [...grouped].map(([id, items]) => ({
        c: workspaceData.conversations.find((c) => c.id === id),
        items,
      }));
  return (
    heading(
      session.workspace.lens === "sales"
        ? "Sales conversations"
        : "Customer support",
      "What needs attention",
      "See the source. Choose a next step. Keep the work moving.",
    ) +
    readiness() +
    `<div class="live-toolbar"><label>Search conversations<input id="live-search" type="search" value="${e(search)}" placeholder="Customer or conversation" maxlength="200"></label>${
      reviewedMetric
        ? ""
        : `<label>Status<select id="live-filter">${[
            ["active", "Open & in progress"],
            ["open", "Open"],
            ["in-progress", "In progress"],
            ["handled", "Handled"],
            ["dismissed", "Dismissed"],
            ["all", "All findings"],
          ]
            .map(
              ([v, t]) =>
                `<option value="${v}" ${filter === v ? "selected" : ""}>${t}</option>`,
            )
            .join("")}</select></label>`
    }<a class="button" href="#/page=connections">Manage connections</a>${reviewedMetric ? '<a class="button quiet" href="#/page=priorities">Back to priorities</a>' : ""}</div>${
      rows.length
        ? `<div class="conversation-list" role="region" aria-label="Conversations">${rows
            .map(({ c, items }) => {
              const f = items[0];
              return `<button class="conversation-row" data-action="open-finding" data-id="${e(f?.id || "")}" data-conversation="${c.id}"><span class="row-person">${e(c.customer?.name || "Customer")} <span class="muted">${c.customer?.company ? "· " + e(c.customer.company) : ""}</span></span><span class="row-title">${e(f?.title || c.subject || "Reviewed conversation")}</span><span class="row-summary">${e(f?.summary || "No finding identified in the reviewed evidence.")}</span><span class="row-meta">${f ? `<span class="priority ${e(f.priority)}">${e(priorities[f.priority])}</span><span>${e(f.owner || "Unassigned")}</span><span>${e(labels[f.status])}${f.analysis_current === false ? " · Not in latest review" : ""}</span>${items.length > 1 ? `<span>${items.length} findings</span>` : ""}` : "<span>Reviewed · No finding</span>"}</span></button>`;
            })
            .join("")}</div>`
        : `<section class="live-empty"><h2>${workspaceData.conversations?.length ? "No findings match this view" : "Your conversations, in focus"}</h2><p>${workspaceData.conversations?.length ? "Try another status or search. A reviewed conversation can have no finding; it still contributes to your coverage." : "Authorize a source, then run your first analysis. Mach 1 will inspect the available conversations and link each finding to its evidence."}</p><a class="button primary" href="#/page=connections">${workspaceData.conversations?.length ? "Review connections" : "Run your first analysis"}</a></section>`
    }${coverage()}`
  );
}
function overviewView() {
  const convs = workspaceData.conversations || [],
    findings = (workspaceData.findings || []).filter((f) =>
      convs.some((c) => c.id === f.conversation_id),
    ),
    active = findings.filter(isActive);
  const open = new Set(active.map((f) => f.conversation_id)).size;
  const runs = workspaceData.runs || [];
  const firstDate = convs
    .map((c) => c.reviewed_at)
    .filter(Boolean)
    .sort()[0];
  return (
    heading(
      "Team overview",
      "Where the team needs help",
      "An evidence-based view of the conversations your workspace has reviewed.",
    ) +
    `<p class="overview-brief">${open} of ${convs.length} reviewed conversations have open findings. Use the underlying messages to decide where a clearer answer or owner could help.</p><div class="metrics-grid live-metrics"><a class="metric" href="#/page=priorities&metric=reviewed"><span class="metric-value">${convs.length}</span><span class="metric-label">Conversations reviewed ↗</span></a><a class="metric" href="#/page=priorities&metric=open"><span class="metric-value">${open}</span><span class="metric-label">Conversations with open findings ↗</span></a><a class="metric" href="#/page=connections"><span class="metric-value">${session.connections.filter((c) => c.status !== "disconnected").length}</span><span class="metric-label">Authorized sources ↗</span></a></div><p class="coverage-note">${firstDate ? "Review coverage begins " + e(dateLabel(firstDate)) + ". " : "No review period is available yet. "}Each count represents distinct conversations or sources. No customer outcomes or revenue impact are inferred.</p><section class="overview-section"><div class="section-heading"><h2>Patterns in open findings</h2></div><div class="pattern-list">${
      ["unanswered", "repeat", "promise", "handoff", "objection"]
        .map((type) => {
          const count = new Set(
            active.filter((f) => f.type === type).map((f) => f.conversation_id),
          ).size;
          return count
            ? `<article class="pattern-row"><div><h3>${e({ unanswered: "Questions awaiting an answer", repeat: "Repeated unresolved requests", promise: "Commitments to review", handoff: "Handoffs needing ownership", objection: "Buying concerns to address" }[type])}</h3><p>${count} of ${convs.length} reviewed conversations have this open finding.</p></div><a class="button" href="#/page=priorities&metric=${type}">Review conversations →</a></article>`
            : "";
        })
        .join("") ||
      '<p class="empty-state">Patterns will appear when reviewed conversations contain open findings.</p>'
    }</div></section><section class="overview-section"><div class="section-heading"><h2>Analysis history</h2></div><ul class="scan-history">${
      runs
        .slice(0, 10)
        .map(
          (run) =>
            `<li>${e(run.status)} · ${Number(run.reviewed_count) || 0} conversations reviewed${run.skipped_count ? ` · ${Number(run.skipped_count)} skipped (no eligible messages)` : ""}<small>${e(dateLabel(run.started_at))}${run.has_more ? " · More records remain" : ""}${run.error ? " · " + e(run.error) : ""}</small></li>`,
        )
        .join("") || "<li>No analysis runs yet.</li>"
    }</ul></section>` +
    coverage()
  );
}
function connectionsPage() {
  return (
    heading(
      "Workspace sources",
      "Connect your conversations",
      "Authorize the sources you want Mach 1 to analyze. Each source can be disconnected at any time.",
    ) +
    readiness() +
    `${scanConnection ? '<div class="run-progress" role="status"><strong>Reading and evaluating the next batch</strong><p>This is a real analysis request. Results will appear when the source and Jev return. Please keep this page open.</p></div>' : ""}<div class="connector-options live-connection-list">${catalog()
      .map((c) => connectorCard(c))
      .join(
        "",
      )}</div><p class="privacy-note">Scanning sends the selected source’s conversation text to the configured AI evaluation service. Each run is bounded; partial coverage is shown explicitly. Your original messages are not changed or sent to customers.</p>${coverage()}`
  );
}
function sourceLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      ? `<a class="button" href="${e(url.href)}" target="_blank" rel="noopener noreferrer">Open original conversation ↗</a>`
      : "";
  } catch {
    return "";
  }
}
function evidenceMessage(m, evidence = []) {
  let text = e(m.text);
  for (const q of evidence.filter((x) => x.messageId === m.id)) {
    if (q.quote && m.text.includes(q.quote))
      text = text.replace(e(q.quote), `<mark>${e(q.quote)}</mark>`);
  }
  return `<article class="message"><div class="message-header"><strong>${e(m.sender)}</strong><time datetime="${e(m.at)}">${e(dateLabel(m.at))}</time></div><p class="message-text">${text}</p></article>`;
}
function activityText(a) {
  if (a.action === "reopened_new_evidence")
    return `Reopened for review after new conversation evidence. Previous status: ${labels[a.previous_status] || a.previous_status}.${a.previous_outcome ? " Previous outcome: " + a.previous_outcome : ""}${a.previous_dismiss_reason ? " Previous reason: " + a.previous_dismiss_reason : ""}`;
  const label =
    a.text ||
    (a.draft_updated
      ? "Draft saved"
      : a.changes?.status
        ? "Status changed to " + (labels[a.changes.status] || a.changes.status)
        : Object.hasOwn(a.changes || {}, "owner")
          ? "Owner changed to " + (a.changes.owner || "Unassigned")
          : "Finding updated");
  return (
    label +
    (a.changes?.outcome
      ? ": " + a.changes.outcome
      : a.changes?.dismiss_reason
        ? ": " + a.changes.dismiss_reason
        : "")
  );
}
function findingPage(id) {
  const f = workspaceData.findings.find((f) => f.id === id);
  const conversationId = new URLSearchParams(
    location.hash.replace(/^#\/?/, ""),
  ).get("conversation");
  const c = workspaceData.conversations.find(
    (c) => c.id === (f?.conversation_id || conversationId),
  );
  if (!c)
    return (
      heading(
        "Workspace",
        "Conversation unavailable",
        "This record may have changed or is not part of your workspace.",
      ) + '<a class="button" href="#/page=priorities">Back to priorities</a>'
    );
  const messages = Array.isArray(c.messages) ? c.messages : [];
  return `<section class="live-detail"><a class="button quiet" href="#/page=priorities">← Back to conversations</a><p class="eyebrow">${e(c.customer?.name || "Customer")} ${c.customer?.company ? "· " + e(c.customer.company) : ""}</p><h1 tabindex="-1">${e(f?.title || c.subject)}</h1>${f ? `<div class="detail-meta"><span class="priority ${e(f.priority)}">${e(priorities[f.priority])}</span><span class="pill">${e(labels[f.status])}</span>${f.analysis_current === false ? '<span class="pill">Not observed in the latest review</span>' : ""}</div><p>${e(f.summary)}</p><section class="detail-section"><h2>Why this needs attention</h2><p>${e(f.reason)}</p>${f.priority === "review" ? '<p class="boundary-note">The interpretation is uncertain. Review the source before acting.</p>' : ""}</section>` : "<p>No finding was identified in this reviewed conversation.</p>"}<section class="detail-section"><h2>Conversation evidence</h2>${sourceLink(c.source_url)}${c.analysis_coverage?.truncated ? '<p class="boundary-note">The analysis used a bounded portion of this conversation. Review the full source before drawing conclusions.</p>' : ""}${messages
    .filter((m) => !f || f.evidence.some((q) => q.messageId === m.id))
    .map((m) => evidenceMessage(m, f?.evidence))
    .join(
      "",
    )}${f ? `<details class="context-thread"><summary>View reviewed conversation (${messages.length} messages)</summary>${messages.map((m) => evidenceMessage(m, f.evidence)).join("")}</details>` : ""}</section>${
    f
      ? `<nav class="related-findings" aria-label="Findings in this conversation">${workspaceData.findings
          .filter((item) => item.conversation_id === c.id)
          .map(
            (item) =>
              `<a href="#/page=finding&finding=${e(item.id)}" ${item.id === f.id ? 'aria-current="page"' : ""}>${e(item.title)} <span class="muted">${e(labels[item.status])}</span></a>`,
          )
          .join(
            "",
          )}</nav><section class="detail-section"><h2>Suggested next step</h2><p>${e(f.suggestion)}</p><div class="draft-editor"><label for="customer-draft">Follow-up draft</label><textarea id="customer-draft" rows="7" maxlength="10000" data-id="${f.id}">${e(draftEdits.get(f.id) ?? f.draft ?? "")}</textarea><p class="draft-note">Review the source and replace placeholders. Nothing is sent from this workspace.</p><div class="action-row"><button class="button primary" data-action="save-draft" data-id="${f.id}">Save draft</button><button class="button" data-action="copy-draft">Copy draft</button></div></div></section><section class="detail-section"><h2>Ownership & outcome</h2><form id="finding-form" data-id="${f.id}"><label class="field">Owner<select name="owner"><option value="" ${!f.owner ? "selected" : ""}>Unassigned</option><option value="${e(session.user.email)}" ${f.owner === session.user.email ? "selected" : ""}>Me (${e(session.user.email)})</option></select></label><label class="field">Status<select name="status">${Object.entries(
          labels,
        )
          .map(
            ([v, l]) =>
              `<option value="${v}" ${f.status === v ? "selected" : ""}>${l}</option>`,
          )
          .join(
            "",
          )}</select></label><label class="field">Outcome or reason<textarea name="note" rows="3" maxlength="1000" placeholder="Required when marking handled or dismissing">${e(f.status === "handled" ? f.outcome : f.status === "dismissed" ? f.dismiss_reason : "")}</textarea></label><p class="draft-note">Handled records the team’s action, not customer-confirmed success. Dismissed records a review decision, not an improved outcome.</p><div class="action-row"><button class="button" type="submit">Save changes</button></div></form><ol class="activity-list">${[
          ...(f.activity || []),
        ]
          .reverse()
          .map(
            (a) =>
              `<li>${e(activityText(a))}<time>${e(dateLabel(a.at))}</time></li>`,
          )
          .join("")}</ol></section>`
      : ""
  }</section>`;
}
function render(focus = false) {
  const active = document.activeElement;
  const inputSelection =
    active?.id === "live-search" ? active.selectionStart : null;
  if (!config || !session) {
    root.innerHTML =
      header() +
      `<main id="main-content" class="empty-state"><h1>${currentError ? "Unable to load your workspace" : "Opening Mach 1"}</h1><p>${e(currentError || "Checking your account and workspace…")}</p>${currentError ? '<button class="button" data-action="retry">Try again</button>' : ""}</main>`;
    return;
  }
  if (!session.user || mode === "reset") {
    root.innerHTML = authView();
  } else if (!session.workspace?.lens) {
    root.innerHTML =
      route().page === "role" &&
      session.connections?.some((c) => c.status === "authorized")
        ? roleView()
        : connectorsView();
  } else if (!workspaceData) {
    root.innerHTML =
      header() +
      `<main id="main-content" class="empty-state"><h1>Opening your workspace</h1>${notice()}<button class="button" data-action="retry">Retry</button></main>`;
  } else {
    const { page, finding, metric } = route();
    if (metric === "open") filter = "active";
    let content;
    if (page === "overview") content = overviewView();
    else if (page === "connections") content = connectionsPage();
    else if (page === "finding") content = findingPage(finding);
    else {
      const priorFilter = filter;
      let original = workspaceData.findings;
      if (
        ["unanswered", "repeat", "promise", "handoff", "objection"].includes(
          metric,
        )
      ) {
        workspaceData.findings = original.filter(
          (f) => f.type === metric && isActive(f),
        );
        filter = "active";
      }
      content = prioritiesView();
      workspaceData.findings = original;
      filter = priorFilter;
    }
    root.innerHTML = shell(
      content,
      ["overview", "connections"].includes(page) ? page : "priorities",
    );
  }
  if (focus) document.querySelector("h1")?.focus();
  else if (inputSelection !== null) {
    const input = document.querySelector("#live-search");
    input?.focus();
    input?.setSelectionRange(inputSelection, inputSelection);
  }
}
async function bootstrap() {
  try {
    currentError = "";
    config = await api("config");
    session = await api("session");
    if (session.user && !session.workspace) {
      await api("workspace", { name: "My workspace" });
      session = await api("session");
    }
    if (session.user && session.workspace?.lens)
      workspaceData = await api("workspace");
    render(true);
  } catch (error) {
    currentError = error.message;
    render();
  }
}
async function task(fn) {
  if (busy) return;
  busy = true;
  currentError = "";
  const active = document.activeElement;
  const pendingButton =
    active?.closest("form")?.querySelector('button[type="submit"]') ||
    active?.closest("button");
  const priorLabel = pendingButton?.textContent;
  const priorDisabled = pendingButton?.disabled;
  const form = active?.closest("form");
  const values = form ? [...new FormData(form)] : [];
  if (pendingButton) {
    pendingButton.disabled = true;
    pendingButton.textContent = "Please wait…";
  }
  try {
    await fn();
  } catch (error) {
    currentError = error.message;
    render();
    if (form) {
      const restored = document.getElementById(form.id);
      for (const [name, value] of values) {
        const field = restored?.elements.namedItem(name);
        if (field && field.type !== "password") field.value = value;
      }
    }
  } finally {
    busy = false;
    if (pendingButton?.isConnected) {
      pendingButton.disabled = priorDisabled;
      pendingButton.textContent = priorLabel;
    }
    for (const button of document.querySelectorAll("[data-action=connect]"))
      button.disabled = !catalog().find((c) => c.id === button.dataset.provider)
        ?.ready;
    const roleSubmit = document.querySelector("#role-form button[type=submit]");
    if (roleSubmit) {
      roleSubmit.disabled = false;
      roleSubmit.textContent = "Open my workspace";
    }
    const submit = document.querySelector("#auth-form button[type=submit]");
    if (submit) {
      submit.disabled =
        mode === "reset"
          ? false
          : mode === "sso"
            ? !config?.auth?.sso
            : !config?.auth?.email;
      submit.textContent =
        mode === "login"
          ? "Sign in"
          : mode === "signup"
            ? "Get Started"
            : "Continue";
    }
  }
}
root.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, provider } = button.dataset;
  if (action === "auth-mode") {
    mode = button.dataset.mode;
    currentError = "";
    render(true);
    return;
  }
  if (action === "retry") {
    bootstrap();
    return;
  }
  if (action === "next-role") {
    go("role");
    return;
  }
  if (action === "back-connectors") {
    go("connectors");
    return;
  }
  if (action === "open-finding") {
    go(
      "finding",
      id ? { finding: id } : { conversation: button.dataset.conversation },
    );
    return;
  }
  if (action === "copy-draft") {
    const input = document.querySelector("#customer-draft");
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(input.value))
      .then(() => flash("Draft copied. Nothing has been sent."))
      .catch(() => {
        input.select();
        flash("Use your keyboard to copy the selected draft.");
      });
    return;
  }
  task(async () => {
    if (action === "oauth") {
      const result = await api("auth.oauth", { provider });
      location.assign(result.url);
    }
    if (action === "logout") {
      await api("auth.logout", {});
      draftEdits.clear();
      workspaceData = null;
      mode = "login";
      session = null;
      await bootstrap();
    }
    if (action === "connect") {
      let connectorConfig = {};
      if (provider === "zendesk") {
        const subdomain = prompt(
          "Your Zendesk subdomain (the part before .zendesk.com):",
        );
        if (!subdomain) return;
        connectorConfig = { subdomain };
      }
      const result = await api("connector.start", {
        provider,
        config: connectorConfig,
      });
      location.assign(result.url);
    }
    if (action === "disconnect") {
      if (
        !confirm(
          "Disconnect this source? Mach 1 will stop using its authorization. Existing reviewed records will remain in your workspace.",
        )
      )
        return;
      await api("connector.disconnect", { id });
      await bootstrap();
      flash("Source disconnected.");
    }
    if (action === "scan") {
      if (
        !confirm(
          "Analyze the next batch of conversations from this source with Jev? Conversation text will be processed by the configured AI service.",
        )
      )
        return;
      scanConnection = id;
      render();
      try {
        await api("scan", { connectionId: id });
        await bootstrap();
        flash(
          "Analysis request completed. Review the run history for coverage.",
        );
      } catch (error) {
        workspaceData = await api("workspace").catch(() => workspaceData);
        throw error;
      } finally {
        scanConnection = null;
        render();
      }
    }
    if (action === "save-draft") {
      await api("finding.update", {
        id,
        draft: document.querySelector("#customer-draft").value,
      });
      workspaceData = await api("workspace");
      flash("Draft saved. Nothing has been sent.");
    }
  });
});
root.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  task(async () => {
    if (form.id === "auth-form") {
      const kind = form.dataset.mode;
      const action = {
        signup: "auth.signup",
        login: "auth.login",
        recover: "auth.recover",
        reset: "auth.password",
        sso: "auth.sso",
      }[kind];
      const result = await api(action, values);
      form.querySelector("[name=password]")?.value &&
        (form.querySelector("[name=password]").value = "");
      if (result.url) {
        location.assign(result.url);
        return;
      }
      if (kind === "recover" || result.confirmationRequired) {
        flash(
          kind === "recover"
            ? "If an eligible account exists, a reset email has been requested. Open the link in this browser."
            : "Check your email and open the confirmation link in this browser before signing in.",
        );
        mode = "login";
        render();
        return;
      }
      mode = "login";
      await bootstrap();
    }
    if (form.id === "role-form") {
      await api("workspace", { lens: values.lens });
      go("priorities");
      await bootstrap();
    }
    if (form.id === "finding-form") {
      const patch = {
        id: form.dataset.id,
        status: values.status,
        owner: values.owner || null,
      };
      if (values.status === "handled") {
        if (!values.note.trim())
          throw new Error("Record an outcome before marking this handled.");
        patch.outcome = values.note.trim();
      }
      if (values.status === "dismissed") {
        if (!values.note.trim())
          throw new Error("Record a reason before dismissing this finding.");
        patch.dismissReason = values.note.trim();
      }
      await api("finding.update", patch);
      workspaceData = await api("workspace");
      render();
      flash("Finding updated. No message has been sent.");
    }
  });
});
root.addEventListener("input", (event) => {
  if (event.target.id === "live-search") {
    search = event.target.value;
    render();
  }
  if (event.target.id === "customer-draft")
    draftEdits.set(event.target.dataset.id, event.target.value);
});
root.addEventListener("change", (event) => {
  if (event.target.id === "live-filter") {
    filter = event.target.value;
    if (route().metric) go("priorities");
    else render();
  }
});
let previousMetric = route().metric;
window.addEventListener("hashchange", () => {
  currentError = "";
  const metric = route().metric;
  if (metric !== previousMetric) {
    search = "";
    filter = "active";
  }
  previousMetric = metric;
  render(true);
});
window.addEventListener("beforeunload", (event) => {
  const pending = [...draftEdits].some(
    ([id, value]) =>
      workspaceData?.findings.find((f) => f.id === id)?.draft !== value,
  );
  if (pending) {
    event.preventDefault();
    event.returnValue = "";
  }
});
const callback = new URLSearchParams(location.search);
if (callback.get("recovery") === "1") mode = "reset";
if (callback.has("error")) {
  currentError = "Sign-in or authorization did not complete. Please try again.";
  history.replaceState(null, "", location.pathname + location.hash);
}
// Preserve shared links from the earlier sample hosted at /app.
if (/^#\/(?:support|sales|app)(?:\/|$)/.test(location.hash)) {
  location.replace(`sample.html${location.hash}`);
} else {
  render();
  bootstrap().then(() => {
    if (callback.has("error")) {
      currentError =
        "Sign-in or authorization did not complete. Please try again.";
      render();
    }
  });
}
