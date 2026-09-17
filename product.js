/* Mach 1 product demo — admin shell, router, views. No backend. */
(() => {
  'use strict';
  if (typeof window.icon !== 'function') {
    window.icon = function (n, s) {
      s = s || 16;
      return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true"></svg>';
    };
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- tiny DOM helpers ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (v !== null && v !== undefined) el.setAttribute(k, v);
    }
    for (const k of kids.flat()) {
      if (k === null || k === undefined) continue;
      el.append(k.nodeType ? k : document.createTextNode(k));
    }
    return el;
  }
  function pageHead(title, sub) {
    const wrap = h('div', { class: 'page-head' }, h('h1', {}, title));
    if (sub) wrap.append(h('p', { class: 'lede-sm' }, sub));
    return wrap;
  }
  function toast(msg) {
    const box = $('#toasts');
    const el = h('p', { class: 'toast', role: 'status' }, msg);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3400);
  }

  /* ---------- Nav (matches reference admin exactly) ---------- */
  const NAV = [
    { sec: 'Agent', items: [
      { tab: 'home', label: 'Home', icon: 'home' },
      { tab: 'tower', label: 'Tower', icon: 'tower-control' },
      { tab: 'use', label: 'Use Agent', icon: 'message-square' },
      { tab: 'interactions', label: 'Interactions', icon: 'arrow-right-left' },
      { tab: 'analyses', label: 'Analyses', icon: 'folder' },
    ] },
    { sec: 'Context', items: [
      { tab: 'instructions', label: 'Instructions', icon: 'list' },
      { tab: 'context', label: 'Manage', icon: 'file-text' },
      { tab: 'usage', label: 'Usage', icon: 'chart-column' },
      { tab: 'improvements', label: 'Improvements', icon: 'history' },
    ] },
    { sec: 'Workflows', items: [
      { tab: 'wf-start', label: 'Start', icon: 'square-play' },
      { tab: 'wf-manage', label: 'Manage', icon: 'workflow' },
      { tab: 'wf-runs', label: 'Runs', icon: 'align-start-vertical' },
      { tab: 'wf-tasks', label: 'Tasks', icon: 'calendar' },
      { tab: 'wf-memories', label: 'Memories', icon: 'brain' },
      { tab: 'wf-docs', label: 'Documentation', icon: 'book-open' },
    ] },
    { sec: 'Settings', items: [
      { tab: 'team', label: 'Team', icon: 'users' },
      { tab: 'agent-settings', label: 'Agent Settings', icon: 'sliders-horizontal' },
      { tab: 'connections', label: 'Connections', icon: 'plug' },
      { tab: 'channels', label: 'Channels', icon: 'hash' },
      { tab: 'mcp', label: 'MCP Settings', icon: 'layers' },
      { tab: 'secrets', label: 'Workflow Secrets', icon: 'lock' },
      { tab: 'wf-settings', label: 'Workflow Settings', icon: 'settings-2' },
      { tab: 'api-keys', label: 'API Keys', icon: 'key-round' },
      { tab: 'agent-usage', label: 'Agent Usage', icon: 'chart-column' },
    ] },
  ];
  const TITLES = {};
  NAV.forEach((s) => s.items.forEach((i) => { TITLES[i.tab] = i.label; }));

  /* ---------- Catalog (brand icons via svgl API route URLs, local fallback) ----------
     Routes resolved via https://api.svgl.app?search=<title> (docs: https://svgl.app/docs/api).
     Uses each entry's canonical `route` file under https://svgl.app/library/ — the
     /library bytes keep xmlns so they render in <img>; the optimized /svg/ API
     endpoint strips xmlns and fails to decode. Stripe uses the icon (stripe.svg),
     not the wordmark, so it reads at tile size. */
  const CONNECTORS = [
    { id: 'front', name: 'Front', cat: 'Helpdesk', blurb: 'Sync tickets + shared inbox',
      perms: ['Read conversations and inboxes', 'Send replies as your team', 'Read tags, teammates, and rules'] },
    { id: 'whatsapp', name: 'WhatsApp', cat: 'Messaging', blurb: 'Sync support threads',
      perms: ['Read business message threads', 'Send template + session replies', 'Read contact profiles'] },
    { id: 'discord', name: 'Discord', cat: 'Community', blurb: 'Sync community chats',
      perms: ['Read support channel messages', 'Post answers in approved channels', 'Read member roles'] },
    { id: 'salesforce', name: 'Salesforce', cat: 'CRM', blurb: 'Sync accounts + opportunities',
      perms: ['Read accounts, contacts, opportunities', 'Create tasks and log calls', 'Update stages and fields'] },
    { id: 'apollo-io', name: 'Apollo.io', cat: 'Prospecting', blurb: 'Sync prospects + sequences',
      perms: ['Read contacts and sequences', 'Enroll prospects in approved steps', 'Log engagement back to CRM'] },
    { id: 'slack', name: 'Slack', cat: 'Comms', blurb: 'Sync channels + threads',
      perms: ['Read approved channels', 'Post escalations to crew channels', 'Send you DM summaries'] },
    { id: 'microsoft-teams', name: 'Teams', cat: 'Comms', blurb: 'Sync chats + meetings',
      perms: ['Read chats and meeting recaps', 'Post follow-ups in approved teams', 'Create meetings on request'] },
    { id: 'gmail', name: 'Gmail', cat: 'Comms', blurb: 'Sync inbox + labels',
      perms: ['Read support inbox threads', 'Send replies as your team', 'Apply labels and archive'] },
    { id: 'zoom', name: 'Zoom', cat: 'Comms', blurb: 'Sync recordings + transcripts',
      perms: ['Read cloud recordings', 'Summarize calls into CRM notes', 'Schedule follow-up meetings'] },
    { id: 'shopify', name: 'Shopify', cat: 'Commerce', blurb: 'Sync orders + products',
      perms: ['Read orders and customers', 'Issue refunds within guardrails', 'Read product catalog'] },
    { id: 'stripe', name: 'Stripe', cat: 'Billing', blurb: 'Sync invoices + charges',
      perms: ['Read invoices and subscriptions', 'Issue credits within guardrails', 'Read dispute status'] },
    { id: 'notion', name: 'Notion', cat: 'Knowledge', blurb: 'Sync docs + wikis',
      perms: ['Read help-center pages', 'Ground answers in your docs', 'Suggest doc updates'] },
    { id: 'linear', name: 'Linear', cat: 'Work', blurb: 'Sync issues + sprints',
      perms: ['Read issues and cycles', 'File bugs from tickets', 'Post status back to threads'] },
    { id: 'supabase', name: 'Supabase', cat: 'Warehouse', blurb: 'Sync tables + queries',
      perms: ['Read approved tables', 'Run saved analytics queries', 'Never writes without approval'] },
  ];
  const byId = (id) => CONNECTORS.find((c) => c.id === id);
  const SVG_API = 'https://svgl.app/library/';
  const SVG_FILE = {
    front: 'front.svg', whatsapp: 'whatsapp-icon.svg', discord: 'discord.svg',
    salesforce: 'salesforce.svg', 'apollo-io': 'apollo-io.svg', slack: 'slack.svg',
    'microsoft-teams': 'microsoft-teams.svg', gmail: 'gmail.svg', zoom: 'zoom.svg',
    shopify: 'shopify.svg', stripe: 'stripe.svg', notion: 'notion.svg',
    linear: 'linear.svg', supabase: 'supabase.svg',
  };
  const SVG_INIT = {
    front: 'F', whatsapp: 'W', discord: 'D', salesforce: 'S', 'apollo-io': 'Ap',
    slack: 'S', 'microsoft-teams': 'MT', gmail: 'G', zoom: 'Z', shopify: 'Sh',
    stripe: 'St', notion: 'N', linear: 'L', supabase: 'Su',
  };
  function logoImg(c, big) {
    const tile = h('span', { class: 'clogo loading' + (big ? ' big' : ''), 'aria-hidden': 'true' });
    const img = document.createElement('img');
    img.src = `${SVG_API}${SVG_FILE[c.id]}`;
    img.alt = '';
    img.loading = 'lazy';
    img.dataset.fb = `assets/connectors/${c.id}.svg`;
    img.dataset.init = SVG_INIT[c.id] || c.name.charAt(0);
    tile.appendChild(img);
    return tile;
  }
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fb) return;
    if (!img.dataset.fbk) {
      img.dataset.fbk = '1';
      img.src = img.dataset.fb;
    } else {
      const tile = img.closest('.clogo');
      if (!tile) return;
      tile.classList.remove('loading');
      tile.classList.add('fallback');
      tile.textContent = img.dataset.init || '';
    }
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fb) return;
    const tile = img.closest('.clogo');
    if (tile) tile.classList.remove('loading');
  }, true);

  /* ---------- Demo data ---------- */
  const ACTIVITY = [
    { text: '#4821 · Refund issued & customer notified', meta: 'Front · Support' },
    { text: 'Loopwork · Qualified & booked for tomorrow', meta: 'Salesforce · Sales' },
    { text: '#4822 · Draft ready for crew review', meta: 'WhatsApp · Copilot' },
    { text: 'Apollo.io · 14 prospects enriched & staged', meta: 'Apollo.io · Sales' },
    { text: 'Help center · 3 gaps flagged from real chats', meta: 'Notion · Support' },
    { text: 'CSAT 5/5 on #4819 · Follow-up closed loop', meta: 'Front · Support' },
    { text: '#4817 · Escalated to crew with full context', meta: 'Slack · Support' },
    { text: 'Loopwork · Moved to Negotiation, notes logged', meta: 'Salesforce · Sales' },
  ];
  const FLIGHTS = [
    { id: 'FL-1042', agent: 'Support', summary: '#4821 refund $48 · notified', result: 'Auto-resolved', time: '2m' },
    { id: 'FL-1041', agent: 'Sales', summary: 'Loopwork demo booked Tue 10:00', result: 'Booked', time: '9m' },
    { id: 'FL-1040', agent: 'Support', summary: '#4822 draft awaiting approval', result: 'Needs review', time: '18m' },
    { id: 'FL-1039', agent: 'Sales', summary: '14 Apollo.io prospects enriched', result: 'Synced', time: '32m' },
    { id: 'FL-1038', agent: 'Support', summary: '#4817 escalated · sentiment angry', result: 'Escalated', time: '3h' },
  ];
  const USAGE = { res: 82, resMax: 100, meet: 7, meetMax: 10 };
  const AGENTS = [
    { id: 'tower', name: 'Tower', desc: 'Unified orchestrator for knowledge, workflow, and both agents.', tags: ['orchestrator', 'knowledge', 'workflow'] },
    { id: 'support', name: 'Support Agent', desc: 'Resolves tickets in your voice. Escalates cleanly.', tags: ['support', 'tickets', 'copilot'] },
    { id: 'sales', name: 'Sales Agent', desc: 'Qualifies, follows up, and books. Logs everything to CRM.', tags: ['sales', 'pipeline', 'booking'] },
  ];
  const CHANNELS = [
    { id: 'chat', name: 'Chat widget', desc: 'On-site messenger for visitors and customers.' },
    { id: 'email', name: 'Email', desc: 'Support inbox + sales sequences.' },
    { id: 'slackc', name: 'Slack', desc: 'Crew escalations and summaries.' },
    { id: 'wac', name: 'WhatsApp', desc: 'Support threads on WhatsApp Business.' },
    { id: 'voice', name: 'Voice', desc: 'Pilot voice agent for inbound calls.' },
  ];
  const TEMPLATES = [
    { id: 'triage', name: 'Ticket triage', desc: 'Classify, prioritize, and route every new ticket.' },
    { id: 'followup', name: 'Lead follow-up', desc: 'Enroll new leads in a 5-touch sequence.' },
    { id: 'csat', name: 'CSAT recovery', desc: 'Chase low scores and reopen stuck threads.' },
  ];
  const DOCS = [
    { t: 'Quickstart: launch your pilot', d: 'Connect, set guardrails, go live in days.', go: 'connections' },
    { t: 'Designing guardrails', d: 'Thresholds, approvals, and escalation paths.', go: 'agent-settings' },
    { t: 'API reference', d: 'Flights, webhooks, and the REST API.', go: 'api-keys' },
    { t: 'Security whitepaper', d: 'SOC 2, residency, retention, SSO.', go: 'agent-usage' },
  ];

  /* ---------- State ---------- */
  const K = 'mach1.v1.';
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(K + k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch {} },
    clear() { Object.keys(localStorage).filter((k) => k.startsWith(K)).forEach((k) => { try { localStorage.removeItem(k); } catch {} }); },
  };
  const state = {
    get user() { return store.get('user', null); },
    get ob() { return store.get('onboarding', null); },
    get conns() { return store.get('connections', {}); },
    get agents() { return store.get('agents', null); },
    get plan() { return store.get('plan', 'pilot'); },
  };
  const onboarded = () => !!(state.ob && state.ob.complete);
  const addedIds = () => {
    const c = state.ob ? state.ob.connectors : [];
    return Array.isArray(c) ? c : [];
  };
  const connectedIds = () => Object.keys(state.conns).filter((id) => state.conns[id].status === 'connected');
  function ensureDefaults() {
    if (state.user && !state.ob) {
      store.set('onboarding', { step: 1, connectors: [], support: true, sales: false, mode: 'copilot', complete: false });
    }
    if (state.user && onboarded()) {
      const ob = state.ob;
      if (!state.agents) {
        store.set('agents', { support: ob.support !== false, sales: !!ob.sales, mode: ob.mode || 'copilot', threshold: 100 });
      }
      if (!Array.isArray(ob.connectors)) store.set('onboarding', { ...ob, connectors: [] });
    }
  }
  function getAgents() {
    const fb = { support: true, sales: false, mode: 'copilot', threshold: 100 };
    const a = state.agents;
    if (!a) { store.set('agents', { ...fb }); return { ...fb }; }
    return a;
  }
  function seed(key, val) {
    if (store.get(key, null) === null) store.set(key, val);
    return store.get(key, val);
  }
  function seedAll() {
    seed('runs', [
      { id: 'RN-881', wf: 'Ticket triage', status: 'Succeeded', time: '12m ago' },
      { id: 'RN-880', wf: 'Lead follow-up', status: 'Running', time: '26m ago' },
      { id: 'RN-879', wf: 'CSAT recovery', status: 'Succeeded', time: '1h ago' },
    ]);
    seed('workflows', { triage: true, followup: true, csat: false });
    seed('tasks', [
      { id: 'TK-1', text: '#4822 · Approve $48 refund draft', done: false },
      { id: 'TK-2', text: 'Loopwork · Confirm Tuesday demo invite', done: false },
      { id: 'TK-3', text: '#4817 · Review escalation summary', done: true },
    ]);
    seed('memories', [
      { k: 'vip.tier', v: 'Loopwork renews in March — white-glove routing' },
      { k: 'policy.refunds', v: 'Auto-approve refunds under $100 in Copilot' },
    ]);
    seed('secrets', [{ name: 'STRIPE_KEY', updated: 'Sep 12' }]);
    seed('keys', [{ id: 'fk_9d2…a41c', created: 'Sep 2', last: '2h ago' }]);
    seed('team', [
      { n: 'Alex Rivera', e: 'pilot@tracevision.com', r: 'Owner' },
      { n: 'Maya Chen', e: 'maya@tracevision.com', r: 'Admin' },
    ]);
    seed('channels', { chat: true, email: true, slackc: true, wac: false, voice: false });
    seed('mcp', { linear: true, github: false, postgres: false });
    seed('instructions', { prompt: 'You are the Mach 1 crew for this workspace. Answer in our voice: short, warm, precise. Never invent order numbers. Escalate angry customers with full context.', tone: 'Warm & concise' });
    seed('sources', [
      { n: 'Help Center', t: '12,480 articles synced', on: true },
      { n: 'Notion · Support wiki', t: '312 pages synced', on: true },
      { n: 'Front · Resolved tickets', t: '48,201 threads synced', on: false },
    ]);
    seed('improvements', [
      { id: 'IM-1', text: 'Add macro: “Where is my refund?” — asked 214× this week', state: 'open' },
      { id: 'IM-2', text: 'Help Center gap: SSO setup steps outdated', state: 'open' },
      { id: 'IM-3', text: 'Retire macro “Legacy pricing” — 0 uses in 90 days', state: 'open' },
    ]);
    seed('wsettings', { timeout: '120', retries: '3', concurrency: '5', retention: '90' });
    seed('sessions', []);
  }

  /* ---------- Router ---------- */
  const APP_TABS = NAV.flatMap((s) => s.items.map((i) => i.tab));
  const ROUTES = ['#/signin', '#/onboarding/connect', '#/onboarding/agents', ...APP_TABS.map((t) => `#/app/${t}`)];
  function obStep() {
    const ob = state.ob;
    return ob && ob.step === 2 ? '#/onboarding/agents' : '#/onboarding/connect';
  }
  function resolve(target) {
    if (!ROUTES.includes(target)) target = state.user ? (onboarded() ? '#/app/home' : obStep()) : '#/signin';
    if (!state.user && target !== '#/signin') { store.set('next', target); return '#/signin'; }
    if (state.user && !onboarded() && target.startsWith('#/app')) {
      store.set('next', target);
      return obStep();
    }
    if (state.user && onboarded() && (target === '#/signin' || target.startsWith('#/onboarding'))) {
      const next = store.get('next', null);
      store.set('next', null);
      return (next && next.startsWith('#/app/')) ? next : '#/app/home';
    }
    return target;
  }
  const SKIP_BY_ROUTE = { '#/signin': '#main', '#/onboarding/connect': '#mainConnect', '#/onboarding/agents': '#mainAgents' };
  function show(route) {
    ensureDefaults();
    $$('.modal').forEach((m) => { m.hidden = true; });
    $$('.view').forEach((v) => { v.hidden = true; });
    const mainSel = route.startsWith('#/app') ? '#mainApp' : SKIP_BY_ROUTE[route];
    document.querySelector('.skip').setAttribute('href', mainSel);
    document.body.classList.toggle('auth', !route.startsWith('#/app'));
    if (route === '#/signin') { $('#main').hidden = false; document.title = 'Mach 1 — Sign in'; }
    else if (route === '#/onboarding/connect') { $('#mainConnect').hidden = false; document.title = 'Mach 1 — Onboarding'; renderObGrid(); }
    else if (route === '#/onboarding/agents') { $('#mainAgents').hidden = false; document.title = 'Mach 1 — Onboarding'; syncObAgents(); }
    else if (route.startsWith('#/app')) {
      $('#viewApp').hidden = false;
      const tab = route.slice(6);
      document.title = `Mach 1 — ${TITLES[tab] || 'Workspace'}`;
      renderApp(tab);
    }
    closeSide();
    if (route !== '#/app/home' && feedTimer) { clearInterval(feedTimer); feedTimer = null; }
    const mainEl = document.querySelector(mainSel);
    if (mainEl && mainEl.focus) mainEl.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function go(route) {
    const dest = resolve(route);
    if (window.location.hash === dest) show(dest);
    else window.location.hash = dest;
  }
  function sync() {
    const raw = window.location.hash || '#/signin';
    const dest = resolve(raw);
    if (dest !== raw) history.replaceState(null, '', dest);
    closeMenus();
    show(dest);
  }
  window.addEventListener('hashchange', sync);

  /* ---------- Shell ---------- */
  function wsId() {
    const email = (state.user || {}).email || 'tracevision.com';
    return ((email.split('@')[1] || 'tracevision.com').split('.')[0] || 'tracevision').toLowerCase();
  }
  function wsName() {
    const id = wsId();
    return id.charAt(0).toUpperCase() + id.slice(1);
  }
  function renderSideNav(tab) {
    const nav = $('#sideNavList');
    nav.innerHTML = '';
    NAV.forEach((sec) => {
      nav.appendChild(h('h2', { class: 'side-sec' }, sec.sec));
      const ul = h('ul', { class: 'side-list' });
      sec.items.forEach((it) => {
        const a = h('a', { class: 'side-link', href: `#/app/${it.tab}`, 'data-tab': it.tab, 'aria-label': it.label, 'data-label': it.label, html: `${icon(it.icon, 16)}<span>${it.label}</span>` });
        if (it.tab === tab) a.setAttribute('aria-current', 'page');
        ul.appendChild(h('li', {}, a));
      });
      nav.appendChild(ul);
    });
  }
  function renderApp(tab) {
    const user = state.user;
    renderSideNav(tab);
    $('#crumbTitle').textContent = TITLES[tab] || 'Home';
    $('#wsPill').textContent = wsId();
    $('#wsId').textContent = wsId();
    $('#towerIcon').innerHTML = icon('tower-control', 16);
    syncRailToggle();
    $('#sideOpen').innerHTML = icon('panel-left', 18);
    $('#avatarBtn').textContent = user.avatar;
    $('#sideAvatar').textContent = user.avatar;
    $('#menuName').textContent = user.name;
    $('#menuEmail').textContent = user.email;
    $('#sideName').textContent = user.name;
    $('#sideEmail').textContent = user.email;
    (RENDER[tab] || RENDER.home)($('#tabBody'));
  }
  function closeMenus() {
    $('#avatarMenu').hidden = true;
    $('#avatarBtn').setAttribute('aria-expanded', 'false');
    $('#sideMenu').hidden = true;
    $('#sideMenuBtn').setAttribute('aria-expanded', 'false');
  }
  function closeSide() {
    $('#sideNav').classList.remove('open');
    $('#sideBackdrop').hidden = true;
  }
  function syncRailToggle() {
    if (typeof hideRailTip === 'function') hideRailTip();
    const mini = $('#sideNav').classList.contains('mini');
    const btn = $('#sideCollapse');
    btn.innerHTML = icon(mini ? 'chevrons-right' : 'chevrons-left', 16);
    const label = mini ? 'Expand sidebar' : 'Collapse sidebar';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('data-label', label);
    btn.setAttribute('aria-expanded', String(!mini));
    const wide = window.matchMedia('(min-width: 901px)').matches;
    $('#sideOpen').setAttribute('aria-label', wide && mini ? 'Expand sidebar' : 'Open navigation');
  }
  window.matchMedia('(min-width: 901px)').addEventListener('change', syncRailToggle);
  const railTip = $('#railTip');
  let railTipFor = null;
  function showRailTip(el) {
    if (!$('#sideNav').classList.contains('mini')) return;
    const label = el.getAttribute('data-label');
    if (!label) return;
    railTip.textContent = label;
    const r = el.getBoundingClientRect();
    railTip.style.left = (r.right + 12) + 'px';
    railTip.style.top = (r.top + r.height / 2) + 'px';
    railTip.style.transform = 'translateY(-50%)';
    railTip.hidden = false;
    requestAnimationFrame(() => railTip.classList.add('show'));
    railTipFor = el;
  }
  function hideRailTip() {
    railTip.classList.remove('show');
    railTip.hidden = true;
    railTipFor = null;
  }
  $('#sideNav').addEventListener('mouseover', (e) => {
    const t = e.target.closest('.side-link, #sideCollapse');
    if (t) { if (railTipFor !== t) { hideRailTip(); showRailTip(t); } }
    else hideRailTip();
  });
  $('#sideNav').addEventListener('mouseout', (e) => {
    if (railTipFor && !railTipFor.contains(e.relatedTarget)) hideRailTip();
  });
  $('#sideNav').addEventListener('focusin', (e) => {
    const t = e.target.closest('.side-link, #sideCollapse');
    if (t) showRailTip(t);
  });
  $('#sideNav').addEventListener('focusout', hideRailTip);
  document.addEventListener('scroll', hideRailTip, true);
  $('#avatarBtn').addEventListener('click', () => {
    const menu = $('#avatarMenu');
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    $('#avatarBtn').setAttribute('aria-expanded', String(open));
  });
  $('#sideMenuBtn').addEventListener('click', () => {
    const menu = $('#sideMenu');
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    $('#sideMenuBtn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.avatar-wrap') && !e.target.closest('.side-foot')) closeMenus();
  });
  $('#sideOpen').addEventListener('click', () => {
    $('#sideNav').classList.remove('mini');
    if (window.matchMedia('(max-width: 900px)').matches) {
      $('#sideNav').classList.add('open');
      $('#sideBackdrop').hidden = false;
    }
    syncRailToggle();
  });
  $('#sideBackdrop').addEventListener('click', closeSide);
  $('#sideCollapse').addEventListener('click', () => {
    hideRailTip();
    if (window.matchMedia('(max-width: 900px)').matches) closeSide();
    else $('#sideNav').classList.toggle('mini');
    syncRailToggle();
  });
  function signOut(msg) {
    store.clear();
    $$('.modal').forEach((m) => { m.hidden = true; });
    if (feedTimer) { clearInterval(feedTimer); feedTimer = null; }
    closeMenus();
    closeSide();
    toast(msg || 'Signed out. Demo reset.');
    go('#/signin');
  }
  $('#signOutBtn').addEventListener('click', () => signOut());
  $('#signOutBtn2').addEventListener('click', () => signOut());
  $('#resetDemo').addEventListener('click', () => signOut('Demo reset. Fresh runway.'));
  $('#resetDemo2').addEventListener('click', () => signOut('Demo reset. Fresh runway.'));

  /* ---------- Sign in ---------- */
  const params = new URLSearchParams(window.location.search);
  const signupEmail = params.get('email') || '';
  if (signupEmail) {
    $('#emailChip').hidden = false;
    $('#emailChipAddr').textContent = signupEmail;
  }
  function prettyName(email) {
    const local = (email.split('@')[0] || 'pilot').replace(/[._-]+/g, ' ').trim();
    return local.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Alex Rivera';
  }
  function initials(name) {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }
  $('#googleBtn').addEventListener('click', () => {
    const btn = $('#googleBtn');
    if (btn.disabled) return;
    btn.disabled = true;
    $('#googleLabel').innerHTML = '<span class="spin" aria-hidden="true"></span> Clearing you for takeoff…';
    setTimeout(() => {
      const email = signupEmail || 'pilot@tracevision.com';
      const name = signupEmail ? prettyName(signupEmail) : 'Alex Rivera';
      store.set('user', { name, email, avatar: initials(name), provider: 'google' });
      if (!state.ob) store.set('onboarding', { step: 1, connectors: [], support: true, sales: false, mode: 'copilot', complete: false });
      seedAll();
      btn.disabled = false;
      $('#googleLabel').textContent = 'Continue with Google';
      toast(`Welcome aboard, ${name.split(' ')[0]}.`);
      go('#/onboarding/connect');
    }, reduceMotion ? 60 : 900);
  });

  /* ---------- Onboarding ---------- */
  function obConnectors() {
    const ob = state.ob || { connectors: [] };
    return ob.connectors || [];
  }
  function renderObGrid() {
    const grid = $('#obGrid');
    const added = obConnectors();
    grid.innerHTML = '';
    CONNECTORS.forEach((c) => {
      const on = added.includes(c.id);
      const b = h('button', { type: 'button', class: 'conn-card', 'aria-pressed': String(on),
        'aria-label': `${c.name}, ${c.cat}, ${on ? 'added' : 'not added'}` });
      const txt = h('span', { class: 'conn-txt' }, h('strong', {}, c.name), h('small', {}, `${c.cat} · ${c.blurb}`));
      b.append(logoImg(c), txt, h('span', { class: 'add-pill' }, on ? '✓ Added' : '+ Add'));
      b.addEventListener('click', () => {
        const ob = state.ob;
        const list = obConnectors();
        if (list.includes(c.id)) {
          ob.connectors = list.filter((x) => x !== c.id);
        } else {
          ob.connectors = [...list, c.id];
          toast(`${c.name} added. We’ll sync history after takeoff.`);
        }
        store.set('onboarding', ob);
        renderObGrid();
      });
      grid.appendChild(b);
    });
    $('#obContinue').disabled = added.length === 0;
  }
  $('#obContinue').addEventListener('click', () => {
    const ob = state.ob;
    ob.step = 2;
    store.set('onboarding', ob);
    go('#/onboarding/agents');
  });
  $('#obSkip').addEventListener('click', () => {
    store.set('onboarding', { ...(state.ob || {}), step: 2 });
    go('#/onboarding/agents');
  });
  function setSwitch(el, on) { el.setAttribute('aria-checked', String(on)); }
  function syncObAgents() {
    const ob = state.ob || {};
    setSwitch($('#obSupport'), ob.support !== false);
    setSwitch($('#obSales'), !!ob.sales);
    const radio = document.querySelector(`input[name="obMode"][value="${ob.mode || 'copilot'}"]`);
    if (radio) radio.checked = true;
  }
  [['#obSupport', 'support'], ['#obSales', 'sales']].forEach(([sel, key]) => {
    $(sel).addEventListener('click', () => {
      const el = $(sel);
      const on = el.getAttribute('aria-checked') !== 'true';
      setSwitch(el, on);
      store.set('onboarding', { ...(state.ob || {}), [key]: on });
    });
  });
  $$('input[name="obMode"]').forEach((r) => {
    r.addEventListener('change', () => store.set('onboarding', { ...(state.ob || {}), mode: r.value }));
  });
  $('#obBack').addEventListener('click', () => {
    store.set('onboarding', { ...(state.ob || {}), step: 1 });
    go('#/onboarding/connect');
  });
  function launch(defaults) {
    const ob = { ...(state.ob || {}) };
    if (defaults) {
      if (ob.support === undefined) ob.support = defaults.support;
      if (ob.sales === undefined) ob.sales = defaults.sales;
      if (ob.mode === undefined) ob.mode = defaults.mode;
    }
    if (!Array.isArray(ob.connectors) || ob.connectors.length === 0) ob.connectors = ['front', 'salesforce'];
    ob.complete = true;
    store.set('onboarding', ob);
    store.set('agents', { support: ob.support !== false, sales: !!ob.sales, mode: ob.mode || 'copilot', threshold: 100 });
    const conns = {};
    ob.connectors.slice(0, 2).forEach((id) => { conns[id] = { status: 'connected', at: new Date().toISOString() }; });
    store.set('connections', conns);
    seedAll();
    const btn = $('#obLaunch');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Preparing your flight deck…';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = 'Launch workspace <span aria-hidden="true">→</span>';
      toast('Workspace ready. Welcome aboard.');
      const next = store.get('next', null);
      store.set('next', null);
      go(next && next.startsWith('#/app/') ? next : '#/app/home');
    }, reduceMotion ? 60 : 700);
  }
  $('#obLaunch').addEventListener('click', () => launch());
  $('#obSkip2').addEventListener('click', () => launch({ support: true, sales: false, mode: 'copilot' }));

  /* ---------- Modals ---------- */
  let lastFocus = null;
  function openModal(sel) {
    lastFocus = document.activeElement;
    const modal = $(sel);
    modal.hidden = false;
    const f = modal.querySelector('button, a, input');
    if (f) f.focus();
    modal.onkeydown = (e) => {
      if (e.key !== 'Tab') return;
      const items = $$('button, a[href], input, select', modal).filter((el) => !el.disabled && el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
  }
  function closeModal(sel) {
    $(sel).hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(`#${m.id}`); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach((m) => { if (!m.hidden) closeModal(`#${m.id}`); });
      closeMenus();
      if (window.matchMedia('(max-width: 900px)').matches) closeSide();
    }
  });
  $('#ssoBtn').addEventListener('click', () => openModal('#ssoModal'));
  $('#ssoCancel').addEventListener('click', () => closeModal('#ssoModal'));
  $('#ssoGoogle').addEventListener('click', () => { closeModal('#ssoModal'); $('#googleBtn').click(); });
  let formSubmit = null;
  function openForm({ title, ok, fields, onSubmit }) {
    $('#formTitle').textContent = title;
    $('#formOk').textContent = ok || 'Save';
    $('#formErr').hidden = true;
    const box = $('#formFields');
    box.innerHTML = '';
    fields.forEach((f) => {
      const wrap = h('div', { class: 'field' });
      wrap.append(h('label', { for: `ff_${f.key}` }, f.label));
      const input = h('input', { type: f.type || 'text', id: `ff_${f.key}`, placeholder: f.ph || '', value: f.val || '' });
      wrap.append(input);
      if (f.help) wrap.append(h('small', {}, f.help));
      box.appendChild(wrap);
    });
    formSubmit = onSubmit;
    openModal('#formModal');
  }
  $('#formCancel').addEventListener('click', () => closeModal('#formModal'));
  $('#formOk').addEventListener('click', () => {
    if (!formSubmit) return;
    const vals = {};
    $$('#formFields input').forEach((i) => { vals[i.id.replace('ff_', '')] = i.value.trim(); });
    const err = formSubmit(vals);
    if (err) {
      $('#formErr').textContent = err;
      $('#formErr').hidden = false;
    } else {
      closeModal('#formModal');
    }
  });

  /* ---------- Shared view builders ---------- */
  function chartSVG(points, labels, max) {
    const W = 300, H = 150, P = 26;
    const peak = max || Math.max(...points, 1);
    const X = (i) => P + (i * (W - P - 8)) / (points.length - 1);
    const Y = (v) => H - P - ((v / peak) * (H - P - 10));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">`;
    for (let g = 0; g <= 4; g += 1) {
      const v = Math.round((peak * g) / 4);
      const y = Y((peak * g) / 4);
      s += `<line class="grid-ln" x1="${P}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="#E4E4E7"/><text x="0" y="${y + 3}">${v}</text>`;
    }
    labels.forEach((lb, i) => {
      const x = X(Math.round((i * (points.length - 1)) / Math.max(labels.length - 1, 1)));
      s += `<text x="${x}" y="${H - 8}" text-anchor="middle">${lb}</text>`;
    });
    const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    s += `<path d="${line} L${X(points.length - 1).toFixed(1)},${H - P} L${X(0).toFixed(1)},${H - P} Z" fill="rgba(24,24,27,0.05)" stroke="none"/>`;
    s += `<path d="${line}" fill="none" stroke="#18181B" stroke-width="1.6"/>`;
    points.forEach((v, i) => { s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.4" fill="#18181B"/>`; });
    return `${s}</svg>`;
  }
  function barSVG(pairs) {
    const W = 300, H = 150, P = 26;
    const peak = Math.max(...pairs.map((p) => p[1]), 1);
    const bw = (W - P - 8) / pairs.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">`;
    pairs.forEach(([lb, v], i) => {
      const bh = Math.max(3, (v / peak) * (H - P - 24));
      const x = P + i * bw + bw * 0.22;
      s += `<rect x="${x.toFixed(1)}" y="${(H - P - bh).toFixed(1)}" width="${(bw * 0.56).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#18181B"/>`;
      s += `<text x="${(x + bw * 0.28).toFixed(1)}" y="${H - 8}" text-anchor="middle">${lb}</text>`;
    });
    return `${s}</svg>`;
  }
  function statRow(stats) {
    const box = h('div', { class: 'stats' });
    stats.forEach(([num, cap]) => box.append(h('div', { class: 'stat' }, h('p', { class: 'num' }, num), h('p', { class: 'cap' }, cap))));
    return box;
  }
  function tbl(headers, rows) {
    const t = h('table', { class: 'tbl' });
    const thead = h('thead', {}, h('tr', {}, ...headers.map((x) => h('th', {}, x))));
    const tb = h('tbody', {});
    rows.forEach((r) => {
      const tr = h('tr', {});
      r.forEach((cell, i) => {
        const td = h('td', i === 0 ? { class: 'strong' } : {});
        td.append(cell && cell.nodeType ? cell : document.createTextNode(cell));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.append(thead, tb);
    return h('div', { class: 'table-wrap' }, t);
  }
  function switchRow(title, sub, on, onFlip, label) {
    const b = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': label || title }, h('span', {}));
    b.addEventListener('click', () => {
      const next = b.getAttribute('aria-checked') !== 'true';
      setSwitch(b, next);
      onFlip(next);
    });
    const row = h('div', { class: 'rowline' }, h('div', { class: 'grow' }, h('strong', {}, title), h('small', {}, sub)), b);
    return row;
  }
  function feedItem(ev, when, green) {
    const li = h('li', {}, h('span', { class: 'fdot' + (green ? ' green' : ''), 'aria-hidden': 'true' }),
      h('span', {}, h('strong', {}, ev.text), h('small', {}, `${when} · ${ev.meta}`)));
    return li;
  }
  let feedTimer = null;
  let feedIdx = 0;
  function startFeed(feedEl, noteEl) {
    if (feedTimer) clearInterval(feedTimer);
    if (reduceMotion) return;
    feedTimer = setInterval(() => {
      if (document.hidden || !document.body.contains(feedEl) || feedEl.offsetParent === null) return;
      const ev = ACTIVITY[feedIdx % ACTIVITY.length];
      feedIdx += 1;
      feedEl.prepend(feedItem(ev, 'just now', feedIdx % 3 === 0));
      while (feedEl.children.length > 20) feedEl.lastChild.remove();
      if (noteEl) noteEl.textContent = 'Updated just now';
    }, 12000);
  }

  /* ---------- Views ---------- */
  const RENDER = {};
  Object.assign(RENDER, {
    home(body) {
      body.innerHTML = '';
      if (state.plan !== 'growth') {
        const banner = h('div', { class: 'banner' },
          h('p', {}, h('strong', {}, 'You’re at 82% of free resolutions. '), 'Upgrade to Growth for uninterrupted autopilot.'),
          h('a', { class: 'btn solid small', href: '#/app/agent-usage' }, 'See plans'));
        body.appendChild(banner);
      }
      const d7 = [3, 5, 4, 7, 6, 9, 8];
      const d30 = [4, 6, 5, 8, 7, 9, 8, 11, 10, 12, 11, 14];
      const charts = h('div', { class: 'charts' });
      [['Trailing 7 day interactions', chartSVG(d7, ['Sep 10', 'Sep 12', 'Sep 14', 'Sep 16'], 12)],
       ['Trailing 30 day interactions', chartSVG(d30, ['Aug 17', 'Aug 29', 'Sep 10', 'Sep 16'], 16)],
       ['Unique contacts', chartSVG([12, 18, 15, 22, 26, 24, 31, 29], ['Aug', 'Sep'], 36)],
      ].forEach(([t, svg]) => {
        const card = h('div', { class: 'chart-card' }, h('h3', {}, t));
        card.insertAdjacentHTML('beforeend', svg);
        charts.appendChild(card);
      });
      body.appendChild(charts);
      const hero = h('div', { class: 'tower-hero' },
        h('span', { class: 'tower-badge', 'aria-hidden': 'true', html: icon('tower-control', 24) }),
        h('div', {},
          h('h2', {}, 'Tower'),
          h('p', {}, 'Review activity, improve answers, update agent behavior, and handle follow-up work from one conversation.'),
          h('a', { class: 'btn solid', href: '#/app/tower' }, 'Open Tower ', h('span', { 'aria-hidden': 'true' }, '→'))),
        h('a', { class: 'go', href: '#/app/tower', 'aria-label': 'Open Tower' }, '→'));
      body.appendChild(hero);
      const panels = h('div', { class: 'panels' });
      const feedPanel = h('div', { class: 'panel' });
      const note = h('span', { class: 'micro' }, 'Updated just now');
      feedPanel.append(h('div', { class: 'panel-head' }, h('h2', {}, 'Recent activity'), note));
      const feed = h('ul', { class: 'feed' });
      const times = ['2m ago', '9m ago', '18m ago', '32m ago', '1h ago', '2h ago'];
      ACTIVITY.slice(0, 6).forEach((ev, i) => feed.appendChild(feedItem(ev, times[i], i % 3 === 0)));
      feedPanel.appendChild(feed);
      panels.appendChild(feedPanel);
      const agents = state.agents || { support: true, sales: false, mode: 'copilot' };
      const pill = (on) => {
        if (!on) return h('span', { class: 'mode-pill' }, 'Paused');
        return h('span', { class: agents.mode === 'autopilot' ? 'mode-pill on' : 'mode-pill co' }, agents.mode === 'autopilot' ? 'Autopilot on' : 'Copilot');
      };
      const ag = h('div', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Agent status'), h('a', { class: 'textlink', href: '#/app/agent-settings' }, 'Manage →')),
        h('div', { class: 'agent-row' }, h('strong', {}, 'Support Agent'), pill(agents.support)),
        h('div', { class: 'agent-row' }, h('strong', {}, 'Sales Agent'), pill(agents.sales)));
      panels.appendChild(ag);
      const added = addedIds();
      const conn = connectedIds();
      const cp = h('div', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Connections'), h('a', { class: 'textlink', href: '#/app/connections' }, 'Connect more →')),
        h('p', { class: 'micro' }, added.length === 0 ? 'No connections yet.' : `${conn.length} of ${added.length} connected`));
      const logos = h('div', { class: 'mini-logos' });
      added.slice(0, 8).forEach((id) => {
        const c = byId(id);
        if (!c) return;
        const s = logoImg(c);
        s.title = c.name;
        logos.appendChild(s);
      });
      cp.appendChild(logos);
      panels.appendChild(cp);
      body.appendChild(panels);
      startFeed(feed, note);
    },

    tower(body) {
      body.innerHTML = '';
      let useAgent = store.get('useAgent', 'tower');
      if (!AGENTS.some((a) => a.id === useAgent)) useAgent = 'tower';
      const lay = h('div', { class: 'tower-layout' });
      const left = h('div', {}, h('h1', { class: 'agent-pick-title' }, 'Select an Agent'));
      const cards = h('div', { class: 'agent-cards' });
      AGENTS.forEach((a) => {
        const sel = useAgent === a.id;
        const card = h('button', { type: 'button', class: 'agent-card', 'aria-pressed': String(sel) },
          h('span', { class: 'live-dot', 'aria-hidden': 'true' }),
          h('h3', {}, a.name), h('p', {}, a.desc),
          h('div', { class: 'tags' }, ...a.tags.map((t) => h('span', { class: 'tag' }, t))));
        card.addEventListener('click', () => {
          store.set('useAgent', a.id);
          toast(`${a.name} selected. Opening chat.`);
          go('#/app/use');
        });
        cards.appendChild(card);
      });
      left.appendChild(cards);
      left.append(h('p', { class: 'micro center', style: 'margin-top:16px' }, 'Tower orchestrates both agents. Pick one to control it directly in Use Agent.'));
      lay.appendChild(left);
      const past = h('div', { class: 'past-panel' },
        h('div', { class: 'past-head' }, h('span', {}, 'Past sessions'), h('span', { 'aria-hidden': 'true' }, '›')));
      const pb = h('div', { class: 'past-body' });
      const sessions = store.get('sessions', []);
      if (sessions.length === 0) {
        pb.append(h('p', { class: 'micro', style: 'margin:0' }, 'No past sessions yet.'));
      } else {
        sessions.slice(0, 8).forEach((s) => {
          pb.append(h('div', { class: 'sess-row' }, h('strong', {}, s.agent), h('small', {}, `${s.preview} · ${s.time}`)));
        });
      }
      past.appendChild(pb);
      lay.appendChild(past);
      body.appendChild(pageHead('Tower', 'One orchestrator for knowledge, workflow, and both agents.'));
      body.appendChild(lay);
    },

    use(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Use Agent', 'Talk to Tower, or take the controls of one agent.'));
      let cur = store.get('useAgent', 'tower');
      if (!AGENTS.some((a) => a.id === cur)) cur = 'tower';
      const threads = store.get('threads', {});
      const wrap = h('div', { class: 'use-wrap' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Choose agent' });
      const thread = h('div', { class: 'thread', 'aria-live': 'polite' });
      function agentName(id) { return (AGENTS.find((a) => a.id === id) || {}).name || 'Tower'; }
      function paintSeg() {
        seg.innerHTML = '';
        AGENTS.forEach((a) => {
          const b = h('button', { type: 'button', 'aria-pressed': String(cur === a.id) }, a.name);
          b.addEventListener('click', () => { cur = a.id; store.set('useAgent', cur); paintSeg(); paintThread(); });
          seg.appendChild(b);
        });
      }
      function bubble(who, text, cls) {
        const m = h('div', { class: `msg ${cls}` },
          h('span', { class: 'who', 'aria-hidden': 'true' }, who === 'You' ? (state.user || {}).avatar || 'YOU'.slice(0, 2) : agentName(cur).split(' ').map((w) => w[0]).slice(0, 2).join('')),
          h('div', { class: 'bubble' }, h('p', {}, text)));
        return m;
      }
      function paintThread() {
        thread.innerHTML = '';
        const items = threads[cur] || [{ w: 'a', t: `👋 ${agentName(cur)} online. Ask about a ticket, a lead, or anything in your stack.` }];
        items.forEach((m) => {
          if (m.w === 's') thread.appendChild(h('div', { class: 'msg sys' }, h('span', { class: 'who', 'aria-hidden': 'true' }, '✦'), h('div', { class: 'bubble' }, h('p', {}, m.t))));
          else thread.appendChild(bubble(m.w === 'u' ? 'You' : agentName(cur), m.t, m.w === 'u' ? 'user' : 'agent'));
        });
      }
      const REPLIES = {
        tower: [
          'On it — I’ve drafted a plan across Support and Sales. Want me to run it in Copilot first?',
          'Coordinated: Support has the ticket, Sales has the lead. Both report back here.',
        ],
        support: [
          'Got it — I found 3 similar resolved tickets. Drafting a reply in your voice now.',
          'I can issue that refund — it’s under your $100 threshold, so I’ve queued it for crew review.',
        ],
        sales: [
          'Qualified: budget confirmed, timeline this quarter. I’ve staged them for outreach — say the word.',
          'Done — Tuesday 10:00 is open and held. Confirm and I’ll send the invite plus prep notes.',
        ],
      };
      const ri = { tower: 0, support: 0, sales: 0 };
      const ta = h('textarea', { id: 'composerTa', placeholder: 'Type your question here…', 'aria-label': 'Message' });
      const send = h('button', { class: 'send-btn', type: 'button', 'aria-label': 'Send message' }, '↑');
      function push(agent, w, t) {
        const all = store.get('threads', {});
        all[agent] = [...(all[agent] || []), { w, t }].slice(-30);
        store.set('threads', all);
        threads[agent] = all[agent];
      }
      function logSession(text) {
        const all = store.get('sessions', []);
        all.unshift({ agent: agentName(cur), preview: text.length > 42 ? `${text.slice(0, 42)}…` : text, time: 'just now' });
        store.set('sessions', all.slice(0, 12));
      }
      function doSend() {
        const text = ta.value.trim();
        if (!text) return;
        push(cur, 'u', text);
        ta.value = '';
        send.disabled = true;
        paintThread();
        logSession(text);
        const tp = h('div', { class: 'msg agent' },
          h('span', { class: 'who', 'aria-hidden': 'true' }, agentName(cur).slice(0, 1)),
          h('div', { class: 'bubble' }, h('span', { class: 'typing', 'aria-hidden': 'true' }, h('span', {}), h('span', {}), h('span', {}))));
        thread.appendChild(tp);
        setTimeout(() => {
          const bank = REPLIES[cur] || REPLIES.tower;
          const reply = bank[ri[cur] % bank.length];
          ri[cur] += 1;
          push(cur, 'a', reply);
          send.disabled = false;
          paintThread();
        }, reduceMotion ? 60 : 900);
      }
      send.addEventListener('click', doSend);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
      const plus = h('button', { class: 'plus-btn', type: 'button', 'aria-label': 'Add attachment' }, '+');
      plus.addEventListener('click', () => toast('Attachments are disabled in this demo.'));
      const composer = h('div', { class: 'composer' }, h('label', { class: 'micro', for: 'composerTa' }, 'Message'), ta, h('div', { class: 'composer-row' }, plus, send));
      const collBody = h('div', { class: 'coll-body', hidden: true });
      const showPill = h('span', { class: 'showpill' }, 'Show');
      const collBtn = h('button', { class: 'coll-head', type: 'button', 'aria-expanded': 'false' },
        h('span', { 'aria-hidden': 'true', html: icon('sliders-horizontal', 16) }), 'Agent Settings', showPill);
      collBtn.addEventListener('click', () => {
        const open = collBody.hidden;
        collBody.hidden = !open;
        collBtn.setAttribute('aria-expanded', String(open));
        showPill.textContent = open ? 'Hide' : 'Show';
      });
      const a = state.agents || { support: true, sales: false, mode: 'copilot', threshold: 100 };
      collBody.append(
        h('p', { class: 'micro' }, `Mode: ${a.mode === 'autopilot' ? 'Autopilot' : 'Copilot'} · Approval above $${a.threshold} · Support ${a.support ? 'on' : 'off'} · Sales ${a.sales ? 'on' : 'off'}.`),
        h('a', { class: 'btn outline small', href: '#/app/agent-settings' }, 'Open Agent Settings'));
      const contactInput = h('input', { type: 'text', id: 'contactId', placeholder: 'Enter contact information', 'aria-label': 'Contact information' });
      const loadBtn = h('button', { class: 'btn solid', type: 'button' }, 'Load History');
      loadBtn.addEventListener('click', () => {
        const v = contactInput.value.trim() || 'general';
        push(cur, 's', `History restored for “${v}”. Picking up where you left off.`);
        paintThread();
        toast(`History restored for ${v}.`);
      });
      const contact = h('div', { class: 'contact-card' },
        h('h2', {}, 'Contact Information'),
        h('p', {}, 'Assign conversations to any contact identifier — an email, phone number, name, or other label. To continue a previous conversation, enter the same identifier and click “Load History” to restore the chat and pick up where you left off.'),
        h('div', { class: 'contact-row' }, contactInput, loadBtn));
      paintSeg();
      paintThread();
      wrap.append(seg, thread, composer,
        h('div', { class: 'collapsible' }, collBtn, collBody), contact);
      body.appendChild(wrap);
    },

    interactions(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Interactions', 'Every flight your agents have flown, newest first.'));
      let f = 'All';
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Filter by agent', style: 'margin-bottom:12px' });
      const holder = h('div', {});
      function paint() {
        seg.innerHTML = '';
        ['All', 'Support', 'Sales'].forEach((o) => {
          const b = h('button', { type: 'button', 'aria-pressed': String(f === o) }, o);
          b.addEventListener('click', () => { f = o; paint(); });
          seg.appendChild(b);
        });
        holder.innerHTML = '';
        const rows = FLIGHTS.filter((x) => f === 'All' || x.agent === f)
          .map((x) => [x.id, x.agent, x.summary, x.result, x.time]);
        holder.appendChild(rows.length ? tbl(['Flight', 'Agent', 'Summary', 'Result', 'Time'], rows)
          : h('p', { class: 'micro' }, 'No flights on this route yet.'));
      }
      paint();
      body.append(seg, holder);
    },

    analyses(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Analyses', 'How your crew is performing this week.'));
      body.appendChild(statRow([['68%', 'auto-resolved'], ['41s', 'median first response'], ['12', 'meetings booked'], ['4.8/5', 'CSAT']]));
      const charts = h('div', { class: 'charts', style: 'grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' });
      [['Resolutions by channel', barSVG([['Chat', 42], ['Email', 31], ['Voice', 9]])],
       ['Meetings by source', barSVG([['Inbound', 7], ['Outbound', 3], ['Referral', 2]])],
       ['CSAT distribution', barSVG([['5★', 61], ['4★', 22], ['3★', 9], ['1–2★', 4]])],
      ].forEach(([t, svg]) => {
        const card = h('div', { class: 'chart-card' }, h('h3', {}, t));
        card.insertAdjacentHTML('beforeend', svg);
        charts.appendChild(card);
      });
      body.appendChild(charts);
    },

    instructions(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Instructions', 'The system prompt every agent flies with.'));
      const cur = store.get('instructions', {});
      const ta = h('textarea', { id: 'instrTa', 'aria-label': 'System prompt', style: 'min-height:180px' });
      ta.value = cur.prompt || '';
      const tone = h('select', { id: 'instrTone', 'aria-label': 'Tone' });
      ['Warm & concise', 'Formal & precise', 'Playful & bold'].forEach((t) => {
        const o = h('option', { value: t }, t);
        if (cur.tone === t) o.selected = true;
        tone.appendChild(o);
      });
      const save = h('button', { class: 'btn solid', type: 'button' }, 'Save instructions');
      save.addEventListener('click', () => {
        store.set('instructions', { prompt: ta.value, tone: tone.value });
        toast('Saved. Agents will fly with the new instructions.');
      });
      const panel = h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('span', {}, 'System prompt'), ta),
        h('div', { class: 'field' }, h('span', {}, 'Tone'), tone),
        save);
      body.appendChild(panel);
    },

    context(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Manage', 'Knowledge sources grounding every answer.'));
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        store.get('sources', []).forEach((s, i) => {
          stack.appendChild(switchRow(s.n, s.t, !!s.on, (on) => {
            const all = store.get('sources', []);
            all[i].on = on;
            store.set('sources', all);
            toast(on ? `${s.n} syncing resumed.` : `${s.n} paused.`);
          }));
        });
      }
      paint();
      const add = h('button', { class: 'btn outline', type: 'button', style: 'margin-top:12px' }, '+ Add source');
      add.addEventListener('click', () => openForm({
        title: 'Add knowledge source', ok: 'Add source',
        fields: [{ key: 'url', label: 'URL or path', ph: 'https://help.tracevision.com', help: 'Docs, wikis, ticket archives, sheets.' }],
        onSubmit: (v) => {
          if (!v.url) return 'Enter a URL or path.';
          const all = store.get('sources', []);
          let name = v.url;
          try { name = new URL(v.url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
          all.push({ n: name, t: 'Queued for sync', on: true });
          store.set('sources', all);
          paint();
          toast(`${name} added. First sync queued.`);
          return null;
        },
      }));
      body.append(stack, add);
    },

    usage(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Usage', 'What your pilot has burned this cycle.'));
      const growth = state.plan === 'growth';
      const meters = h('div', { class: 'meters' });
      [[`Resolutions`, growth ? `${USAGE.res} / 1,000` : `${USAGE.res} / ${USAGE.resMax}`, growth ? 8 : 82, !growth],
       [`Qualified meetings`, growth ? `${USAGE.meet} / 50` : `${USAGE.meet} / ${USAGE.meetMax}`, growth ? 14 : 70, false],
      ].forEach(([label, txt, pct, hot]) => {
        const fill = h('span', { style: `width:${pct}%` });
        if (hot && USAGE.res >= 80) fill.className = 'hot';
        meters.append(h('div', { class: 'meter' }, h('p', {}, h('strong', {}, label), h('span', {}, txt)), h('div', { class: 'bar' }, fill)));
      });
      meters.append(h('p', { class: 'micro', style: 'margin:0' }, 'Seats Unlimited — no per-seat fees.'));
      body.appendChild(meters);
      body.appendChild(h('p', {}, h('a', { class: 'btn outline', href: '#/app/agent-usage' }, 'Compare plans →')));
    },

    improvements(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Improvements', 'Gaps Mach 1 found in your docs and macros. Approve to fix.'));
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        const all = store.get('improvements', []);
        const open = all.filter((x) => x.state === 'open');
        if (open.length === 0) stack.appendChild(h('p', { class: 'micro' }, 'All caught up. Mach 1 will flag new gaps here.'));
        open.forEach((it) => {
          const row = h('div', { class: 'rowline' },
            h('div', { class: 'grow' }, h('strong', {}, it.id), h('small', {}, it.text)));
          const ok = h('button', { class: 'btn solid small', type: 'button' }, 'Approve');
          ok.addEventListener('click', () => {
            const cur = store.get('improvements', []);
            cur.find((x) => x.id === it.id).state = 'done';
            store.set('improvements', cur);
            toast(`${it.id} approved. Fix queued.`);
            paint();
          });
          const no = h('button', { class: 'btn danger-ghost small', type: 'button' }, 'Dismiss');
          no.addEventListener('click', () => {
            const cur = store.get('improvements', []);
            cur.find((x) => x.id === it.id).state = 'dismissed';
            store.set('improvements', cur);
            toast(`${it.id} dismissed.`);
            paint();
          });
          row.append(ok, no);
          stack.appendChild(row);
        });
        const done = all.filter((x) => x.state !== 'open');
        if (done.length) {
          stack.appendChild(h('p', { class: 'micro', style: 'margin:8px 0 0' }, 'Resolved'));
          done.forEach((it) => stack.appendChild(h('div', { class: 'rowline' },
            h('div', { class: 'grow' }, h('strong', {}, it.id), h('small', {}, it.text)),
            h('span', { class: 'mode-pill' }, it.state === 'done' ? 'Fixed' : 'Dismissed'))));
        }
      }
      paint();
      body.appendChild(stack);
    },

    'wf-start'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Start', 'Kick off a workflow run. Watch it land in Runs.'));
      const grid = h('div', { class: 'agent-cards' });
      TEMPLATES.forEach((t) => {
        const card = h('div', { class: 'agent-card', style: 'cursor:default' },
          h('h3', {}, t.name), h('p', {}, t.desc));
        const btn = h('button', { class: 'btn solid small', type: 'button', style: 'margin-top:12px' }, 'Start run');
        btn.addEventListener('click', () => {
          const runs = store.get('runs', []);
          const seq = store.get('runSeq', 890);
          store.set('runSeq', seq + 1);
          const id = `RN-${seq}`;
          runs.unshift({ id, wf: t.name, status: 'Running', time: 'just now' });
          store.set('runs', runs.slice(0, 20));
          toast(`${t.name} started as ${id}.`);
          go('#/app/wf-runs');
        });
        card.appendChild(btn);
        grid.appendChild(card);
      });
      body.appendChild(grid);
    },

    'wf-manage'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Manage', 'Which workflows are cleared to fly.'));
      const stack = h('div', { class: 'stack' });
      TEMPLATES.forEach((t) => {
        const cur = store.get('workflows', {});
        stack.appendChild(switchRow(t.name, t.desc, cur[t.id] !== false, (on) => {
          const all = store.get('workflows', {});
          all[t.id] = on;
          store.set('workflows', all);
          toast(on ? `${t.name} enabled.` : `${t.name} paused.`);
        }));
      });
      body.appendChild(stack);
    },

    'wf-runs'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Runs', 'Recent workflow executions.'));
      const rows = store.get('runs', []).map((r) => [r.id, r.wf, r.status, r.time]);
      body.appendChild(rows.length ? tbl(['Run', 'Workflow', 'Status', 'Started'], rows)
        : h('p', { class: 'micro' }, 'No runs yet. Start one from Workflows → Start.'));
    },

    'wf-tasks'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Tasks', 'Approvals and follow-ups waiting on your crew.'));
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        const all = store.get('tasks', []);
        if (all.every((t) => t.done)) stack.appendChild(h('p', { class: 'micro' }, 'Inbox zero. Nothing waiting on the crew.'));
        all.forEach((t) => {
          const cb = h('input', { type: 'checkbox', 'aria-label': t.text });
          cb.checked = !!t.done;
          cb.addEventListener('change', () => {
            const cur = store.get('tasks', []);
            cur.find((x) => x.id === t.id).done = cb.checked;
            store.set('tasks', cur);
            toast(cb.checked ? `${t.id} approved.` : `${t.id} reopened.`);
            paint();
          });
          stack.appendChild(h('div', { class: `rowline check-row${t.done ? ' done' : ''}` }, cb,
            h('div', { class: 'grow' }, h('strong', {}, t.id), h('small', {}, t.text))));
        });
      }
      paint();
      body.appendChild(stack);
    },

    'wf-memories'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Memories', 'Long-term facts your agents never forget.'));
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        store.get('memories', []).forEach((m) => {
          const del = h('button', { class: 'btn danger-ghost small', type: 'button' }, 'Forget');
          del.addEventListener('click', () => {
            store.set('memories', store.get('memories', []).filter((x) => x.k !== m.k));
            toast('Memory forgotten.');
            paint();
          });
          stack.appendChild(h('div', { class: 'rowline' },
            h('div', { class: 'grow' }, h('strong', { class: 'mono' }, m.k), h('small', {}, m.v)), del));
        });
        if (store.get('memories', []).length === 0) stack.appendChild(h('p', { class: 'micro' }, 'No memories yet.'));
      }
      paint();
      const add = h('button', { class: 'btn outline', type: 'button', style: 'margin-top:12px' }, '+ Add memory');
      add.addEventListener('click', () => openForm({
        title: 'Add memory', ok: 'Remember',
        fields: [
          { key: 'k', label: 'Key', ph: 'vip.tier' },
          { key: 'v', label: 'Value', ph: 'Loopwork renews in March' },
        ],
        onSubmit: (v) => {
          if (!v.k || !v.v) return 'Key and value are both required.';
          const all = store.get('memories', []);
          if (all.some((x) => x.k === v.k)) return 'That key already exists.';
          all.push({ k: v.k, v: v.v });
          store.set('memories', all);
          paint();
          toast('Memory stored.');
          return null;
        },
      }));
      body.append(stack, add);
    },

    'wf-docs'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Documentation', 'Guides for flying Mach 1 well.'));
      const grid = h('div', { class: 'agent-cards' });
      DOCS.forEach((d) => {
        grid.appendChild(h('div', { class: 'agent-card', style: 'cursor:default' },
          h('h3', {}, d.t), h('p', {}, d.d),
          h('a', { class: 'btn outline small', href: `#/app/${d.go}`, style: 'margin-top:12px' }, 'Open →')));
      });
      body.appendChild(grid);
    },

    team(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Team', 'Who can fly this workspace.'));
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        store.get('team', []).forEach((m) => {
          const row = h('div', { class: 'rowline' },
            h('span', { class: 'avatar sm', 'aria-hidden': 'true' }, initials(m.n)),
            h('div', { class: 'grow' }, h('strong', {}, m.n), h('small', {}, `${m.e} · ${m.r}`)));
          if (m.r !== 'Owner') {
            const rm = h('button', { class: 'btn danger-ghost small', type: 'button' }, 'Remove');
            rm.addEventListener('click', () => {
              store.set('team', store.get('team', []).filter((x) => x.e !== m.e));
              toast(`${m.n} removed.`);
              paint();
            });
            row.appendChild(rm);
          }
          stack.appendChild(row);
        });
      }
      paint();
      const inv = h('button', { class: 'btn outline', type: 'button', style: 'margin-top:12px' }, '+ Invite teammate');
      inv.addEventListener('click', () => openForm({
        title: 'Invite teammate', ok: 'Send invite',
        fields: [{ key: 'email', label: 'Work email', ph: 'sam@tracevision.com' }],
        onSubmit: (v) => {
          if (!v.email || !v.email.includes('@')) return 'Enter a valid email.';
          const all = store.get('team', []);
          if (all.some((x) => x.e.toLowerCase() === v.email.toLowerCase())) return 'They’re already on the crew.';
          all.push({ n: prettyName(v.email), e: v.email, r: 'Member' });
          store.set('team', all);
          paint();
          toast(`Invite sent to ${v.email}.`);
          return null;
        },
      }));
      body.append(stack, inv);
    },

    'agent-settings'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Agent Settings', 'Your crew stays in control. Set guardrails, then let Mach 1 fly.'));
      const a = state.agents || { support: true, sales: false, mode: 'copilot', threshold: 100 };
      function pill(on) {
        return h('span', { class: !on ? 'mode-pill' : a.mode === 'autopilot' ? 'mode-pill on' : 'mode-pill co' },
          !on ? 'Paused' : a.mode === 'autopilot' ? 'Autopilot' : 'Copilot');
      }
      const cards = h('div', { class: 'agent-pick' });
      [['support', 'Support Agent', 'Answers in seconds across chat and email.', 'lemrzdkt'],
       ['sales', 'Sales Agent', 'Qualifies in under a minute, books and logs to CRM.', 'lagziwcr'],
      ].forEach(([key, label, desc, li]) => {
        const on = !!a[key];
        const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': label }, h('span', {}));
        sw.addEventListener('click', () => {
          const cur = getAgents();
          cur[key] = !cur[key];
          store.set('agents', cur);
          toast(cur[key] ? `${label} resumed.` : `${label} paused.`);
          RENDER['agent-settings'](body);
        });
        const card = h('div', { class: 'pick-card' });
        card.insertAdjacentHTML('afterbegin', `<lord-icon src="https://cdn.lordicon.com/${li}.json" trigger="hover" colors="primary:#18181B,secondary:#71717A" style="width:40px;height:40px" aria-hidden="true"></lord-icon>`);
        card.append(h('div', {}, h('h2', {}, label, ' ', pill(on)), h('p', { class: 'micro' }, desc)), sw);
        cards.appendChild(card);
      });
      body.appendChild(cards);
      const sel = h('select', { id: 'threshold', 'aria-label': 'Approval threshold' });
      [['50', 'Require approval above $50'], ['100', 'Require approval above $100'],
       ['250', 'Require approval above $250'], ['500', 'Require approval above $500'],
      ].forEach(([v, t]) => {
        const o = h('option', { value: v }, t);
        if (String(a.threshold) === v) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => {
        const cur = getAgents();
        cur.threshold = parseInt(sel.value, 10);
        store.set('agents', cur);
        toast('Saved.');
      });
      body.appendChild(h('div', { class: 'guard' },
        h('div', {}, h('label', { for: 'threshold' }, h('strong', {}, 'Approval threshold')),
          h('p', { class: 'micro' }, 'Refunds and credits above this need crew approval.')), sel));
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Autonomy mode' });
      const bCo = h('button', { type: 'button', 'aria-pressed': String(a.mode !== 'autopilot') }, 'Copilot');
      const bAu = h('button', { type: 'button', 'aria-pressed': String(a.mode === 'autopilot') }, 'Autopilot');
      bCo.addEventListener('click', () => {
        const cur = getAgents();
        cur.mode = 'copilot';
        store.set('agents', cur);
        toast('Copilot mode. Crew approves every action.');
        RENDER['agent-settings'](body);
      });
      bAu.addEventListener('click', () => {
        if (state.plan !== 'growth') {
          toast('Autopilot unlocks on Growth. You’re in copilot for now.');
          return;
        }
        const cur = getAgents();
        cur.mode = 'autopilot';
        store.set('agents', cur);
        toast('Autopilot on. Flying within your guardrails.');
        RENDER['agent-settings'](body);
      });
      seg.append(bCo, bAu);
      body.appendChild(h('div', { class: 'mode-row' },
        h('div', {}, h('strong', {}, 'Autonomy mode'),
          h('p', { class: 'micro' }, a.mode === 'autopilot' ? 'Autopilot — AI acts within guardrails.'
            : (state.plan === 'growth' ? 'Copilot — AI drafts, crew approves.' : 'Copilot — AI drafts, crew approves. Autopilot unlocks on Growth.'))),
        seg));
      const tb = h('tbody', {});
      const flights = FLIGHTS.filter((f) => (f.agent === 'Support' && a.support) || (f.agent === 'Sales' && a.sales));
      if (flights.length === 0) {
        tb.appendChild(h('tr', {}, h('td', { colspan: '5' }, 'No flights yet. Enable an agent to log its first run.')));
      } else {
        flights.forEach((f) => {
          const tr = h('tr', {});
          [f.id, f.agent, f.summary, f.result, f.time].forEach((v, i) => {
            const td = h('td', i === 0 ? { class: 'strong' } : {});
            td.textContent = v;
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
      }
      const audit = h('button', { class: 'textlink', type: 'button', style: 'border:none;background:none;cursor:pointer;font-size:0.84rem' }, 'View audit log');
      audit.addEventListener('click', () => {
        toast(state.plan === 'growth' ? 'Audit log exported. Check your inbox.' : 'Audit log export is a Growth feature.');
      });
      const panel = h('div', { class: 'panel', style: 'margin-top:12px' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Recent flights'), audit));
      const t = h('table', { class: 'tbl' });
      t.append(h('thead', {}, h('tr', {}, ...['Flight', 'Agent', 'Summary', 'Result', 'Time'].map((x) => h('th', {}, x)))), tb);
      panel.append(h('div', { class: 'table-wrap', style: 'border:none;box-shadow:none' }, t));
      body.appendChild(panel);
    },

    connections(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Connections', 'One click per tool. Mach 1 syncs history and keeps everything in formation.'));
      const search = h('input', { type: 'search', placeholder: 'Search integrations…', 'aria-label': 'Search integrations', autocomplete: 'off' });
      const count = h('p', { class: 'micro', role: 'status', 'aria-live': 'polite' });
      search.setAttribute('aria-describedby', 'connCountLive');
      count.id = 'connCountLive';
      body.appendChild(h('div', { class: 'conn-tools', role: 'search' },
        h('span', { class: 'search-box' },
          h('span', { 'aria-hidden': 'true', html: '<svg class="mag" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#A1A1AA" stroke-width="1.8"/><path d="M11 11l3.5 3.5" stroke="#A1A1AA" stroke-width="1.8" stroke-linecap="round"/></svg>' }),
          search),
        count));
      const filters = h('div', { class: 'conn-filters', role: 'group', 'aria-label': 'Filter by category' });
      body.appendChild(filters);
      const empty = h('div', { class: 'empty', role: 'status', hidden: true });
      empty.insertAdjacentHTML('afterbegin', '<lord-icon src="https://cdn.lordicon.com/vlgbdagb.json" trigger="hover" colors="primary:#18181B,secondary:#71717A" style="width:52px;height:52px" aria-hidden="true"></lord-icon>');
      empty.append(h('p', {}, h('strong', {}, 'No connections yet. '), 'Add your first to ground Mach 1 in real context.'),
        h('p', { class: 'micro' }, 'Takes ~30 seconds per tool.'));
      body.appendChild(empty);
      const noMatch = h('p', { class: 'micro', role: 'status', hidden: true });
      const noTxt = h('span', {});
      const clear = h('button', { class: 'textlink', type: 'button' }, 'Clear search');
      noMatch.append(noTxt, ' ', clear);
      body.appendChild(noMatch);
      const grid = h('div', { class: 'grid wide', role: 'list' });
      body.appendChild(grid);
      let cat = 'All';
      const CATS = ['All', ...new Set(CONNECTORS.map((c) => c.cat))];
      let syncingId = null;
      function paintChips() {
        filters.innerHTML = '';
        CATS.forEach((c) => {
          const chip = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(cat === c) }, c);
          chip.addEventListener('click', () => { cat = c; paintChips(); paint(); });
          filters.appendChild(chip);
        });
      }
      function paint(focusId) {
        const added = addedIds();
        const conns = state.conns;
        const q = search.value.trim().toLowerCase();
        const list = CONNECTORS.filter((c) =>
          (cat === 'All' || c.cat === cat) &&
          (!q || c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q)));
        empty.hidden = added.length !== 0;
        noMatch.hidden = list.length !== 0;
        if (list.length === 0 && added.length !== 0) {
          noTxt.textContent = q ? `No matches for “${search.value.trim()}”.` : 'No matches in this category.';
        }
        const conn = connectedIds();
        count.textContent = added.length === 0 ? '' : `${conn.length} of ${added.length} connected · ${CONNECTORS.length - added.length} available`;
        grid.innerHTML = '';
        list.forEach((c) => {
          const isAdded = added.includes(c.id);
          const isConn = !!(conns[c.id] && conns[c.id].status === 'connected');
          const isSync = syncingId === c.id;
          const card = h('div', { class: 'conn-card' + (isConn ? ' is-conn' : ''), role: 'listitem' });
          card.dataset.conn = c.id;
          const status = isConn ? 'connected' : isAdded ? 'added' : 'available';
          const nm = h('strong', {}, c.name, h('span', { class: 'sr-only' }, `, ${status}`));
          const pill = h('span', { class: 'status-pill ' + (isConn ? 'conn' : isAdded ? 'added' : 'idle') + (isSync ? ' sync' : '') });
          if (isSync) pill.append(h('span', { class: 'sync-dot', 'aria-hidden': 'true' }), document.createTextNode('Syncing…'));
          else pill.textContent = isConn ? '✓ Connected' : isAdded ? 'Added' : 'Available';
          card.append(logoImg(c), h('span', { class: 'conn-txt' }, nm, h('small', {}, `${c.cat} · ${c.blurb}`)), pill);
          const actions = h('span', { class: 'conn-actions' });
          if (!isAdded) {
            const add = h('button', { type: 'button', class: 'btn outline small' }, '+ Add to workspace');
            add.addEventListener('click', () => {
              const ob = state.ob;
              ob.connectors = [...addedIds(), c.id];
              store.set('onboarding', ob);
              toast(`${c.name} added to your workspace.`);
              paint(c.id);
            });
            actions.appendChild(add);
          } else if (!isConn) {
            const go2 = h('button', { type: 'button', class: 'btn solid small' }, 'Connect');
            go2.addEventListener('click', () => openOAuth(c.id, () => paint(c.id)));
            actions.appendChild(go2);
            const rm = h('button', { type: 'button', class: 'btn danger-ghost small' }, 'Remove');
            rm.addEventListener('click', () => {
              const ob = state.ob;
              ob.connectors = addedIds().filter((x) => x !== c.id);
              store.set('onboarding', ob);
              toast(`${c.name} removed.`);
              paint();
              search.focus();
            });
            actions.appendChild(rm);
          } else {
            const sy = h('button', { type: 'button', class: 'btn outline small' }, 'Sync now');
            sy.disabled = isSync;
            sy.addEventListener('click', () => {
              syncingId = c.id;
              paint(c.id);
              toast(`Syncing ${c.name} — fresh data in about a minute.`);
              setTimeout(() => { syncingId = null; paint(c.id); }, reduceMotion ? 60 : 1200);
            });
            actions.appendChild(sy);
            const dc = h('button', { type: 'button', class: 'btn danger-ghost small' }, 'Disconnect');
            dc.addEventListener('click', () => {
              const all = state.conns;
              delete all[c.id];
              store.set('connections', all);
              toast(`${c.name} disconnected. Reconnect anytime.`);
              paint(c.id);
            });
            actions.appendChild(dc);
          }
          card.appendChild(actions);
          grid.appendChild(card);
        });
        if (focusId) {
          const btn = grid.querySelector(`[data-conn="${focusId}"] .conn-actions button`);
          if (btn) btn.focus();
        }
      }
      search.addEventListener('input', () => paint());
      clear.addEventListener('click', () => {
        search.value = '';
        cat = 'All';
        paintChips();
        paint();
        search.focus();
      });
      paintChips();
      paint();
    },

    channels(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Channels', 'Where your agents meet customers and crew.'));
      const stack = h('div', { class: 'stack' });
      CHANNELS.forEach((c) => {
        const cur = store.get('channels', {});
        stack.appendChild(switchRow(c.name, c.desc, cur[c.id] !== false, (on) => {
          const all = store.get('channels', {});
          all[c.id] = on;
          store.set('channels', all);
          toast(on ? `${c.name} channel live.` : `${c.name} channel paused.`);
        }));
      });
      body.appendChild(stack);
    },

    mcp(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('MCP Settings', 'Model Context Protocol servers extending your agents.'));
      const BASE = [
        { id: 'linear', name: 'Linear MCP', desc: 'Issues, cycles, and project context.' },
        { id: 'github', name: 'GitHub MCP', desc: 'Repos, PRs, and code search.' },
        { id: 'postgres', name: 'Postgres MCP', desc: 'Read-only analytics queries.' },
      ];
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        const cur = store.get('mcp', {});
        const customs = store.get('mcpCustom', []);
        [...BASE.map((b) => ({ ...b, custom: false })), ...customs.map((c) => ({ ...c, custom: true }))].forEach((s) => {
          const row = switchRow(s.name, s.desc, cur[s.id] !== false, (on) => {
            const all = store.get('mcp', {});
            all[s.id] = on;
            store.set('mcp', all);
            toast(on ? `${s.name} connected.` : `${s.name} disconnected.`);
          }, s.name);
          if (s.custom) {
            const del = h('button', { class: 'btn danger-ghost small', type: 'button' }, 'Remove');
            del.addEventListener('click', () => {
              store.set('mcpCustom', store.get('mcpCustom', []).filter((x) => x.id !== s.id));
              toast(`${s.name} removed.`);
              paint();
            });
            row.appendChild(del);
          }
          stack.appendChild(row);
        });
      }
      paint();
      const add = h('button', { class: 'btn outline', type: 'button', style: 'margin-top:12px' }, '+ Add server');
      add.addEventListener('click', () => openForm({
        title: 'Add MCP server', ok: 'Add server',
        fields: [
          { key: 'name', label: 'Name', ph: 'Figma MCP' },
          { key: 'url', label: 'Endpoint', ph: 'https://mcp.tracevision.com/figma' },
        ],
        onSubmit: (v) => {
          if (!v.name || !v.url) return 'Name and endpoint are required.';
          const customs = store.get('mcpCustom', []);
          const id = `custom-${Date.now()}`;
          customs.push({ id, name: v.name, desc: v.url });
          store.set('mcpCustom', customs);
          const flags = store.get('mcp', {});
          flags[id] = true;
          store.set('mcp', flags);
          paint();
          toast(`${v.name} connected.`);
          return null;
        },
      }));
      body.append(stack, add);
    },

    secrets(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Workflow Secrets', 'Credentials for workflow runs. Demo only — stored in your browser.'));
      const shown = new Set();
      const stack = h('div', { class: 'stack' });
      function mask(v) {
        return v.length <= 4 ? '••••••••' : `••••••••${v.slice(-4)}`;
      }
      function paint() {
        stack.innerHTML = '';
        const all = store.get('secrets', []);
        if (all.length === 0) stack.appendChild(h('p', { class: 'micro' }, 'No secrets yet.'));
        all.forEach((s) => {
          const code = h('span', { class: 'key-code' }, shown.has(s.name) ? (s.value || '••••••••') : mask(s.value || ''));
          const row = h('div', { class: 'rowline' },
            h('div', { class: 'grow' }, h('strong', { class: 'mono' }, s.name), h('small', {}, `Updated ${s.updated}`)), code);
          const rev = h('button', { class: 'btn outline small', type: 'button' }, shown.has(s.name) ? 'Hide' : 'Reveal');
          rev.addEventListener('click', () => {
            if (shown.has(s.name)) shown.delete(s.name);
            else shown.add(s.name);
            paint();
          });
          const del = h('button', { class: 'btn danger-ghost small', type: 'button' }, 'Delete');
          del.addEventListener('click', () => {
            store.set('secrets', store.get('secrets', []).filter((x) => x.name !== s.name));
            toast(`${s.name} deleted.`);
            paint();
          });
          row.append(rev, del);
          stack.appendChild(row);
        });
      }
      paint();
      const add = h('button', { class: 'btn outline', type: 'button', style: 'margin-top:12px' }, '+ Add secret');
      add.addEventListener('click', () => openForm({
        title: 'Add secret', ok: 'Save secret',
        fields: [
          { key: 'name', label: 'Name', ph: 'SENDGRID_KEY' },
          { key: 'value', label: 'Value', ph: 'SG.…', type: 'password' },
        ],
        onSubmit: (v) => {
          if (!v.name || !v.value) return 'Name and value are required.';
          const nm = v.name.toUpperCase().replace(/\s+/g, '_');
          const all = store.get('secrets', []);
          if (all.some((x) => x.name === nm)) return 'That name already exists.';
          all.push({ name: nm, value: v.value, updated: 'just now' });
          store.set('secrets', all);
          paint();
          toast('Secret saved.');
          return null;
        },
      }));
      body.append(stack, add);
    },

    'wf-settings'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Workflow Settings', 'Defaults for every workflow run.'));
      const cur = store.get('wsettings', {});
      const fields = [
        ['timeout', 'Run timeout (seconds)', cur.timeout],
        ['retries', 'Retries per step', cur.retries],
        ['concurrency', 'Max concurrent runs', cur.concurrency],
        ['retention', 'Log retention (days)', cur.retention],
      ].map(([k, label, val]) => {
        const input = h('input', { type: 'number', id: `ws_${k}`, value: val || '', min: '1' });
        return h('div', { class: 'field' }, h('label', { for: `ws_${k}` }, label), input);
      });
      const save = h('button', { class: 'btn solid', type: 'button' }, 'Save settings');
      save.addEventListener('click', () => {
        const out = {};
        ['timeout', 'retries', 'concurrency', 'retention'].forEach((k) => { out[k] = body.querySelector(`#ws_${k}`).value || '0'; });
        store.set('wsettings', out);
        toast('Saved. New runs pick this up immediately.');
      });
      body.appendChild(h('div', { class: 'panel' }, ...fields, save));
    },

    'api-keys'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('API Keys', 'Programmatic access to flights, runs, and webhooks.'));
      const stack = h('div', { class: 'stack' });
      function paint() {
        stack.innerHTML = '';
        const all = store.get('keys', []);
        if (all.length === 0) stack.appendChild(h('p', { class: 'micro' }, 'No keys. Generate one to call the API.'));
        all.forEach((k) => {
          const row = h('div', { class: 'rowline' },
            h('div', { class: 'grow' },
              h('span', { class: 'key-code' }, k.shown ? k.full : k.id),
              h('small', {}, `Created ${k.created} · Last used ${k.last}`)));
          const copy = h('button', { class: 'btn outline small', type: 'button' }, 'Copy');
          copy.addEventListener('click', () => {
            const txt = k.full || k.id;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txt).then(() => toast('Key copied.'), () => toast('Copy blocked by the browser.'));
            } else {
              toast('Copy blocked by the browser.');
            }
          });
          const rev = h('button', { class: 'btn danger-ghost small', type: 'button' }, 'Revoke');
          rev.addEventListener('click', () => {
            store.set('keys', store.get('keys', []).filter((x) => x.id !== k.id));
            toast('Key revoked.');
            paint();
          });
          row.append(copy, rev);
          stack.appendChild(row);
        });
      }
      paint();
      const gen = h('button', { class: 'btn solid', type: 'button', style: 'margin-top:12px' }, '+ Generate key');
      gen.addEventListener('click', () => {
        const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
        const full = `fk_live_${hex()}${hex()}`;
        const all = store.get('keys', []);
        all.unshift({ id: `${full.slice(0, 9)}…${full.slice(-4)}`, full, created: 'just now', last: 'never', shown: true });
        store.set('keys', all);
        paint();
        store.set('keys', store.get('keys', []).map((k) => ({ id: k.id, created: k.created, last: k.last })));
        toast('Key generated. Copy it — it won’t show again.');
      });
      body.append(stack, gen);
    },

    'agent-usage'(body) {
      body.innerHTML = '';
      body.appendChild(pageHead('Agent Usage', 'Free pilot, no card required. Scale when you’re ready for cruising altitude.'));
      const growth = state.plan === 'growth';
      const meters = h('div', { class: 'meters' });
      [[`Resolutions`, growth ? `${USAGE.res} / 1,000` : `${USAGE.res} / ${USAGE.resMax}`, growth ? 8 : 82, !growth],
       [`Qualified meetings`, growth ? `${USAGE.meet} / 50` : `${USAGE.meet} / ${USAGE.meetMax}`, growth ? 14 : 70, false],
      ].forEach(([label, txt, pct, hot]) => {
        const fill = h('span', { style: `width:${pct}%` });
        if (hot && USAGE.res >= 80) fill.className = 'hot';
        meters.append(h('div', { class: 'meter' }, h('p', {}, h('strong', {}, label), h('span', {}, txt)), h('div', { class: 'bar' }, fill)));
      });
      meters.append(h('p', { class: 'micro', style: 'margin:0' }, 'Seats Unlimited — no per-seat fees.'));
      body.appendChild(meters);
      const plans = h('div', { class: 'plans' });
      const pilotBtn = h('button', { class: 'btn outline wide small', type: 'button', disabled: 'true', title: growth ? 'Contact sales to downgrade' : '' },
        growth ? 'Included in Growth' : 'Current plan');
      plans.append(h('div', { class: 'plan' }, h('h2', {}, 'Free Pilot'), h('p', { class: 'price' }, '$0'),
        h('ul', {}, ...['100 resolutions + 10 meetings', 'Up to 3 connections', 'Copilot mode', 'Community support'].map((x) => h('li', {}, x))), pilotBtn));
      const growBtn = h('button', { class: 'btn solid wide small', type: 'button' }, growth ? 'Current plan' : 'Upgrade to Growth');
      if (growth) growBtn.disabled = true;
      else growBtn.addEventListener('click', () => {
        openModal('#checkoutModal');
        $('#coAsk').hidden = false;
        $('#coDone').hidden = true;
      });
      plans.append(h('div', { class: 'plan hot' }, h('h2', {}, 'Growth'), h('p', { class: 'price', html: '$249<span>/mo</span>' }),
        h('ul', {}, ...['1,000 resolutions + 50 meetings', 'Unlimited connections', 'Autopilot + audit log', 'Slack support'].map((x) => h('li', {}, x))), growBtn));
      plans.append(h('div', { class: 'plan' }, h('h2', {}, 'Enterprise'), h('p', { class: 'price' }, 'Custom'),
        h('ul', {}, ...['SSO/SAML + EU residency', 'Custom retention + SLA 99.99%', 'Dedicated crew', 'Security review support'].map((x) => h('li', {}, x))),
        h('a', { class: 'btn outline wide small', href: 'mailto:sales@mach1ai.com?subject=Mach%201%20Enterprise' }, 'Talk to sales')));
      body.appendChild(plans);
      body.appendChild(h('p', { class: 'micro center' }, 'Per-resolution for Support, per-qualified-meeting for Sales. No per-seat fees.'));
    },
  });

  /* ---------- OAuth + checkout ---------- */
  let oauthId = null;
  let oauthDone = null;
  function openOAuth(id, onDone) {
    const c = byId(id);
    if (!c) return;
    oauthId = id;
    oauthDone = onDone || null;
    $('#oauthAsk').hidden = false;
    $('#oauthDone').hidden = true;
    const otile = logoImg(c, true);
    otile.id = 'oauthLogo';
    $('#oauthLogo').replaceWith(otile);
    $('#oauthTitle').textContent = `Connect ${c.name} to Mach 1`;
    $('#oauthCard').setAttribute('aria-labelledby', 'oauthTitle');
    $('#oauthDesc').textContent = `Mach 1 wants to ${c.blurb.charAt(0).toLowerCase() + c.blurb.slice(1)} as ${wsName()}. It never deletes without approval.`;
    $('#oauthPerms').innerHTML = '';
    c.perms.forEach((p) => $('#oauthPerms').appendChild(h('li', {}, p)));
    const allow = $('#oauthAllow');
    allow.disabled = false;
    allow.textContent = 'Allow access';
    openModal('#oauthModal');
  }
  $('#oauthCancel').addEventListener('click', () => closeModal('#oauthModal'));
  $('#oauthAllow').addEventListener('click', () => {
    const c = byId(oauthId);
    const allow = $('#oauthAllow');
    allow.disabled = true;
    allow.innerHTML = '<span class="spin" aria-hidden="true"></span> Connecting…';
    setTimeout(() => {
      const conns = state.conns;
      conns[oauthId] = { status: 'connected', at: new Date().toISOString() };
      store.set('connections', conns);
      $('#oauthAsk').hidden = true;
      $('#oauthDone').hidden = false;
      const dtile = logoImg(c, true);
      dtile.id = 'oauthLogo2';
      $('#oauthLogo2').replaceWith(dtile);
      $('#oauthDoneTitle').textContent = `${c.name} connected`;
      $('#oauthCard').setAttribute('aria-labelledby', 'oauthDoneTitle');
      $('#oauthDoneDesc').textContent = 'Syncing history — usually ready in a few minutes.';
      $('#oauthClose').focus();
    }, reduceMotion ? 60 : 1100);
  });
  $('#oauthClose').addEventListener('click', () => {
    const c = byId(oauthId);
    closeModal('#oauthModal');
    toast(`${c ? c.name : 'Integration'} connected.`);
    if (oauthDone) { const f = oauthDone; oauthDone = null; f(); }
  });
  $('#coCancel').addEventListener('click', () => closeModal('#checkoutModal'));
  $('#coConfirm').addEventListener('click', () => {
    const btn = $('#coConfirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Upgrading…';
    setTimeout(() => {
      store.set('plan', 'growth');
      $('#coAsk').hidden = true;
      $('#coDone').hidden = false;
      btn.disabled = false;
      btn.textContent = 'Confirm upgrade';
      $('#coClose').focus();
    }, reduceMotion ? 60 : 900);
  });
  $('#coClose').addEventListener('click', () => {
    closeModal('#checkoutModal');
    toast('Welcome to Growth. Autopilot unlocked.');
    renderApp('agent-usage');
    $('#mainApp').focus({ preventScroll: true });
  });

  /* ---------- Boot ---------- */
  sync();
})();
