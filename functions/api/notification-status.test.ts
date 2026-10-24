import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './notification-status';

test('read-only diagnostics validate the requested spreadsheet without revealing secrets or identities', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith('/getChat')) assert.equal(JSON.parse(String(init?.body)).chat_id, '-123');
    return Response.json({ ok: true, result: { username: 'must-not-be-returned', id: 456 } });
  };
  try {
    const response = await onRequestGet({
      request: new Request('https://app.test/api/notification-status?spreadsheet=actual-app-sheet'),
      env: { TELEGRAM_BOT_TOKEN: 'private-token', TELEGRAM_ALLOWED_GROUP_IDS: '-123,-123', STOCK_SPREADSHEET_ID: 'actual-app-sheet',
        ITEM_NOTIFICATION_DB: { prepare: () => ({ bind() { return this; }, async run() { return { meta: { changes: 0 } }; }, async first<T>() { return { operations: 0 } as T; } }) } },
    });
    const text = await response.text();
    const status = JSON.parse(text);
    assert.equal(status.requestedSpreadsheetWatched, true);
    assert.equal(status.botReady, true);
    assert.equal(status.destinationReady, true);
    assert.equal(status.databaseReady, true);
    assert.equal(calls.length, 2);
    assert.doesNotMatch(text, /private-token|must-not-be-returned|actual-app-sheet|-123|456/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  } finally { globalThis.fetch = originalFetch; }
});

test('diagnostics report a Telegram outage safely without sending messages', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('https://api.telegram.org/botSECRET/getMe'); };
  try {
    const response = await onRequestGet({ env: { TELEGRAM_BOT_TOKEN: 'SECRET', TELEGRAM_ALLOWED_GROUP_IDS: '-123' } });
    const text = await response.text();
    assert.equal(JSON.parse(text).botReady, false);
    assert.doesNotMatch(text, /SECRET|api.telegram.org|-123/);
  } finally { globalThis.fetch = originalFetch; }
});
