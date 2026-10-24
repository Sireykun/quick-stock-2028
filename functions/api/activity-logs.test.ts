import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './sheet-mutation';
import { onRequestGet } from './activity-logs';
import { describeSheetMutation } from '../../server/activityLogs';

test('completed edits are logged with the Google verified name and email', async () => {
  const originalFetch = globalThis.fetch;
  const rows: any[] = [];
  const db = { prepare(sql: string) {
    let args: any[] = [];
    const statement = {
      bind(...values: any[]) { args = values; return statement; },
      async run() {
        if (sql.includes('INSERT OR IGNORE INTO activity_logs') && !rows.some(row => row.id === args[0])) rows.push({ id: args[0], spreadsheet: args[1], actor_sub: args[2], actor_name: args[3], actor_email: args[4], action: args[5], target: args[6], created_at: args[7] });
        return { meta: { changes: 1 } };
      },
      async all<T>() { return { results: rows as T[] }; },
      async first<T>() { return null as T | null; },
    };
    return statement;
  } };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) return Response.json({ users: [{ email: 'sireykun8@gmail.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer google-token');
    assert.equal(init?.redirect, 'manual');
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return Response.json({ sub: 'google-123', name: 'Sireykun Hout', email: 'sireykun@gmail.com', email_verified: true });
    if (url.includes('?fields=')) return Response.json({ spreadsheetId: 'sheetid123456', sheets: [] });
    return Response.json({ updatedRows: 1 });
  };
  try {
    const tasks: Promise<unknown>[] = [];
    const id = crypto.randomUUID();
    const response = await onRequestPost({ env: { ITEM_NOTIFICATION_DB: db }, waitUntil: task => tasks.push(task), request: new Request('https://app.test/api/sheet-mutation', {
      method: 'POST', headers: { Authorization: 'Bearer google-token', Origin: 'https://app.test', 'X-Firebase-Token': 'verified-test-token' },
      body: JSON.stringify({ url: 'https://sheets.googleapis.com/v4/spreadsheets/sheetid123456/values/Classes!A2:I2?valueInputOption=RAW', method: 'PUT', body: JSON.stringify({ values: [['Office', 'Mouse', '1']] }), operationId: id }),
    }) });
    await Promise.all(tasks);
    assert.equal(response.status, 200);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].actor_name, 'Sireykun Hout');
    assert.equal(rows[0].actor_email, 'sireykun@gmail.com');
    assert.equal(rows[0].target, 'Classes');
    assert.equal((await onRequestGet({ env: { ITEM_NOTIFICATION_DB: db }, request: new Request('https://app.test/api/activity-logs?spreadsheet=sheetid123456', { headers: { Authorization: 'Bearer google-token', Origin: 'https://app.test' } }) })).status, 200);
    assert.equal((await onRequestGet({ env: { ITEM_NOTIFICATION_DB: db }, request: new Request('https://app.test/api/activity-logs?spreadsheet=sheetid123456') })).status, 401);
  } finally { globalThis.fetch = originalFetch; }
});

test('mutation descriptions identify the edited sheet without storing the body', () => {
  assert.deepEqual(describeSheetMutation(new URL('https://sheets.googleapis.com/v4/spreadsheets/abc/values/%27Stock%20Room%27!A1:I:append')), { action: 'Added inventory rows', target: 'Stock Room' });
});
