const root = document.querySelector("#preview-main");
const tools = [
  ["gmail", "Gmail", "Customer conversations"],
  ["zendesk", "Zendesk", "Support, in one place"],
  ["hubspot", "HubSpot", "A clearer customer picture"],
  ["intercom", "Intercom", "Every customer interaction"],
  ["salesforce", "Salesforce", "Your pipeline, connected"],
  ["slack", "Slack", "The context from your team"],
];
const storageKey = "mach1.preview.setup.v1";
let selected = new Set(
    new URLSearchParams(location.search).get("focus") === "sales"
      ? ["gmail", "hubspot"]
      : ["gmail", "zendesk"],
  ),
  lens =
    new URLSearchParams(location.search).get("focus") === "sales"
      ? "sales"
      : "support";
let saved = false;
try {
  const value = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (value?.tools?.length) {
    selected = new Set(
      value.tools.filter((id) => tools.some((t) => t[0] === id)),
    );
    if (!selected.size) selected.add("gmail");
  }
  if (!location.search && ["support", "sales"].includes(value?.lens))
    lens = value.lens;
} catch {}
const icon = (name, size = 20) => window.icon(name, size);
const route = () =>
  ["tools", "focus", "ready"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "welcome";
const go = (step) => {
  location.hash = step;
};
function progress(step) {
  return `<nav class="step-track" aria-label="Preview setup"><a href="#welcome" aria-label="Back to welcome">${icon("chevrons-left", 15)}</a><ol>${[
    ["tools", "Your tools"],
    ["focus", "Your focus"],
    ["ready", "Your workspace"],
  ]
    .map(
      ([id, label], i) =>
        `<li ${step === id ? 'aria-current="step"' : ""}><span>${i + 1}</span>${label}</li>`,
    )
    .join("")}</ol></nav>`;
}
function sampleCard() {
  return `<div class="welcome-product" aria-label="A glimpse of your sample workspace"><div class="mini-top"><img src="assets/brand/mach1-mark.png" alt="" width="24"><span>My workspace</span><span class="mini-sample">Sample</span></div><div class="mini-content"><p class="mini-eyebrow">A CLEARER START</p><h2>Good morning, Alex.</h2><p>Here’s where a little attention goes a long way.</p><div class="mini-priority"><div class="priority-top"><span class="status-dot"></span>Needs your attention<span>3h</span></div><div class="mini-customer"><span class="avatar">MC</span><div><strong>Maya Chen</strong><small>A customer is waiting for an answer.</small></div></div><blockquote>“Thanks, but I still cannot sign in. How do I restore access?”</blockquote><div class="mini-bottom"><span>${icon("message-square", 16)} Source evidence included</span><a class="mini-action" href="sample.html#/support/priorities?conversation=support-maya&finding=support-maya-access">See why ${icon("chevrons-right", 15)}</a></div></div><div class="mini-secondary"><span class="soft-icon">${icon("users", 19)}</span><div><strong>A clearer next step.</strong><span>The context you need. The control you want.</span></div></div></div><div class="mini-footer">Your conversations. A little more clarity.</div></div>`;
}
function welcome() {
  return `<section class="welcome-layout"><div class="welcome-copy"><p class="eyebrow">MEET MACH 1</p><h1 tabindex="-1">Less noise.<br>More <span>momentum.</span></h1><p class="intro">Know what needs attention.<br>See why. Move it forward.</p><p class="welcome-description">A calmer way to work through your customer conversations. Take a look around a workspace made for you.</p><button class="primary" data-next="tools">Make it yours ${icon("chevrons-right", 18)}</button><a class="quiet-link" href="sample.html#/${lens}/priorities">Just let me explore <span aria-hidden="true">→</span></a><div class="welcome-reassurance"><span>${icon("lock", 14)} No sign-up</span><span>${icon("history", 14)} About a minute</span></div></div>${sampleCard()}</section>`;
}
function toolsView() {
  return `${progress("tools")}<section class="setup-panel"><div class="setup-heading"><span class="step-symbol">${icon("plug", 25)}</span><p class="eyebrow">01 / YOUR TOOLS</p><h1 tabindex="-1">Start with what you know.</h1><p>Your conversations already live somewhere.<br>Choose the tools you’d like to see in your workspace.</p></div><div class="tool-grid" role="group" aria-label="Choose your sample tools">${tools.map(([id, name, description]) => `<button class="tool-card" data-tool="${id}" aria-pressed="${selected.has(id)}"><img src="assets/connectors/${id}.svg" alt="" width="31" height="31"><span><strong>${name}</strong><small>${description}</small></span><span class="selection-indicator" aria-hidden="true">${selected.has(id) ? "✓" : "+"}</span></button>`).join("")}</div><p class="setup-note">This is a preview. No accounts are connected.</p><div class="setup-bottom"><span id="tool-count">${selected.size} ${selected.size === 1 ? "tool" : "tools"} selected</span><button class="primary" data-next="focus" ${selected.size ? "" : "disabled"}>Continue ${icon("chevrons-right", 18)}</button></div></section>`;
}
function focusView() {
  return `${progress("focus")}<section class="setup-panel focus-panel"><div class="setup-heading"><span class="step-symbol">${icon("sliders-horizontal", 25)}</span><p class="eyebrow">02 / YOUR FOCUS</p><h1 tabindex="-1">What does a good day look like?</h1><p>Give your workspace a focus.<br>We’ll bring the right conversations to the front.</p></div><fieldset class="focus-grid"><legend class="sr-only">Choose your workspace focus</legend><label class="focus-option"><input type="radio" name="focus" value="support" ${lens === "support" ? "checked" : ""}><span class="focus-icon">${icon("message-square", 27)}</span><strong>Happier customers.</strong><span class="focus-role">I work in support</span><p>Find the questions, promises, and handoffs that need a human touch.</p><span class="focus-example">“Who’s still waiting for help?”</span></label><label class="focus-option"><input type="radio" name="focus" value="sales" ${lens === "sales" ? "checked" : ""}><span class="focus-icon">${icon("chart-column", 27)}</span><strong>More conversations<br> moving forward.</strong><span class="focus-role">I work in sales</span><p>Spot buying questions, unresolved concerns, and the next follow-up.</p><span class="focus-example">“What’s holding this deal back?”</span></label></fieldset><div class="setup-bottom"><a class="back-link" href="#tools">Back</a><button class="primary" data-next="ready">See my workspace ${icon("chevrons-right", 18)}</button></div></section>`;
}
function readyView() {
  return `${progress("ready")}<section class="ready-panel"><div class="ready-mark"><img src="assets/brand/mach1-mark.png" alt="" width="54"></div><p class="eyebrow">03 / MADE FOR YOUR DAY</p><h1 tabindex="-1">Your next clear step<br>starts here.</h1><p>We’ve put together a ${lens === "sales" ? "sales" : "support"} workspace for you.<br>Realistic conversations. Clear evidence. Room to explore.</p><div class="workspace-ticket"><div class="ticket-heading"><span class="soft-icon">${icon(lens === "sales" ? "chart-column" : "message-square", 22)}</span><div><strong>Your ${lens} workspace</strong><span>A guided first look at Mach 1</span></div><span class="ticket-badge">Ready</span></div><div class="ticket-tools"><span>Your selected tools</span><div>${tools
    .filter((t) => selected.has(t[0]))
    .map(
      ([id, name]) =>
        `<img src="assets/connectors/${id}.svg" alt="${name}" title="${name}" width="24" height="24">`,
    )
    .join(
      "",
    )}</div></div><p class="ticket-tip">Start with a conversation. See the evidence.<br>Try a thoughtful next step.</p></div><button class="primary ready-cta" data-open>Open my workspace ${icon("chevrons-right", 18)}</button><a class="quiet-link" href="#focus">Change my focus</a></section>`;
}
function persist() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ tools: [...selected], lens }),
    );
    saved = true;
  } catch {
    saved = false;
  }
}
function render(focus = true) {
  const step = route();
  root.className = `preview-main stage-${step}`;
  root.innerHTML =
    step === "tools"
      ? toolsView()
      : step === "focus"
        ? focusView()
        : step === "ready"
          ? readyView()
          : welcome();
  document.title = `${{ welcome: "Welcome", tools: "Your tools", focus: "Your focus", ready: "Ready for your day" }[step]} · Mach 1`;
  if (focus) {
    root.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}
root.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.next) {
    if (button.dataset.next === "focus" && !selected.size) return;
    persist();
    go(button.dataset.next);
  }
  if (button.dataset.tool) {
    const id = button.dataset.tool;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    persist();
    render(false);
    root.querySelector(`[data-tool="${id}"]`)?.focus();
    document.querySelector("#setup-status").textContent =
      `${selected.size} tools selected`;
  }
  if (button.hasAttribute("data-open")) {
    persist();
    button.disabled = true;
    button.innerHTML = "Opening your workspace…";
    location.assign(`sample.html#/${lens}/priorities`);
  }
});
root.addEventListener("change", (event) => {
  if (event.target.name === "focus") {
    lens = event.target.value;
    persist();
  }
});
window.addEventListener("hashchange", () => {
  if (["focus", "ready"].includes(route()) && !selected.size) {
    go("tools");
    return;
  }
  render();
});
render(false);

document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  root.querySelector("h1")?.focus();
});
