/** Read-only provider adapters. Credentials never leave the server. */
export const CONNECTORS = Object.freeze([
  { id: 'gmail', name: 'Gmail', description: 'Customer email threads from your Google mailbox.', lenses: ['sales', 'support'], scopes: ['https://www.googleapis.com/auth/gmail.readonly'] },
  { id: 'microsoft', name: 'Microsoft 365', description: 'Customer email threads from Outlook.', lenses: ['sales', 'support'], scopes: ['User.Read', 'Mail.Read', 'offline_access'] },
  { id: 'hubspot', name: 'HubSpot', description: 'Customer conversations from Inbox and Help Desk.', lenses: ['sales', 'support'], scopes: ['conversations.read'] },
  { id: 'zendesk', name: 'Zendesk', description: 'Support tickets and public conversation history.', lenses: ['support'], scopes: ['tickets:read', 'users:read'] },
  { id: 'intercom', name: 'Intercom', description: 'Customer conversations from your US Intercom workspace.', lenses: ['support', 'sales'], scopes: ['Read conversations', 'Read one admin'] },
]);
export class ConnectorError extends Error {
  constructor(code, message, status = 502) { super(message); this.name = 'ConnectorError'; this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new ConnectorError(code, message, status); };
function provider(id) { return CONNECTORS.find(p => p.id === id) || fail('unsupported_provider', 'Unsupported connector.', 400); }
function credentials(id, env) { provider(id); const prefix = `CONNECTOR_${id.toUpperCase()}_`; return { client_id: env[`${prefix}CLIENT_ID`], client_secret: env[`${prefix}CLIENT_SECRET`] }; }
export function connectorReady(id, env = process.env) { if (!CONNECTORS.some(p => p.id === id)) return false; const c = credentials(id, env); return Boolean(c.client_id && c.client_secret); }
function zendesk(config = {}) {
  const sub = config.subdomain;
  if (typeof sub !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)) fail('invalid_config', 'Enter your Zendesk subdomain, without a URL.', 400);
  return `https://${sub}.zendesk.com`;
}
function endpoints(id, config) {
  provider(id);
  return {
    gmail: ['https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token'],
    microsoft: ['https://login.microsoftonline.com/common/oauth2/v2.0/authorize', 'https://login.microsoftonline.com/common/oauth2/v2.0/token'],
    hubspot: ['https://app.hubspot.com/oauth/authorize', 'https://api.hubapi.com/oauth/2026-03/token'],
    intercom: ['https://app.intercom.com/oauth', 'https://api.intercom.io/auth/eagle/token'],
    ...(id === 'zendesk' ? { zendesk: [`${zendesk(config)}/oauth/authorizations/new`, `${zendesk(config)}/oauth/tokens`] } : {}),
  }[id];
}
export function authorizationUrl(id, { redirectUri, state, codeChallenge, config }, env = process.env) {
  if (!connectorReady(id, env)) fail('not_configured', 'This connector is not configured yet.', 503);
  const url = new URL(endpoints(id, config)[0]);
  const fields = { client_id: credentials(id, env).client_id, redirect_uri: redirectUri, state, response_type: 'code' };
  if (!state || !redirectUri) fail('invalid_oauth', 'Missing OAuth request parameters.', 400);
  if (id !== 'intercom') fields.scope = provider(id).scopes.join(' ');
  if (['gmail', 'microsoft', 'zendesk'].includes(id)) {
    if (!codeChallenge) fail('invalid_oauth', 'PKCE is required.', 400);
    fields.code_challenge = codeChallenge; fields.code_challenge_method = 'S256';
  }
  if (id === 'gmail') Object.assign(fields, { access_type: 'offline', prompt: 'consent' });
  for (const [k, v] of Object.entries(fields)) url.searchParams.set(k, v);
  return url.href;
}
function reader(fetchImpl, accessToken, extraHeaders = {}) {
  const signal = AbortSignal.timeout(30_000);
  return async (url, options = {}) => {
    let response;
    try { response = await fetchImpl(url, { ...options, redirect: 'error', signal, headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...extraHeaders, ...options.headers } }); }
    catch { fail('provider_unavailable', 'The connector could not be reached. Please retry.'); }
    if (!response.ok) {
      if (response.status === 401) fail('reauthorize', 'Reconnect this source to renew access.', 401);
      if (response.status === 403) fail('permission_denied', 'The source did not grant the required read access.', 403);
      if (response.status === 429) fail('rate_limited', 'The source is rate limited. Try again later.', 429);
      fail('provider_error', 'The source could not complete this request.');
    }
    // Enforce a streaming size cap instead of trusting Content-Length.
    let raw = '';
    if (response.body?.getReader) {
      const stream = response.body.getReader(); let bytes = 0; const decoder = new TextDecoder();
      while (true) { const { value, done } = await stream.read(); if (done) break; bytes += value.byteLength; if (bytes > 4_000_000) { await stream.cancel(); fail('response_too_large', 'This source response exceeds the safe batch size.'); } raw += decoder.decode(value, { stream: true }); }
      raw += decoder.decode();
    } else raw = await response.text();
    if (raw.length > 4_000_000) fail('response_too_large', 'This source response exceeds the safe batch size.');
    try { return JSON.parse(raw); } catch { fail('provider_error', 'The source returned an unreadable response.'); }
  };
}
function form(fields) { return { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }; }
function safeText(value, max = 20000) { const s = typeof value === 'string' ? value : ''; if (s.length > max) fail('incomplete_history', 'A conversation exceeds the safe analysis size. No partial history was analyzed.'); return s; }
function plain(value) { return safeText(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim(); }
function iso(value) { const d = new Date(typeof value === 'number' ? value * 1000 : value); if (!Number.isFinite(d.getTime())) fail('provider_error', 'The source returned an invalid message timestamp.'); return d.toISOString(); }
function opaque(value) { if (value == null || value === '') return null; if (typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value)) fail('invalid_cursor', 'Invalid continuation cursor.', 400); return value; }
function pathId(id) { if (!['string', 'number'].includes(typeof id) || !String(id) || String(id).length > 512) fail('provider_error', 'The source returned an invalid record ID.'); return encodeURIComponent(String(id)); }
function nextUrl(value, origin, path) { if (!value) return null; let u; try { u = new URL(opaque(value)); } catch { fail('invalid_cursor', 'Invalid continuation cursor.', 400); } if (u.origin !== origin || u.pathname !== path || u.username || u.password || u.hash) fail('invalid_cursor', 'The source returned an unsafe continuation URL.', 400); return u.href; }
function records(value, maximum = 500) { if (!Array.isArray(value) || value.length > maximum) fail('provider_error', 'The source returned an invalid or oversized record list.'); return value; }
function result(conversations, nextCursor) { return { conversations, nextCursor: nextCursor || null, hasMore: Boolean(nextCursor) }; }
function conversation(id, subject, messages, sourceUrl) {
  if (messages.length > 500) fail('incomplete_history', 'A conversation exceeds the safe analysis size. No partial history was analyzed.');
  messages.sort((a, b) => a.at.localeCompare(b.at));
  const customer = messages.find(m => m.role === 'customer');
  return { externalId: String(id), subject: safeText(subject || 'Conversation', 1000), customer: { name: customer?.sender || 'Unknown customer', company: '' }, messages, ...(sourceUrl ? { sourceUrl } : {}) };
}
async function identity(id, token, config, env, fetchImpl) {
  const get = reader(fetchImpl, token);
  if (id === 'gmail') { const p = await get('https://gmail.googleapis.com/gmail/v1/users/me/profile'); return { accountId: p.emailAddress?.toLowerCase(), accountLabel: p.emailAddress }; }
  if (id === 'microsoft') { const p = await get('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName'); return { accountId: p.id, accountLabel: p.mail || p.userPrincipalName }; }
  if (id === 'zendesk') { const p = await get(`${zendesk(config)}/api/v2/users/me.json`); return { accountId: config.subdomain, accountLabel: p.user?.email || p.user?.name }; }
  if (id === 'intercom') { const p = await get('https://api.intercom.io/me'); if (p.app?.region && p.app.region !== 'US') fail('unsupported_region', 'Only US Intercom workspaces are supported currently.', 400); return { accountId: p.app?.id_code, accountLabel: p.app?.name || p.email }; }
  const p = await get('https://api.hubapi.com/oauth/2026-03/token/introspect', form({ ...credentials(id, env), token, token_type_hint: 'access_token' }));
  if (p.active === false) fail('reauthorize', 'Reconnect this source to renew access.', 401);
  return { accountId: p.hub_id == null ? undefined : String(p.hub_id), accountLabel: p.hub_domain || (p.hub_id ? `HubSpot account ${p.hub_id}` : undefined) };
}
async function tokenRequest(id, args, env, fetchImpl, refresh) {
  if (!connectorReady(id, env)) fail('not_configured', 'This connector is not configured yet.', 503);
  if (refresh && id === 'intercom') fail('reauthorize', 'Reconnect Intercom to renew access.', 401);
  const fields = { ...credentials(id, env), grant_type: refresh ? 'refresh_token' : 'authorization_code' };
  if (refresh) fields.refresh_token = args.refreshToken;
  else { fields.code = args.code; fields.redirect_uri = args.redirectUri; if (['gmail', 'microsoft', 'zendesk'].includes(id)) fields.code_verifier = args.codeVerifier; }
  if (!(refresh ? fields.refresh_token : fields.code)) fail('invalid_oauth', 'Missing OAuth code or token.', 400);
  if (!refresh && ['gmail', 'microsoft', 'zendesk'].includes(id) && !args.codeVerifier) fail('invalid_oauth', 'PKCE verifier is required.', 400);
  if (id === 'microsoft') fields.scope = provider(id).scopes.join(' ');
  const data = await reader(fetchImpl)(endpoints(id, args.config)[1], form(fields));
  const accessToken = data.access_token;
  if (typeof accessToken !== 'string' || !accessToken) fail('provider_error', 'The provider did not issue access.');
  const expires = Number(data.expires_in);
  const account = refresh ? undefined : await identity(id, accessToken, args.config, env, fetchImpl);
  if (!refresh && (!account.accountId || !account.accountLabel)) fail('provider_error', 'The source account identity could not be verified.');
  return { accessToken, ...(typeof data.refresh_token === 'string' ? { refreshToken: data.refresh_token } : {}), ...(Number.isFinite(expires) && expires > 0 ? { expiresAt: new Date(Date.now() + expires * 1000).toISOString() } : {}), ...(account ? { accountId: safeText(String(account.accountId), 320), accountLabel: safeText(account.accountLabel, 320) } : {}) };
}
export function exchangeCode(id, args, env = process.env, fetchImpl = fetch) { return tokenRequest(id, args, env, fetchImpl, false); }
export function refreshAccess(id, args, env = process.env, fetchImpl = fetch) { return tokenRequest(id, args, env, fetchImpl, true); }
function gmailBody(payload) {
  const parts = []; function walk(p) { if (!p) return; if (p.mimeType === 'text/plain' && p.body?.data) parts.push(Buffer.from(p.body.data, 'base64url').toString('utf8')); for (const child of p.parts || []) walk(child); }
  walk(payload); if (parts.length) return safeText(parts.join('\n'));
  if (payload?.body?.data) return plain(Buffer.from(payload.body.data, 'base64url').toString('utf8'));
  function html(p) { if (p?.mimeType === 'text/html' && p.body?.data) parts.push(plain(Buffer.from(p.body.data, 'base64url').toString('utf8'))); for (const child of p?.parts || []) html(child); }
  html(payload); return safeText(parts.join('\n'));
}
function emailAddress(from) { return (String(from).match(/<([^>]+)>/)?.[1] || String(from)).trim().toLowerCase(); }
export async function fetchConversations(id, { accessToken, config = {}, cursor, limit = 10 }, fetchImpl = fetch) {
  provider(id); if (!accessToken) fail('reauthorize', 'Reconnect this source to renew access.', 401);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) fail('invalid_limit', 'Batch size must be between 1 and 10.', 400);
  cursor = opaque(cursor); const get = reader(fetchImpl, accessToken, id === 'intercom' ? { 'Intercom-Version': '2.11' } : {});
  const conversations = [];
  if (id === 'gmail') {
    const base = 'https://gmail.googleapis.com/gmail/v1/users/me';
    const me = await get(`${base}/profile`); if (!me.emailAddress) fail('provider_error', 'Mailbox identity could not be verified.');
    const query = new URLSearchParams({ maxResults: String(limit), ...(cursor ? { pageToken: cursor } : {}) });
    const list = await get(`${base}/threads?${query}`);
    if (!Array.isArray(list.threads) && list.resultSizeEstimate !== 0) fail('provider_error', 'The source returned an invalid record list.');
    for (const t of records(list.threads ?? [], limit)) {
      const thread = await get(`${base}/threads/${pathId(t.id)}?format=full`);
      const header = (m, name) => m.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value || '';
      const messages = records(thread.messages).filter(m => !m.labelIds?.includes('DRAFT')).map(m => { const sender = header(m, 'from'); const text = gmailBody(m.payload); if (!text && (m.snippet || m.payload?.body?.attachmentId)) fail('incomplete_history', 'A source message body is unavailable.'); return { id: String(m.id), sender, role: (m.labelIds?.includes('SENT') || emailAddress(sender) === me.emailAddress.toLowerCase()) ? 'teammate' : sender ? 'customer' : 'unknown', at: iso(new Date(Number(m.internalDate)).toISOString()), text }; });
      conversations.push(conversation(t.id, header(thread.messages?.[0] || {}, 'subject'), messages, `https://mail.google.com/mail/u/0/#all/${pathId(t.id)}`));
    }
    return result(conversations, opaque(list.nextPageToken));
  }
  if (id === 'microsoft') {
    const origin = 'https://graph.microsoft.com'; const path = '/v1.0/me/messages';
    const me = await get(`${origin}/v1.0/me?$select=mail,userPrincipalName`); const mailbox = (me.mail || me.userPrincipalName || '').toLowerCase();
    if (!mailbox) fail('provider_error', 'Mailbox identity could not be verified.');
    const list = await get(cursor ? nextUrl(cursor, origin, path) : `${origin}${path}?$top=${limit}&$select=id,conversationId&$orderby=receivedDateTime%20desc`);
    for (const cid of new Set(records(list.value, limit).map(m => m.conversationId))) {
      if (typeof cid !== 'string' || cid.length > 512) fail('provider_error', 'The source returned an invalid conversation.');
      const q = new URLSearchParams({ '$filter': `conversationId eq '${cid.replaceAll("'", "''")}'`, '$top': '100', '$select': 'id,subject,from,sentDateTime,receivedDateTime,body,webLink,isDraft' });
      const thread = await get(`${origin}${path}?${q}`, { headers: { Prefer: 'outlook.body-content-type="text"' } });
      if (thread['@odata.nextLink']) fail('incomplete_history', 'This email thread exceeds the safe analysis size. No partial history was analyzed.');
      const messages = records(thread.value).filter(m => !m.isDraft).map(m => ({ id: String(m.id), sender: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown sender', role: !m.from?.emailAddress?.address ? 'unknown' : m.from.emailAddress.address.toLowerCase() === mailbox ? 'teammate' : 'customer', at: iso(m.sentDateTime || m.receivedDateTime), text: m.body?.contentType?.toLowerCase() === 'html' ? plain(m.body.content) : safeText(m.body?.content) }));
      conversations.push(conversation(cid, thread.value?.[0]?.subject, messages));
    }
    return result(conversations, nextUrl(list['@odata.nextLink'], origin, path));
  }
  if (id === 'hubspot') {
    const base = 'https://api.hubapi.com/conversations/v3/conversations/threads';
    const q = new URLSearchParams({ limit: String(limit), ...(cursor ? { after: cursor } : {}) }); const list = await get(`${base}?${q}`);
    for (const thread of records(list.results, limit)) {
      const all = []; let after = null;
      for (let page = 0; page < 5; page++) {
        const mq = new URLSearchParams({ limit: '100', ...(after ? { after } : {}) }); const data = await get(`${base}/${pathId(thread.id)}/messages?${mq}`);
        if (data.paging?.next && !data.paging.next.after) fail('provider_error', 'The source omitted its continuation cursor.');
        all.push(...records(data.results, 100)); after = opaque(data.paging?.next?.after); if (!after) break;
      }
      if (after || all.some(m => m.truncationStatus && m.truncationStatus !== 'NOT_TRUNCATED')) fail('incomplete_history', 'HubSpot returned incomplete message history. No partial history was analyzed.');
      const messages = all.filter(m => m.type === 'MESSAGE' && !m.archived && (!m.status?.statusType || m.status.statusType === 'SENT')).map(m => ({ id: String(m.id), sender: m.senders?.[0]?.name || m.senders?.[0]?.deliveryIdentifier?.value || 'Unknown sender', role: m.direction === 'INCOMING' ? 'customer' : m.direction === 'OUTGOING' ? 'teammate' : 'unknown', at: iso(m.createdAt), text: m.text ? safeText(m.text) : plain(m.richText) }));
      conversations.push(conversation(thread.id, all.find(m => m.subject)?.subject, messages));
    }
    if (list.paging?.next && !list.paging.next.after) fail('provider_error', 'The source omitted its continuation cursor.');
    return result(conversations, opaque(list.paging?.next?.after));
  }
  if (id === 'zendesk') {
    const origin = zendesk(config); const path = '/api/v2/tickets.json';
    const list = await get(cursor ? nextUrl(cursor, origin, path) : `${origin}${path}?page[size]=${limit}&sort_by=updated_at&sort_order=desc`);
    for (const ticket of records(list.tickets, limit)) {
      let url = `${origin}/api/v2/tickets/${pathId(ticket.id)}/comments.json?page[size]=100&include=users`; const all = []; const users = new Map();
      for (let page = 0; page < 5 && url; page++) { const data = await get(url); all.push(...records(data.comments, 100)); for (const u of data.users || []) users.set(u.id, u); url = nextUrl(data.links?.next || data.next_page, origin, `/api/v2/tickets/${pathId(ticket.id)}/comments.json`); }
      if (url) fail('incomplete_history', 'This ticket exceeds the safe analysis size. No partial history was analyzed.');
      const messages = all.filter(m => m.public).map(m => { const user = users.get(m.author_id); return { id: String(m.id), sender: user?.name || `Participant ${m.author_id}`, role: user?.role === 'end-user' ? 'customer' : ['agent', 'admin'].includes(user?.role) ? 'teammate' : m.author_id === ticket.requester_id ? 'customer' : 'unknown', at: iso(m.created_at), text: safeText(m.plain_body || m.body) }; });
      conversations.push(conversation(ticket.id, ticket.subject, messages, `${origin}/agent/tickets/${pathId(ticket.id)}`));
    }
    return result(conversations, nextUrl(list.links?.next || list.next_page, origin, path));
  }
  const q = new URLSearchParams({ per_page: String(limit), ...(cursor ? { starting_after: cursor } : {}) }); const list = await get(`https://api.intercom.io/conversations?${q}`);
  for (const c of records(list.conversations, limit)) {
    const data = await get(`https://api.intercom.io/conversations/${pathId(c.id)}?display_as=plaintext`);
    const parts = data.conversation_parts?.conversation_parts || [];
    if (parts.length >= 500 || data.conversation_parts?.total_count > parts.length) fail('incomplete_history', 'Intercom may have omitted older conversation history. No partial history was analyzed.');
    const records = [{ ...data.source, created_at: data.created_at }, ...parts.filter(p => p.part_type === 'comment')];
    if (records.some(m => m.redacted)) fail('incomplete_history', 'Some source messages are redacted. No partial history was analyzed.');
    const messages = records.filter(m => m.body && !m.redacted).map(m => ({ id: String(m.id), sender: m.author?.name || m.author?.email || 'Unknown sender', role: ['user', 'lead', 'contact'].includes(m.author?.type) ? 'customer' : m.author?.type === 'admin' ? 'teammate' : 'unknown', at: iso(m.created_at), text: safeText(m.body) }));
    conversations.push(conversation(c.id, data.title || data.source?.subject, messages));
  }
  if (list.pages?.next && !list.pages.next.starting_after) fail('provider_error', 'The source omitted its continuation cursor.');
  return result(conversations, opaque(list.pages?.next?.starting_after));
}
