import assert from 'node:assert/strict';
import test from 'node:test';
import { answerStockQuestion, parseStockRows, stockQuestionKeyboard } from '../server/stockBot';

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
  assert.match(answerStockQuestion('📊 Stock overview', entries), /2 rooms/);
  assert.match(answerStockQuestion('⚠️ Low stock', entries, 0), /Mouse — 0 in 106/);
  assert.match(answerStockQuestion('📍 106', entries), /Keyboard: 3/);
  assert.ok(stockQuestionKeyboard(entries).flat().includes('📍 106'));
});

test('the room 109 question button answers from class inventory', () => {
  const classEntries = parseStockRows([
    ['Class Name', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'],
    ['109', 'Keyboards', '1'],
    ['', 'Mouse', '1'],
    ['', 'AIO', '1'],
  ]);
  assert.ok(stockQuestionKeyboard(classEntries).flat().includes('What is in room 109?'));
  assert.match(answerStockQuestion('What is in room 109?', classEntries), /^109 \(3 units\):\n• Keyboards: 1\n• Mouse: 1\n• AIO: 1$/);
  assert.match(answerStockQuestion('Can you please tell me what items and quantities are in room 109?', classEntries), /Keyboards: 1/);
  assert.match(answerStockQuestion('How many keyboards do we have in room 109?', classEntries), /^1 unit matching/);
  assert.match(answerStockQuestion('Could you show me which rooms have keyboards?', classEntries), /Keyboards: 1 in 109/);
  assert.match(answerStockQuestion('How many units do we have in total across all rooms?', classEntries), /3 units/);
  assert.match(answerStockQuestion('Please tell me which items are low or out of stock in room 109', classEntries), /Low stock.*in 109/);
  assert.match(answerStockQuestion('What items are in room 999?', classEntries), /couldn't find room “999”/);
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
