import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestDelete, onRequestGet, onRequestPost } from './app-access';

test('only the verified owner can grant and revoke Gmail roles', async () => {
  const originalFetch = globalThis.fetch;
  let signedIn = 'sireykun8@gmail.com';
  const members = new Map<string, { role: string; status: string }>();
  globalThis.fetch = async () => Response.json({ users: [{ email: signedIn, emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
  const db = { prepare(sql: string) {
    let args: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) { args = values; return statement; },
      async first<T>() { const member = members.get(String(args[0])); return (member?.status === 'active' ? { role: member.role } : null) as T | null; },
      async all<T>() { return { results: [...members].map(([email, member]) => ({ email, ...member })) as T[] }; },
      async run() { if (sql.startsWith('INSERT')) members.set(String(args[0]), { role: String(args[1]), status: String(args[2]) }); else if (sql.includes("status = 'revoked'")) { const member = members.get(String(args[1])); if (member) member.status = 'revoked'; } return {}; },
    };
    return statement;
  } };
  const request = (method: string, body?: unknown, token = 'valid') => new Request('https://app.test/api/app-access', { method, headers: { Origin: 'https://app.test', 'X-Firebase-Token': token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    assert.equal((await onRequestGet({ request: request('GET'), env: { ITEM_NOTIFICATION_DB: db } })).status, 200);
    assert.equal((await onRequestPost({ request: request('POST', { email: 'person@gmail.com', role: 'viewer' }), env: { ITEM_NOTIFICATION_DB: db } })).status, 200);
    assert.equal(members.get('person@gmail.com')?.role, 'viewer');
    signedIn = 'person@gmail.com';
    const viewer = await onRequestGet({ request: request('GET'), env: { ITEM_NOTIFICATION_DB: db } });
    assert.equal((await viewer.json()).role, 'viewer');
    assert.equal((await onRequestPost({ request: request('POST', { email: 'other@gmail.com', role: 'editor' }), env: { ITEM_NOTIFICATION_DB: db } })).status, 403);
    signedIn = 'sireykun8@gmail.com';
    assert.equal((await onRequestPost({ request: request('POST', { email: 'person@gmail.com', role: 'editor' }), env: { ITEM_NOTIFICATION_DB: db } })).status, 200);
    assert.equal(members.get('person@gmail.com')?.role, 'editor');
    assert.equal((await onRequestDelete({ request: request('DELETE', { email: 'person@gmail.com' }), env: { ITEM_NOTIFICATION_DB: db } })).status, 200);
    assert.equal(members.get('person@gmail.com')?.status, 'revoked');
    assert.equal((await onRequestPost({ request: request('POST', { email: 'outsider@example.com', role: 'viewer' }), env: { ITEM_NOTIFICATION_DB: db } })).status, 400);
    assert.equal((await onRequestGet({ request: request('GET', undefined, ''), env: { ITEM_NOTIFICATION_DB: db } })).status, 401);
  } finally { globalThis.fetch = originalFetch; }
});
