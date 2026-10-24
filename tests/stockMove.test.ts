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
    if (url.endsWith('/live:batchUpdate')) {
      const body = JSON.parse(String(init?.body));
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
