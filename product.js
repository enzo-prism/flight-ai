/* Flight AI product demo — router, state, fake async. No backend. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Catalog (logos: assets/connectors/*.svg via svgl) ---------- */
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
    { id: 'microsoft-teams', name: 'Microsoft Teams', cat: 'Comms', blurb: 'Sync chats + meetings',
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

  const ACTIVITY = [
    { text: '#4821 · Refund issued & customer notified', meta: 'Front · Support' },
    { text: 'Acme Corp · Qualified & booked for tomorrow', meta: 'Salesforce · Sales' },
    { text: '#4822 · Draft ready for crew review', meta: 'WhatsApp · Copilot' },
    { text: 'Apollo.io · 14 prospects enriched & staged', meta: 'Apollo.io · Sales' },
    { text: 'Help center · 3 gaps flagged from real chats', meta: 'Notion · Support' },
    { text: 'CSAT 5/5 on #4819 · Follow-up closed loop', meta: 'Front · Support' },
    { text: '#4817 · Escalated to crew with full context', meta: 'Slack · Support' },
    { text: 'Loopwork · Moved to Negotiation, notes logged', meta: 'Salesforce · Sales' },
  ];
  const FLIGHTS = [
    { id: 'FL-1042', agent: 'Support', summary: '#4821 refund $48 · notified', result: 'Auto-resolved', time: '2m' },
    { id: 'FL-1041', agent: 'Sales', summary: 'Acme Corp demo booked Tue 10:00', result: 'Booked', time: '9m' },
    { id: 'FL-1040', agent: 'Support', summary: '#4822 draft awaiting approval', result: 'Needs review', time: '18m' },
    { id: 'FL-1039', agent: 'Sales', summary: '14 Apollo.io prospects enriched', result: 'Synced', time: '32m' },
    { id: 'FL-1038', agent: 'Support', summary: '#4817 escalated · sentiment angry', result: 'Escalated', time: '3h' },
  ];
  const USAGE = { res: 82, resMax: 100, meet: 7, meetMax: 10 };

  /* ---------- State ---------- */
  const K = 'flightai.v1.';
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(K + k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch {} },
    clear() { ['user', 'onboarding', 'connections', 'agents', 'plan', 'next'].forEach((k) => { try { localStorage.removeItem(K + k); } catch {} }); },
  };
  const state = {
    get user() { return store.get('user', null); },
    get ob() { return store.get('onboarding', null); },
    get conns() { return store.get('connections', {}); },
    get agents() { return store.get('agents', null); },
    get plan() { return store.get('plan', 'pilot'); },
  };
  const onboarded = () => !!(state.ob && state.ob.complete);
  const addedIds = () => (state.ob ? state.ob.connectors : []);
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

  /* ---------- Toasts ---------- */
  function toast(msg) {
    const box = $('#toasts');
    const el = document.createElement('p');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3400);
  }

  /* ---------- Router ---------- */
  const ROUTES = ['#/signin', '#/onboarding/connect', '#/onboarding/agents',
    '#/app/overview', '#/app/connections', '#/app/agents', '#/app/billing'];
  const APP_VIEWS = { '#/app/overview': 'overview', '#/app/connections': 'connections', '#/app/agents': 'agents', '#/app/billing': 'billing' };

  function resolve(target) {
    if (!ROUTES.includes(target)) target = state.user ? (onboarded() ? '#/app/overview' : obStep()) : '#/signin';
    if (!state.user && target !== '#/signin') { store.set('next', target); return '#/signin'; }
    if (state.user && !onboarded() && target.startsWith('#/app')) return obStep();
    if (state.user && onboarded() && (target === '#/signin' || target.startsWith('#/onboarding'))) {
      const next = store.get('next', null);
      store.set('next', null);
      return (next && next.startsWith('#/app')) ? next : '#/app/overview';
    }
    return target;
  }
  function obStep() {
    const ob = state.ob;
    return ob && ob.step === 2 ? '#/onboarding/agents' : '#/onboarding/connect';
  }

  const SKIP_BY_ROUTE = { '#/signin': '#main', '#/onboarding/connect': '#mainConnect', '#/onboarding/agents': '#mainAgents' };
  function show(route) {
    ensureDefaults();
    $$('.view').forEach((v) => { v.hidden = true; });
    const mainSel = route.startsWith('#/app') ? '#mainApp' : SKIP_BY_ROUTE[route];
    document.querySelector('.skip').setAttribute('href', mainSel);
    document.body.classList.toggle('auth', !route.startsWith('#/app'));
    document.title = route === '#/signin' ? 'Flight AI — Sign in'
      : route.startsWith('#/onboarding') ? 'Flight AI — Onboarding'
      : 'Flight AI — Workspace';
    if (route === '#/signin') { $('#main').hidden = false; }
    else if (route === '#/onboarding/connect') { $('#mainConnect').hidden = false; renderObGrid(); }
    else if (route === '#/onboarding/agents') { $('#mainAgents').hidden = false; syncObAgents(); }
    else if (route.startsWith('#/app')) {
      $('#viewApp').hidden = false;
      renderApp(APP_VIEWS[route]);
    }
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
    $('#avatarMenu').hidden = true;
    $('#avatarBtn').setAttribute('aria-expanded', 'false');
    show(dest);
  }
  window.addEventListener('hashchange', sync);

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
    btn.disabled = true;
    $('#googleLabel').innerHTML = '<span class="spin" aria-hidden="true"></span> Clearing you for takeoff…';
    setTimeout(() => {
      const email = signupEmail || 'pilot@flight.ai';
      const name = signupEmail ? prettyName(signupEmail) : 'Alex Rivera';
      store.set('user', { name, email, avatar: initials(name), provider: 'google' });
      if (!state.ob) store.set('onboarding', { step: 1, connectors: [], support: true, sales: false, mode: 'copilot', complete: false });
      btn.disabled = false;
      $('#googleLabel').textContent = 'Continue with Google';
      toast(`Welcome aboard, ${name.split(' ')[0]}.`);
      go('#/onboarding/connect');
    }, reduceMotion ? 60 : 900);
  });

  /* ---------- Onboarding: connect ---------- */
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
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'conn-card';
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `<span class="clogo"><img src="assets/connectors/${c.id}.svg" alt="" loading="lazy"></span>
        <span><strong>${c.name}</strong><small>${c.cat} · ${c.blurb}</small></span>
        <span class="add-pill">${on ? '✓ Added' : '+ Add'}</span>`;
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

  /* ---------- Onboarding: agents ---------- */
  function setSwitch(el, on) { el.setAttribute('aria-checked', String(on)); }
  function syncObAgents() {
    const ob = state.ob || {};
    setSwitch($('#obSupport'), ob.support !== false);
    setSwitch($('#obSales'), !!ob.sales);
    const mode = ob.mode || 'copilot';
    const radio = document.querySelector(`input[name="obMode"][value="${mode}"]`);
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
    if (!ob.connectors || ob.connectors.length === 0) ob.connectors = ['front', 'salesforce'];
    ob.complete = true;
    store.set('onboarding', ob);
    store.set('agents', { support: ob.support !== false, sales: !!ob.sales, mode: ob.mode || 'copilot', threshold: 100 });
    const conns = {};
    ob.connectors.slice(0, 2).forEach((id) => { conns[id] = { status: 'connected', at: new Date().toISOString() }; });
    store.set('connections', conns);
    const btn = $('#obLaunch');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Preparing your flight deck…';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = 'Launch workspace <span aria-hidden="true">→</span>';
      toast('Workspace ready. Welcome aboard.');
      const next = store.get('next', null);
      store.set('next', null);
      go(next && next.startsWith('#/app/') ? next : '#/app/overview');
    }, reduceMotion ? 60 : 700);
  }
  $('#obLaunch').addEventListener('click', () => launch());
  $('#obSkip2').addEventListener('click', () => launch({ support: true, sales: false, mode: 'copilot' }));

  /* ---------- Workspace shell ---------- */
  function renderApp(tab) {
    const user = state.user;
    $('#avatarBtn').textContent = user.avatar;
    $('#menuName').textContent = user.name;
    $('#menuEmail').textContent = user.email;
    const domain = (user.email.split('@')[1] || 'acme.co').split('.')[0];
    $('#wsName').textContent = `${domain.charAt(0).toUpperCase() + domain.slice(1)} workspace`;
    const growth = state.plan === 'growth';
    const pill = $('#planPill');
    pill.textContent = growth ? 'Growth' : 'Free pilot';
    pill.classList.toggle('growth', growth);
    $$('.side-link, .tabs a').forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $$('[data-tabpanel]').forEach((s) => { s.hidden = s.dataset.tabpanel !== tab; });
    if (tab === 'overview') renderOverview();
    if (tab === 'connections') renderConnGrid($('#connSearch').value || '');
    if (tab === 'agents') renderAgentsTab();
    if (tab === 'billing') renderBilling();
  }
  $('#avatarBtn').addEventListener('click', () => {
    const menu = $('#avatarMenu');
    const open = menu.hidden;
    menu.hidden = !open;
    $('#avatarBtn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.avatar-wrap')) {
      $('#avatarMenu').hidden = true;
      $('#avatarBtn').setAttribute('aria-expanded', 'false');
    }
  });
  function signOut(msg) {
    store.clear();
    $('#avatarMenu').hidden = true;
    toast(msg || 'Signed out. Demo reset.');
    go('#/signin');
  }
  $('#signOutBtn').addEventListener('click', () => signOut());
  $('#resetDemo').addEventListener('click', () => signOut('Demo reset. Fresh runway.'));

  /* ---------- Overview ---------- */
  let feedTimer = null;
  let feedIdx = 0;
  function feedItem(ev, when) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="fdot" aria-hidden="true"></span><span><strong></strong><small></small></span>`;
    li.querySelector('strong').textContent = ev.text;
    li.querySelector('small').textContent = `${when} · ${ev.meta}`;
    return li;
  }
  function renderOverview() {
    const user = state.user;
    const h = new Date().getHours();
    const day = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const first = user.name.split(' ')[0];
    $('#greetTitle').textContent = `Good ${day}, ${first}.`;
    $('#greetSub').textContent = `Here’s your flight deck for ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.`;
    $('#usageBanner').style.display = state.plan === 'growth' ? 'none' : 'flex';
    const agents = state.agents || { support: true, sales: false, mode: 'copilot' };
    const pill = (on) => !on ? '<span class="mode-pill">Paused</span>'
      : agents.mode === 'autopilot' ? '<span class="mode-pill on">Autopilot on</span>' : '<span class="mode-pill co">Copilot</span>';
    const box = $('#agentStatus');
    if (!agents.support && !agents.sales) {
      box.innerHTML = `<p class="micro">Agents paused. Nothing is flying right now. <a class="textlink" href="#/app/agents">Resume →</a></p>`;
      $('#feedNote').textContent = 'Paused — showing recent history';
      document.querySelector('#tabOverview .stats').classList.add('dimmed');
    } else {
      box.innerHTML = `<div class="agent-row"><strong>Support Agent</strong>${pill(agents.support)}</div>
        <div class="agent-row"><strong>Sales Agent</strong>${pill(agents.sales)}</div>`;
      $('#feedNote').textContent = 'Updated just now';
      document.querySelector('#tabOverview .stats').classList.remove('dimmed');
    }
    const added = addedIds();
    const conn = connectedIds();
    $('#ovConnSummary').textContent = added.length === 0 ? 'No connections yet.'
      : `${conn.length} of ${added.length} connected`;
    const logos = $('#ovLogos');
    logos.innerHTML = '';
    added.slice(0, 8).forEach((id) => {
      const c = byId(id);
      if (!c) return;
      const s = document.createElement('span');
      s.className = 'clogo';
      s.title = c.name;
      const img = document.createElement('img');
      img.src = `assets/connectors/${id}.svg`;
      img.alt = '';
      s.appendChild(img);
      logos.appendChild(s);
    });
    const feed = $('#feedList');
    feed.innerHTML = '';
    const times = ['2m ago', '9m ago', '18m ago', '32m ago', '1h ago', '2h ago', '3h ago', '5h ago'];
    ACTIVITY.forEach((ev, i) => feed.appendChild(feedItem(ev, times[i] || '')));
    if (feedTimer) clearInterval(feedTimer);
    if (!reduceMotion) {
      feedTimer = setInterval(() => {
        if (document.hidden || $('#tabOverview').hidden) return;
        const ev = ACTIVITY[feedIdx % ACTIVITY.length];
        feedIdx += 1;
        feed.prepend(feedItem(ev, 'just now'));
        while (feed.children.length > 20) feed.lastChild.remove();
        $('#feedNote').textContent = 'Updated just now';
      }, 12000);
    }
  }

  /* ---------- Connections ---------- */
  function renderConnGrid(filter) {
    const grid = $('#connGrid');
    const added = addedIds();
    const conns = state.conns;
    const q = (filter || '').trim().toLowerCase();
    const list = CONNECTORS.filter((c) => !q || c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q));
    $('#connEmpty').hidden = added.length !== 0;
    $('#connNoMatch').hidden = list.length !== 0;
    const conn = connectedIds();
    $('#connCount').textContent = added.length === 0 ? '' : `${conn.length} of ${added.length} connected`;
    grid.innerHTML = '';
    list.forEach((c) => {
      const isAdded = added.includes(c.id);
      const isConn = conns[c.id] && conns[c.id].status === 'connected';
      const card = document.createElement('div');
      card.className = 'conn-card';
      card.style.cursor = 'default';
      card.innerHTML = `<span class="clogo"><img src="assets/connectors/${c.id}.svg" alt="" loading="lazy"></span>
        <span><strong>${c.name}</strong><small>${c.cat} · ${c.blurb}</small></span>
        <span class="status-pill ${isConn ? 'conn' : 'idle'}">${isConn ? '✓ Connected' : isAdded ? 'Added' : 'Not added'}</span>
        <span class="conn-actions"></span>`;
      const actions = card.querySelector('.conn-actions');
      if (!isAdded) {
        const add = document.createElement('button');
        add.type = 'button'; add.className = 'btn outline small'; add.textContent = '+ Add to workspace';
        add.addEventListener('click', () => {
          const ob = state.ob;
          ob.connectors = [...addedIds(), c.id];
          store.set('onboarding', ob);
          toast(`${c.name} added to your workspace.`);
          renderConnGrid($('#connSearch').value || '');
        });
        actions.appendChild(add);
      } else if (!isConn) {
        const go2 = document.createElement('button');
        go2.type = 'button'; go2.className = 'btn solid small'; go2.textContent = 'Connect';
        go2.addEventListener('click', () => openOAuth(c.id));
        actions.appendChild(go2);
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'btn danger-ghost small'; rm.textContent = 'Remove';
        rm.addEventListener('click', () => {
          const ob = state.ob;
          ob.connectors = addedIds().filter((x) => x !== c.id);
          store.set('onboarding', ob);
          toast(`${c.name} removed.`);
          renderConnGrid($('#connSearch').value || '');
        });
        actions.appendChild(rm);
      } else {
        const sync = document.createElement('button');
        sync.type = 'button'; sync.className = 'btn outline small'; sync.textContent = 'Sync now';
        sync.addEventListener('click', () => toast(`${c.name} sync started. Fresh data in a minute.`));
        actions.appendChild(sync);
        const dc = document.createElement('button');
        dc.type = 'button'; dc.className = 'btn danger-ghost small'; dc.textContent = 'Disconnect';
        dc.addEventListener('click', () => {
          const conns = state.conns;
          delete conns[c.id];
          store.set('connections', conns);
          toast(`${c.name} disconnected. Reconnect anytime.`);
          renderConnGrid($('#connSearch').value || '');
        });
        actions.appendChild(dc);
      }
      grid.appendChild(card);
    });
  }
  $('#connSearch').addEventListener('input', (e) => renderConnGrid(e.target.value));

  /* ---------- Agents tab ---------- */
  function renderAgentsTab() {
    const a = state.agents || { support: true, sales: false, mode: 'copilot', threshold: 100 };
    setSwitch($('#wSupport'), !!a.support);
    setSwitch($('#wSales'), !!a.sales);
    const pillTxt = a.mode === 'autopilot' ? 'Autopilot' : 'Copilot';
    const cls = a.mode === 'autopilot' ? 'mode-pill on' : 'mode-pill co';
    [['#wSupportPill', a.support], ['#wSalesPill', a.sales]].forEach(([sel, on]) => {
      const el = $(sel);
      el.className = on ? cls : 'mode-pill';
      el.textContent = on ? pillTxt : 'Paused';
    });
    $('#threshold').value = String(a.threshold || 100);
    $('#modeCopilot').setAttribute('aria-pressed', String(a.mode !== 'autopilot'));
    $('#modeAuto').setAttribute('aria-pressed', String(a.mode === 'autopilot'));
    $('#modeHelp').textContent = a.mode === 'autopilot'
      ? 'Autopilot — AI acts within guardrails.'
      : (state.plan === 'growth' ? 'Copilot — AI drafts, crew approves.' : 'Copilot — AI drafts, crew approves. Autopilot unlocks on Growth.');
    const tb = $('#flightsBody');
    tb.innerHTML = '';
    if (!a.support && !a.sales) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5">No flights yet. Enable an agent to log its first run.</td>';
      tb.appendChild(tr);
    } else {
      FLIGHTS.filter((f) => (f.agent === 'Support' && a.support) || (f.agent === 'Sales' && a.sales))
        .forEach((f) => {
          const tr = document.createElement('tr');
          [f.id, f.agent, f.summary, f.result, f.time].forEach((v) => {
            const td = document.createElement('td');
            td.textContent = v;
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
    }
  }
  [['#wSupport', 'support', 'Support Agent'], ['#wSales', 'sales', 'Sales Agent']].forEach(([sel, key, label]) => {
    $(sel).addEventListener('click', () => {
      const a = state.agents;
      a[key] = !a[key];
      store.set('agents', a);
      renderAgentsTab();
      toast(a[key] ? `${label} resumed.` : `${label} paused.`);
    });
  });
  $('#threshold').addEventListener('change', (e) => {
    const a = state.agents;
    a.threshold = parseInt(e.target.value, 10);
    store.set('agents', a);
    toast('Saved.');
  });
  $('#modeCopilot').addEventListener('click', () => {
    const a = state.agents;
    a.mode = 'copilot';
    store.set('agents', a);
    renderAgentsTab();
    toast('Copilot mode. Crew approves every action.');
  });
  $('#modeAuto').addEventListener('click', () => {
    if (state.plan !== 'growth') {
      toast('Autopilot unlocks on Growth. You’re in copilot for now.');
      return;
    }
    const a = state.agents;
    a.mode = 'autopilot';
    store.set('agents', a);
    renderAgentsTab();
    toast('Autopilot on. Flying within your guardrails.');
  });
  $('#auditLink').addEventListener('click', () => {
    if (state.plan !== 'growth') toast('Audit log export is a Growth feature.');
    else toast('Audit log exported. Check your inbox.');
  });

  /* ---------- Billing ---------- */
  function renderBilling() {
    const growth = state.plan === 'growth';
    $('#meterResTxt').textContent = growth ? `${USAGE.res} / 1,000` : `${USAGE.res} / ${USAGE.resMax}`;
    $('#meterMeetTxt').textContent = growth ? `${USAGE.meet} / 50` : `${USAGE.meet} / ${USAGE.meetMax}`;
    $('#meterRes').style.width = growth ? '8%' : `${Math.round((USAGE.res / USAGE.resMax) * 100)}%`;
    $('#meterMeet').style.width = growth ? '14%' : `${Math.round((USAGE.meet / USAGE.meetMax) * 100)}%`;
    $('#meterRes').classList.toggle('hot', !growth && USAGE.res >= 80);
    const pilot = $('#btnPilot');
    pilot.disabled = true;
    pilot.textContent = growth ? 'Included in Growth' : 'Current plan';
    pilot.title = growth ? 'Contact sales to downgrade' : '';
    const bg = $('#btnGrowth');
    bg.disabled = growth;
    bg.textContent = growth ? 'Current plan' : 'Upgrade to Growth';
  }
  $('#btnGrowth').addEventListener('click', () => {
    if (state.plan === 'growth') return;
    openModal('#checkoutModal');
    $('#coAsk').hidden = false;
    $('#coDone').hidden = true;
  });

  /* ---------- Modals ---------- */
  let lastFocus = null;
  function openModal(sel) {
    lastFocus = document.activeElement;
    const modal = $(sel);
    modal.hidden = false;
    const f = modal.querySelector('button, a');
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
      $('#avatarMenu').hidden = true;
      $('#avatarBtn').setAttribute('aria-expanded', 'false');
    }
  });
  $('#ssoBtn').addEventListener('click', () => openModal('#ssoModal'));
  $('#ssoCancel').addEventListener('click', () => closeModal('#ssoModal'));
  $('#ssoGoogle').addEventListener('click', () => { closeModal('#ssoModal'); $('#googleBtn').click(); });

  let oauthId = null;
  function openOAuth(id) {
    const c = byId(id);
    if (!c) return;
    oauthId = id;
    $('#oauthAsk').hidden = false;
    $('#oauthDone').hidden = true;
    $('#oauthLogo').innerHTML = `<img src="assets/connectors/${id}.svg" alt="">`;
    $('#oauthTitle').textContent = `Connect ${c.name} to Flight AI`;
    $('#oauthCard').setAttribute('aria-labelledby', 'oauthTitle');
    $('#oauthDesc').textContent = `Flight will ${c.blurb.toLowerCase()}. It never deletes without approval.`;
    $('#oauthPerms').innerHTML = '';
    c.perms.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p;
      $('#oauthPerms').appendChild(li);
    });
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
      $('#oauthLogo2').innerHTML = `<img src="assets/connectors/${oauthId}.svg" alt="">`;
      $('#oauthDoneTitle').textContent = `${c.name} connected`;
      $('#oauthCard').setAttribute('aria-labelledby', 'oauthDoneTitle');
      $('#oauthDoneDesc').textContent = 'Initial sync started. History lands in a few minutes.';
      $('#oauthClose').focus();
    }, reduceMotion ? 60 : 1100);
  });
  $('#oauthClose').addEventListener('click', () => {
    const c = byId(oauthId);
    closeModal('#oauthModal');
    toast(`${c ? c.name : 'Integration'} connected.`);
    renderConnGrid($('#connSearch').value || '');
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
    renderApp('billing');
  });

  /* ---------- Boot ---------- */
  sync();
})();


