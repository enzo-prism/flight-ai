import test from 'node:test';
import assert from 'node:assert/strict';
import { CONNECTORS, connectorReady, authorizationUrl, exchangeCode, refreshAccess, fetchConversations } from '../server/connectors.mjs';
const env = Object.fromEntries(CONNECTORS.flatMap(c => [[`CONNECTOR_${c.id.toUpperCase()}_CLIENT_ID`, 'client'], [`CONNECTOR_${c.id.toUpperCase()}_CLIENT_SECRET`, 'secret']]));
const mock = entries => { const calls = []; const fn = async (url, opts) => { calls.push({ url: String(url), opts }); const entry = entries.shift(); assert.ok(entry, `Unexpected request ${url}`); if (entry.match) assert.match(String(url), entry.match); return new Response(JSON.stringify(entry.body ?? entry), { status: entry.status || 200 }); }; fn.calls = calls; return fn; };
const msg = { id: 'm1', createdAt: '2026-09-19T10:00:00Z', type: 'MESSAGE', direction: 'INCOMING', senders: [{ name: 'Customer' }], text: 'Can you restore access?', truncationStatus: 'NOT_TRUNCATED' };
test('catalog readiness and OAuth scopes remain read-only and PKCE-bound where supported', () => {
  assert.equal(connectorReady('unknown', env), false); assert.equal(connectorReady('gmail', {}), false);
  for (const p of CONNECTORS) {
    const u = new URL(authorizationUrl(p.id, { state: 'state', codeChallenge: 'challenge', redirectUri: 'https://example.com/callback', config: { subdomain: 'acme' } }, env));
    assert.equal(u.searchParams.get('state'), 'state'); assert.equal(u.searchParams.get('client_secret'), null);
    assert.doesNotMatch(u.searchParams.get('scope') || '', /write|send|modify/i);
    if (['gmail', 'microsoft', 'zendesk'].includes(p.id)) assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  }
  assert.throws(() => authorizationUrl('zendesk', { config: { subdomain: 'evil.com/a' } }, env), /subdomain/);
});
test('OAuth verifies source identity before returning tokens and omits secrets from failures', async () => {
  const f = mock([{ access_token: 'token', refresh_token: 'refresh', expires_in: 3600 }, { emailAddress: 'person@example.com' }]);
  const data = await exchangeCode('gmail', { code: 'code', codeVerifier: 'verifier', redirectUri: 'https://example.com/callback' }, env, f);
  assert.equal(data.accountLabel, 'person@example.com'); assert.equal(data.refreshToken, 'refresh');
  assert.match(f.calls[0].opts.body, /code_verifier=verifier/); assert.equal(f.calls[0].opts.redirect, 'error');
  assert.equal(f.calls[0].opts.signal instanceof AbortSignal, true);
  await assert.rejects(exchangeCode('gmail', { code: 'code' }, env, mock([{ status: 400, body: { error: 'secret-code-token' } }])), e => !e.message.includes('secret'));
  await assert.rejects(refreshAccess('intercom', { refreshToken: 'x' }, env, mock([])), /Reconnect/);
});
test('Gmail retrieves complete threads, preserves evidence and provides continuation', async () => {
  const f = mock([{ emailAddress: 'agent@example.com' }, { threads: [{ id: 't1' }], nextPageToken: 'next' }, { messages: [{ id: 'm1', internalDate: '1758276000000', payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'Customer <c@example.com>' }, { name: 'Subject', value: 'Access' }], body: { data: Buffer.from('Can you restore access?').toString('base64url') } } }] }]);
  const data = await fetchConversations('gmail', { accessToken: 't', limit: 1 }, f);
  assert.equal(data.conversations[0].messages[0].role, 'customer'); assert.equal(data.conversations[0].messages[0].text, 'Can you restore access?'); assert.equal(data.nextCursor, 'next'); assert.equal(data.hasMore, true);
});
test('Microsoft groups messages, excludes drafts, verifies mailbox, rejects malicious continuation URLs', async () => {
  const f = mock([{ mail: 'agent@example.com' }, { value: [{ conversationId: 'c1' }, { conversationId: 'c1' }] }, { value: [{ id: 'm1', subject: 'Access', from: { emailAddress: { address: 'agent@example.com' } }, sentDateTime: '2026-09-19T10:00:00Z', body: { contentType: 'text', content: 'Please try again.' } }, { id: 'draft', isDraft: true }] }]);
  const data = await fetchConversations('microsoft', { accessToken: 't' }, f);
  assert.equal(data.conversations.length, 1); assert.equal(data.conversations[0].messages.length, 1); assert.equal(data.conversations[0].messages[0].role, 'teammate');
  for (const cursor of ['https://evil.example/v1.0/me/messages', 'https://graph.microsoft.com@evil.example/v1.0/me/messages', 'https://graph.microsoft.com/v1.0/users', 'http://graph.microsoft.com/v1.0/me/messages']) {
    const bad = mock([{ mail: 'agent@example.com' }]); await assert.rejects(fetchConversations('microsoft', { accessToken: 't', cursor }, bad), /unsafe/); assert.equal(bad.calls.length, 1);
  }
});
test('HubSpot paginates messages, uses documented direction, never follows provider links', async () => {
  const f = mock([{ results: [{ id: 'thread' }], paging: { next: { after: 'more', link: 'https://evil.example' } } }, { results: [msg], paging: { next: { after: 'messages2' } } }, { results: [{ ...msg, id: 'm2', direction: 'OUTGOING', text: 'I will check.' }] }]);
  const data = await fetchConversations('hubspot', { accessToken: 't' }, f);
  assert.equal(data.nextCursor, 'more'); assert.equal(data.conversations[0].messages[1].role, 'teammate'); assert.match(f.calls[2].url, /after=messages2/);
  await assert.rejects(fetchConversations('hubspot', { accessToken: 't' }, mock([{ results: [{ id: 't' }] }, { results: [{ ...msg, truncationStatus: 'TRUNCATED' }] }])), /incomplete/);
});
test('Zendesk returns public messages only, resolves roles and validates tenant pagination', async () => {
  const f = mock([{ tickets: [{ id: 7, subject: 'Access', requester_id: 2 }], links: { next: 'https://acme.zendesk.com/api/v2/tickets.json?page%5Bafter%5D=2' } }, { comments: [{ id: 1, author_id: 2, public: true, body: 'Access is broken', created_at: '2026-09-19T10:00:00Z' }, { id: 2, author_id: 3, public: false, body: 'Private note' }], users: [{ id: 2, name: 'Customer', role: 'end-user' }] }]);
  const data = await fetchConversations('zendesk', { accessToken: 't', config: { subdomain: 'acme' } }, f);
  assert.equal(data.conversations[0].messages.length, 1); assert.equal(data.conversations[0].messages[0].sender, 'Customer'); assert.equal(data.hasMore, true);
  await assert.rejects(fetchConversations('zendesk', { accessToken: 't', config: { subdomain: 'acme' }, cursor: 'https://other.zendesk.com/api/v2/tickets.json' }, mock([])), /unsafe/);
});
test('Intercom uses source and public comments, preserves customer evidence and reports cursor', async () => {
  const f = mock([{ conversations: [{ id: '1' }], pages: { next: { starting_after: '2' } } }, { id: '1', created_at: 1758276000, source: { id: 's1', author: { name: 'Customer', type: 'user' }, body: 'Help please' }, conversation_parts: { total_count: 2, conversation_parts: [{ id: 'p1', part_type: 'comment', author: { name: 'Agent', type: 'admin' }, created_at: 1758276001, body: 'Checking now' }, { id: 'p2', part_type: 'note', body: 'Internal only' }] } }]);
  const data = await fetchConversations('intercom', { accessToken: 't' }, f);
  assert.equal(data.conversations[0].messages.length, 2); assert.equal(data.conversations[0].messages[0].role, 'customer'); assert.equal(data.nextCursor, '2'); assert.equal(f.calls[0].opts.headers['Intercom-Version'], '2.11');
});
test('Unsupported providers, invalid limits, rate limits, and oversize histories fail honestly', async () => {
  await assert.rejects(fetchConversations('other', { accessToken: 't' }, mock([])), /Unsupported/);
  await assert.rejects(fetchConversations('gmail', { accessToken: 't', limit: 100 }, mock([])), /Batch size/);
  await assert.rejects(fetchConversations('intercom', { accessToken: 't' }, mock([{ status: 429, body: { detail: 'secret customer data' } }])), e => e.code === 'rate_limited' && !e.message.includes('secret'));
  await assert.rejects(fetchConversations('intercom', { accessToken: 't' }, mock([{ conversations: [{ id: '1' }] }, { conversation_parts: { total_count: 700, conversation_parts: [] } }])), /omitted/);
});
test('Malformed lists and missing continuation cursors cannot become successful empty scans', async () => {
  await assert.rejects(fetchConversations('hubspot', { accessToken: 't' }, mock([{ error: 'not a list' }])), /invalid/);
  await assert.rejects(fetchConversations('intercom', { accessToken: 't' }, mock([{ conversations: [], pages: { next: { page: 2 } } }])), /omitted/);
});
test('Refresh preserves provider rotation and never includes credentials in URLs', async () => {
  const f = mock([{ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 }]);
  const token = await refreshAccess('microsoft', { refreshToken: 'old' }, env, f);
  assert.equal(token.refreshToken, 'rotated'); assert.doesNotMatch(f.calls[0].url, /secret|old/); assert.match(f.calls[0].opts.body, /grant_type=refresh_token/);
});
test('OAuth persists source account IDs, not merely potentially duplicate display labels', async () => {
  const a = await exchangeCode('intercom', { code: 'code', redirectUri: 'https://example.com/callback' }, env, mock([{ access_token: 't' }, { app: { id_code: 'workspace-a', name: 'Same name', region: 'US' } }]));
  const b = await exchangeCode('intercom', { code: 'code', redirectUri: 'https://example.com/callback' }, env, mock([{ access_token: 't' }, { app: { id_code: 'workspace-b', name: 'Same name', region: 'US' } }]));
  assert.equal(a.accountLabel, b.accountLabel); assert.notEqual(a.accountId, b.accountId);
  await assert.rejects(exchangeCode('intercom', { code: 'code', redirectUri: 'https://example.com/callback' }, env, mock([{ access_token: 't' }, { app: { name: 'No stable identity' } }])), /identity/);
});
