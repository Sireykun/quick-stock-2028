import assert from 'node:assert/strict';
import test from 'node:test';
import { answerStockQuestion, parseStockRows } from '../server/stockBot';

test('answers room and item questions from the stock sheet format', () => {
  const entries = parseStockRows([
    ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'],
    ['106', 'Keyboard', '3'],
    ['', 'Mouse', '0'],
    ['107', 'Keyboard', '2'],
  ]);
  assert.equal(entries.length, 3);
  assert.match(answerStockQuestion('/room 106', entries), /Keyboard: 3/);
  assert.match(answerStockQuestion('How many keyboards?', entries), /5 units/);
  assert.match(answerStockQuestion('/low', entries, 0), /Mouse — 0 in 106/);
});

test('reads the older flat stock sheet format', () => {
  const entries = parseStockRows([
    ['Item Name', 'Quantity', 'Category', 'Type', 'Updated', 'Status', 'Hostname', 'SNID', 'Location'],
    ['HDMI Cable', '4', '', '', '', '', '', '', 'Stock Room Office'],
  ]);
  assert.deepEqual(entries, [{ room: 'Stock Room Office', item: 'HDMI Cable', quantity: 4, status: '' }]);
  assert.match(answerStockQuestion('/summary', entries), /1 room · 1 item row · 4 units/);
  assert.match(answerStockQuestion('/summary', entries), /\/room Stock Room Office/);
});
