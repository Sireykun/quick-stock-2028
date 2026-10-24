import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry, moveItemToClassOrStock, deleteClassItems, updateInventory, invalidateSpreadsheetMetadataCache } from '../src/lib/sheets';
import { changesBetween, type Snapshot } from '../server/itemNotifications';

test('live write failures are neither retried nor replaced with demo success', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'google-test-token' } });
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++; assert.equal(input, '/api/sheet-mutation');
    const payload = JSON.parse(String(init?.body)); assert.ok(payload.operationId);
    return Response.json({ error: { message: 'Change rejected' } }, { status: 500 });
  };
  try {
    await assert.rejects(fetchWithRetry('https://sheets.googleapis.com/v4/spreadsheets/live:batchUpdate', { method: 'POST', body: '{}' }), /Change rejected/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage }); }
});

test('editing an existing item sends one values batch without reformatting the sheet', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'google-test-token' } });
  const calls: string[] = [];
  let batch: any;
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    if (url === '/api/sheet-mutation') {
      batch = JSON.parse(JSON.parse(String(init?.body)).body);
      return Response.json({});
    }
    if (url.includes('?fields=')) return Response.json({ spreadsheetId: 'live', sheets: [{ properties: { sheetId: 1, title: 'Stock Room' } }] });
    return Response.json({ values: [['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'], ['Storage', 'Mouse', '1', 'Accessory', 'Dell']] });
  };
  try {
    invalidateSpreadsheetMetadataCache();
    await updateInventory('live', 'Stock Room', [{ row: 2, item: 'Mouse', quantity: '2', tag: 'Accessory', type: 'Dell' }]);
    assert.equal(calls.filter(url => url.includes('/values/')).length, 1);
    assert.match(decodeURIComponent(calls.find(url => url.includes('/values/'))!), /A1:I10$/);
    assert.equal(calls.filter(url => url === '/api/sheet-mutation').length, 1);
    assert.equal(batch.data[0].range, "'Stock Room'!B2:I2");
    assert.equal(batch.data[0].values[0][1], '2');
  } finally { globalThis.fetch = previousFetch; Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage }); invalidateSpreadsheetMetadataCache(); }
});

test('move commits both sides atomically and combined bulk save updates before deleting', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'google-test-token' } });
  const header = ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'];
  let rows = [header, ['Storage', 'Cable', '5', '', '', '', 'C-1', '', 'Checked'], ['Classroom 7', 'Mouse', '1']];
  const batches: any[][] = [];
  const metadata = { spreadsheetId: 'live', sheets: [{ properties: { sheetId: 1, title: 'Stock Room' } }] };
  globalThis.fetch = async (input, init) => {
    let url = String(input);
    if (url === '/api/sheet-mutation') {
      const request = JSON.parse(String(init?.body)); const data = JSON.parse(request.body);
      if (data.requests) {
        batches.push(data.requests);
        for (const operation of data.requests) {
          if (operation.insertDimension) { const r = operation.insertDimension.range; rows.splice(r.startIndex, 0, ...Array.from({ length: r.endIndex - r.startIndex }, () => [])); }
          if (operation.updateCells) {
            const u = operation.updateCells, start = u.start || { rowIndex: u.range.startRowIndex, columnIndex: u.range.startColumnIndex };
            u.rows.forEach((r: any, i: number) => r.values.forEach((c: any, j: number) => { rows[start.rowIndex + i][start.columnIndex + j] = c.userEnteredValue.stringValue; }));
          }
          if (operation.deleteDimension) { const r = operation.deleteDimension.range; rows.splice(r.startIndex, r.endIndex - r.startIndex); }
        }
      }
      return Response.json({});
    }
    if (!url.includes('/values/')) return Response.json(metadata);
    url = decodeURIComponent(url);
    return Response.json({ values: url.includes('!A2:') ? rows.slice(1) : url.includes('!A1:I1') ? [header] : structuredClone(rows) });
  };
  try {
    invalidateSpreadsheetMetadataCache();
    const before: Snapshot = { id: 1, name: 'Stock Room', rows: structuredClone(rows) };
    const item = { row: 2, item: 'Cable', quantity: '5', snid: 'C-1', status: 'Checked' };
    await moveItemToClassOrStock('live', 1, 'Stock Room', 'Storage', item, 'Stock Room', 'Classroom 7', '2');
    const transfers = batches.filter(b => b.some(r => r.insertDimension));
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0][0].updateCells.rows[0].values[1].userEnteredValue.stringValue, '3');
    assert.equal(rows[1][2], '3'); assert.equal(rows[3][2], '2');
    const changes = changesBetween([before], [{ ...before, rows }], transfers[0]);
    assert.equal(changes.length, 1); assert.equal(changes[0].action, 'moved');
    await assert.rejects(moveItemToClassOrStock('live', 1, 'Stock Room', 'Storage', item, 'Stock Room', 'Classroom 7', '1'), /changed/);
    assert.equal(batches.filter(b => b.some(r => r.insertDimension)).length, 1);
    batches.length = 0;
    await deleteClassItems('live', 1, 'Stock Room', [4], 'Classroom 7', [{ row: 3, item: 'Mouse', quantity: '7' }]);
    assert.equal(batches.length, 1);
    assert.ok(batches[0][0].updateCells); assert.ok(batches[0].at(-1).deleteDimension);
    assert.equal(rows[2][2], '7'); assert.equal(rows.length, 3);
  } finally { globalThis.fetch = previousFetch; Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage }); invalidateSpreadsheetMetadataCache(); }
});

test('stock-room move updates the source before inserting into an earlier destination', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'google-test-token' } });
  const header = ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'];
  let rows = [header, ['Front Store', 'Mouse', '1'], ['Back Store', 'Cable', '4']];
  const batches: any[][] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === '/api/sheet-mutation') {
      const body = JSON.parse(JSON.parse(String(init?.body)).body);
      if (!body.requests) return Response.json({});
      batches.push(body.requests);
      for (const operation of body.requests) {
        if (operation.updateCells) {
          const { start } = operation.updateCells;
          operation.updateCells.rows.forEach((row: any, i: number) => row.values.forEach((cell: any, j: number) => {
            rows[start.rowIndex + i][start.columnIndex + j] = cell.userEnteredValue.stringValue;
          }));
        }
        if (operation.insertDimension) {
          const { startIndex, endIndex } = operation.insertDimension.range;
          rows.splice(startIndex, 0, ...Array.from({ length: endIndex - startIndex }, () => []));
        }
      }
      return Response.json({});
    }
    if (!url.includes('/values/')) return Response.json({ sheets: [{ properties: { sheetId: 1, title: 'Stock Room' } }] });
    return Response.json({ values: structuredClone(rows) });
  };
  try {
    invalidateSpreadsheetMetadataCache();
    await moveItemToClassOrStock('live', 1, 'Stock Room', 'Back Store', { row: 3, item: 'Cable', quantity: '4' }, 'Stock Room', 'Front Store', '4');
    assert.equal(batches.filter(batch => batch.some(request => request.insertDimension)).length, 1);
    assert.deepEqual(rows.map(row => row[1]), ['Item Name', 'Mouse', 'Cable', '']);
    assert.equal(rows[2][2], '4');
    assert.equal(rows[3][0], 'Back Store');
  } finally {
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
    invalidateSpreadsheetMetadataCache();
  }
});
