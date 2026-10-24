import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, type NotificationDB } from './sheet-mutation';

// Model the schema's primary key and partial unique index, across handler instances.
function database(): NotificationDB {
  const records = new Map<string, any>();
  return { prepare(sql) {
    let args: any[] = [];
    const statement = {
      bind(...values: any[]) { args = values; return statement; },
      async run() {
        if (sql.startsWith('INSERT')) {
          if (records.has(args[0]) || [...records.values()].some(r => r.state === 'pending' && r.spreadsheet === args[1])) return { meta: { changes: 0 } };
          records.set(args[0], { spreadsheet: args[1], fingerprint: args[2], state: 'pending' });
        } else Object.assign(records.get(args[2]), { state: 'done', response: args[0], status: args[1] });
        return { meta: { changes: 1 } };
      },
      async first<T>() { return (records.get(args[0]) || null) as T | null; },
    };
    return statement;
  } };
}

test('mutation boundary: success, failure, unchanged saves, bulk, duplicate/replayed requests and Telegram outage', async () => {
  const originalFetch = globalThis.fetch, originalWarn = console.warn;
  console.warn = () => {};
  const header = ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'];
  let rows = [header, ['Storage', 'Cable', '2']];
  let writes = 0, failure = false, telegramFailure = false, authFailure = false;
  let snapshotReads = 0, failSnapshotAt = 0;
  const sent: any[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) return Response.json({ users: [{ email: 'sireykun8@gmail.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
    if (url.startsWith('https://api.telegram.org')) {
      sent.push(JSON.parse(String(init?.body)));
      if (telegramFailure) throw new Error('credential must not leak');
      return Response.json({ ok: true });
    }
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer google-token');
    // Cloudflare Workers rejects redirect:'error' before making the request.
    // All OAuth-bearing Google requests must use manual and reject 3xx explicitly.
    assert.equal(init?.redirect, 'manual');
    if (authFailure) return new Response('', { status: 403 });
    if (url.includes('?fields=')) return Response.json({ sheets: [{ properties: { sheetId: 1, title: 'Stock Room' } }] });
    if (url.includes('values:batchGet')) {
      if (++snapshotReads === failSnapshotAt) return new Response('', { status: 503 });
      return Response.json({ valueRanges: [{ values: structuredClone(rows) }] });
    }
    writes++;
    if (failure) return Response.json({}, { status: 400 });
    rows = JSON.parse(String(init?.body)).values;
    return Response.json({ updatedRows: rows.length });
  };
  const env = { STOCK_SPREADSHEET_ID: 'stock', TELEGRAM_BOT_TOKEN: 'backend-only-token', TELEGRAM_ALLOWED_GROUP_IDS: '-1', ITEM_NOTIFICATION_DB: database() };
  const send = async (values: string[][], id = crypto.randomUUID(), authorization = 'Bearer google-token') => {
    const tasks: Promise<unknown>[] = [];
    const response = await onRequestPost({ env, waitUntil: p => tasks.push(p), request: new Request('https://app.test/api/sheet-mutation', {
      method: 'POST', headers: { Authorization: authorization, Origin: 'https://app.test', 'X-Firebase-Token': 'verified-test-token' },
      body: JSON.stringify({ url: 'https://sheets.googleapis.com/v4/spreadsheets/stock/values/Stock%20Room!A1:I?valueInputOption=RAW', method: 'PUT', body: JSON.stringify({ values }), operationId: id }),
    }) });
    await Promise.all(tasks);
    return response;
  };
  try {
    assert.equal((await send(rows)).status, 200); assert.equal(sent.length, 0);
    failure = true;
    assert.equal((await send([header])).status, 400); assert.equal(sent.length, 0); assert.equal(rows.length, 2);
    failure = false;
    const bulk = [header, ['Storage', 'Cable', '3'], ['Storage', 'Mouse', '5']];
    const id = crypto.randomUUID();
    assert.equal((await send(bulk, id)).status, 200); assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Bulk inventory changes: 2/);
    const priorWrites = writes;
    assert.equal((await send(bulk, id)).status, 200); assert.equal(writes, priorWrites); assert.equal(sent.length, 1);
    assert.equal((await send([header], id)).status, 409); assert.equal(writes, priorWrites);
    assert.equal((await send(bulk)).status, 200); assert.equal(sent.length, 1);
    telegramFailure = true;
    assert.equal((await send([header])).status, 200); assert.equal(rows.length, 1);
    assert.equal(sent.length, 2);
    assert.doesNotMatch(sent[1].text, /google-token|backend-only-token|user|email|actor/i);
    failSnapshotAt = snapshotReads + 2;
    assert.equal((await send(bulk)).status, 200); assert.equal(rows.length, 3); assert.equal(sent.length, 2);
    failSnapshotAt = snapshotReads + 1;
    const writesBeforeSnapshotFailure = writes;
    assert.equal((await send([header])).status, 502); assert.equal(writes, writesBeforeSnapshotFailure); assert.equal(sent.length, 2);
    authFailure = true;
    assert.equal((await send(bulk)).status, 403);
    assert.equal((await send(bulk, crypto.randomUUID(), '')).status, 401);
    assert.equal(sent.length, 2);
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});

test('rejects cross-origin and non-Sheets mutation targets before forwarding credentials', async () => {
  const env = {};
  for (const [origin, url, status] of [
    ['https://attacker.test', 'https://sheets.googleapis.com/v4/spreadsheets/stock:batchUpdate', 403],
    ['https://app.test', 'https://attacker.test/v4/spreadsheets/stock:batchUpdate', 400],
    ['https://app.test', 'https://sheets.googleapis.com.evil.test/v4/spreadsheets/stock:batchUpdate', 400],
  ] as const) {
    const response = await onRequestPost({ env, waitUntil() {}, request: new Request('https://app.test/api/sheet-mutation', {
      method: 'POST', headers: { Authorization: 'Bearer private', Origin: origin },
      body: JSON.stringify({ url, method: 'POST', body: '{}', operationId: crypto.randomUUID() }),
    }) });
    assert.equal(response.status, status);
  }
});

test('an unexpected Google redirect is not followed and cannot cause a write or alert', async () => {
  const originalFetch = globalThis.fetch, originalWarn = console.warn;
  let calls = 0, backgroundTasks = 0;
  console.warn = () => {};
  globalThis.fetch = async (_url, init) => {
    calls++;
    if (String(_url).startsWith('https://identitytoolkit.googleapis.com/')) return Response.json({ users: [{ email: 'sireykun8@gmail.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
    assert.equal(init?.redirect, 'manual');
    return new Response('', { status: 302, headers: { Location: 'https://untrusted.test' } });
  };
  try {
    const response = await onRequestPost({ env: { ITEM_NOTIFICATION_DB: database() }, waitUntil() { backgroundTasks++; }, request: new Request('https://app.test/api/sheet-mutation', {
      method: 'POST', headers: { Authorization: 'Bearer private', Origin: 'https://app.test', 'X-Firebase-Token': 'verified-test-token' },
      body: JSON.stringify({ url: 'https://sheets.googleapis.com/v4/spreadsheets/stock:batchUpdate', method: 'POST', body: '{}', operationId: crypto.randomUUID() }),
    }) });
    assert.equal(response.status, 502);
    assert.equal(calls, 2);
    assert.equal(backgroundTasks, 0);
    assert.doesNotMatch(await response.text(), /private|untrusted/);
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});

test('viewer cannot send a Sheet mutation through the app', async () => {
  const originalFetch = globalThis.fetch;
  let sheetCalls = 0;
  globalThis.fetch = async input => {
    if (String(input).startsWith('https://identitytoolkit.googleapis.com/')) return Response.json({ users: [{ email: 'viewer@gmail.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
    sheetCalls++;
    return Response.json({});
  };
  const db: NotificationDB = { prepare: () => { const statement = { bind() { return statement; }, async first<T>() { return { role: 'viewer' } as T; }, async run() { return { meta: { changes: 0 } }; } }; return statement; } };
  try {
    const response = await onRequestPost({ env: { ITEM_NOTIFICATION_DB: db }, waitUntil() {}, request: new Request('https://app.test/api/sheet-mutation', {
      method: 'POST',
      headers: { Authorization: 'Bearer google-token', Origin: 'https://app.test', 'X-Firebase-Token': 'verified-test-token' },
      body: JSON.stringify({ url: 'https://sheets.googleapis.com/v4/spreadsheets/stock:batchUpdate', method: 'POST', body: '{}', operationId: crypto.randomUUID() }),
    }) });
    assert.equal(response.status, 403);
    assert.equal(sheetCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
