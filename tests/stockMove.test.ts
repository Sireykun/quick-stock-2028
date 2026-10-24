import test from 'node:test';
import assert from 'node:assert/strict';
import { moveItemToClassOrStock, invalidateSpreadsheetMetadataCache } from '../src/lib/sheets';

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

test('move to a new class resolves the live CLASS tab when selected as Classes', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'google-test-token' } });
  const header = ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'];
  const metadata = { sheets: [{ properties: { sheetId: 1, title: 'Stock Room' } }, { properties: { sheetId: 2, title: 'CLASS' } }] };
  const mutations: any[][] = [];
  globalThis.fetch = async (input, init) => {
    const url = decodeURIComponent(String(input));
    if (url === '/api/sheet-mutation') {
      const body = JSON.parse(JSON.parse(String(init?.body)).body);
      if (body.requests) mutations.push(body.requests);
      return Response.json({});
    }
    if (!url.includes('/values/')) return Response.json(metadata);
    if (url.includes('Class_Template')) return Response.json({ values: [] });
    if (url.includes("'Stock Room'!")) return Response.json({ values: [header, ['Storage', 'Keyboard', '1']] });
    if (url.includes("'CLASS'!")) return Response.json({ values: [header] });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    invalidateSpreadsheetMetadataCache();
    await moveItemToClassOrStock('live', 1, 'Stock Room', 'Storage', { row: 2, item: 'Keyboard', quantity: '1' }, 'Classes', 'Lobby', '1');
    const move = mutations.find(requests => requests.some(request => request.insertDimension));
    assert.ok(move);
    assert.equal(move[1].insertDimension.range.sheetId, 2);
    assert.equal(move[2].updateCells.rows[0].values[0].userEnteredValue.stringValue, 'Lobby');
    assert.equal(move[2].updateCells.rows.at(-1).values[1].userEnteredValue.stringValue, 'Keyboard');
  } finally {
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
    invalidateSpreadsheetMetadataCache();
  }
});
