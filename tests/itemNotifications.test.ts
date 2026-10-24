import test from 'node:test';
import assert from 'node:assert/strict';
import { changesBetween, notificationMessages, sendItemNotifications, type Snapshot } from '../server/itemNotifications';

const header = ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'];
const row = (name = 'HDMI Cable', quantity = '2', location = 'IT Storage') => [location, name, quantity, 'Cable', '', '', 'HDMI-1', '', 'Checked'];
const sheet = (rows: string[][]): Snapshot => ({ id: 1, name: 'Stock Room', rows: [header, ...rows] });

test('unchanged saves and timestamp-only formatting changes are silent', () => {
  const before = sheet([row()]);
  const after = structuredClone(before); after.rows[1][7] = 'new timestamp';
  assert.deepEqual(changesBetween([before], [after]), []);
  assert.deepEqual(notificationMessages([]), []);
});

test('edits include only changed fields, quantity/code and Cambodia date across midnight', () => {
  const next = row(); next[2] = '3'; next[8] = 'Missing';
  const changes = changesBetween([sheet([row()])], [sheet([next])]);
  const text = notificationMessages(changes, new Date('2026-10-14T18:30:00Z'))[0];
  assert.match(text, /Quantity: 2 → 3/);
  assert.match(text, /Status: Checked → Missing/);
  assert.match(text, /15 Oct 2026, 01:30:00/);
  assert.match(text, /Code: HDMI-1/);
  assert.doesNotMatch(text, /Category:|Type\/model:|Hostname:|Location:|Last Updated|user|email|actor/i);
});

test('item edit names the sheet and room before the quantity change', () => {
  const classes: Snapshot = {
    id: 2, name: 'Classes',
    rows: [header, ['1111', 'Speaker', '0', 'Speaker', '', '', '', '', '']],
  };
  const updated = structuredClone(classes);
  updated.rows[1][2] = '1';
  const changes = changesBetween([classes], [updated]);
  assert.equal(notificationMessages(changes, new Date('2026-10-16T16:08:58Z'))[0],
    '📦 Item edited\nItem: Speaker\nFrom: Classes = 1111\nQuantity: 1\nQuantity: 0 → 1\nTime: 16 Oct 2026, 23:08:58 (Asia/Phnom_Penh)');
});

test('bulk delete and insert track row shifts without alerting unchanged neighbours', () => {
  const before = sheet([row('A'), row('B'), row('C')]);
  const after = sheet([row('C'), row('D')]);
  const changes = changesBetween([before], [after], [
    { deleteDimension: { range: { sheetId: 1, dimension: 'ROWS', startIndex: 1, endIndex: 3 } } },
    { insertDimension: { range: { sheetId: 1, dimension: 'ROWS', startIndex: 2, endIndex: 3 } } },
  ]);
  assert.deepEqual(changes.map(c => [c.action, (c.after || c.before)?.item]), [['deleted', 'A'], ['deleted', 'B'], ['added', 'D']]);
  assert.equal(notificationMessages(changes).length, 1);
  assert.match(notificationMessages(changes)[0], /Bulk inventory changes: 3/);
});

test('full and partial transfers produce one movement with moved quantity', () => {
  for (const remaining of ['', '3']) {
    const before = sheet([row('HDMI Cable', remaining ? '5' : '2')]);
    const after = sheet([remaining ? row('HDMI Cable', remaining) : ['IT Storage'], row('HDMI Cable', '2', 'Classroom 7')]);
    const changes = changesBetween([before], [after]);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].action, 'moved');
    const text = notificationMessages(changes)[0];
    assert.match(text, /Quantity: 2\nFrom: IT Storage\nTo: Classroom 7/);
    assert.doesNotMatch(text, /5 → 2/);
  }
});

test('legacy sheet migration is silent and direct location edits are movements', () => {
  const legacy: Snapshot = { id: 1, name: 'Stock Room', rows: [['Item Name'], ['HDMI Cable', '2', 'Cable', '', '', 'Checked', '', 'HDMI-1', 'IT Storage']] };
  assert.deepEqual(changesBetween([legacy], [sheet([row()])]), []);
  assert.equal(changesBetween([sheet([row()])], [sheet([row('HDMI Cable', '2', 'Classroom 7')])])[0].action, 'moved');
});

test('large summaries are split below Telegram message limits without dropping items', () => {
  const changes = changesBetween([sheet([])], [sheet(Array.from({ length: 100 }, (_, i) => row(`Item ${i} ${'x'.repeat(200)}`)))]);
  const messages = notificationMessages(changes);
  assert.ok(messages.length > 1);
  assert.ok(messages.every(m => m.length <= 4096));
  assert.equal(messages.join('\n').match(/📦 Item added/g)?.length, 100);
});

test('Telegram failures are swallowed, destinations deduplicated and errors never logged', async () => {
  const originalFetch = globalThis.fetch, originalWarn = console.warn;
  const logs: unknown[][] = []; let sends = 0;
  console.warn = (...args) => logs.push(args);
  globalThis.fetch = async (_, init) => { sends++; assert.ok(init?.signal); throw new Error('SECRET TOKEN in URL'); };
  try {
    await sendItemNotifications({ TELEGRAM_BOT_TOKEN: 'SECRET', TELEGRAM_ALLOWED_GROUP_IDS: '-1,-1' }, ['one', 'two']);
    assert.equal(sends, 1);
    assert.equal(JSON.stringify(logs).includes('SECRET'), false);
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});

test('an unresponsive Telegram request is aborted within the per-send deadline', async () => {
  const originalFetch = globalThis.fetch, originalWarn = console.warn;
  let calls = 0;
  console.warn = () => {};
  globalThis.fetch = async (_, init) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
    });
  };
  // Keep the event loop alive; AbortSignal.timeout uses an unreferenced timer in Node.
  const keepAlive = setInterval(() => {}, 1000);
  const start = Date.now();
  try {
    await sendItemNotifications({ TELEGRAM_BOT_TOKEN: 'secret', TELEGRAM_NOTIFICATION_CHAT_IDS: '-1' }, ['one', 'two']);
    assert.equal(calls, 1);
    assert.ok(Date.now() - start < 7000);
  } finally { clearInterval(keepAlive); globalThis.fetch = originalFetch; console.warn = originalWarn; }
});
