import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from './asset-lifecycle';

test('asset lifecycle requires app role and Sheet access; viewers cannot change custody', async () => {
  const oldFetch = globalThis.fetch;
  let sheetAccess = true;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('identitytoolkit.googleapis.com')) return Response.json({ users: [{ email: 'viewer@gmail.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
    if (url.includes('sheets.googleapis.com')) return new Response('{}', { status: sheetAccess ? 200 : 403 });
    throw new Error('Unexpected URL');
  };
  const db = { prepare() { const statement = { bind() { return statement; }, async first<T>() { return { role: 'viewer' } as T; }, async all<T>() { return { results: [] as T[] }; }, async run() { return {}; } }; return statement; } };
  const request = (method: string) => new Request('https://app.test/api/asset-lifecycle?sheet=abcdefghijklmnopqrstuvwxyz&asset=Classes:2', { method, headers: { Origin: 'https://app.test', Authorization: 'Bearer google', 'X-Firebase-Token': 'firebase' }, body: method === 'POST' ? JSON.stringify({ assetKey: 'Classes:2', action: 'checkout', person: 'Staff' }) : undefined });
  try {
    assert.equal((await onRequestGet({ request: request('GET'), env: { ITEM_NOTIFICATION_DB: db } })).status, 200);
    assert.equal((await onRequestPost({ request: request('POST'), env: { ITEM_NOTIFICATION_DB: db } })).status, 403);
    sheetAccess = false;
    assert.equal((await onRequestGet({ request: request('GET'), env: { ITEM_NOTIFICATION_DB: db } })).status, 403);
  } finally { globalThis.fetch = oldFetch; }
});
