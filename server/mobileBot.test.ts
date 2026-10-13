import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBotReply } from './botReply';
import { answerSheetQuestion, type SheetTab } from './sheetBot';
import { answerStockQuestion, type StockEntry } from './stockBot';

test('stock replies show short pages with a next command', () => {
  const rooms: StockEntry[] = Array.from({ length: 12 }, (_, index) => ({
    room: String(101 + index), item: 'Keyboard', quantity: 1, status: '',
  }));
  assert.match(answerStockQuestion('/rooms', rooms), /Rooms · 1\/2/);
  assert.match(answerStockQuestion('/rooms', rooms), /Next: \/rooms 2/);
  assert.match(answerStockQuestion('/rooms 2', rooms), /• 112/);
  assert.doesNotMatch(answerStockQuestion('/rooms 2', rooms), /• 101/);
  assert.match(answerStockQuestion('/low 2', rooms), /Low stock · 2\/2/);
  assert.match(answerStockQuestion('/item Keyboard --page 2', rooms), /Keyboard · 2\/2/);

  const items = Array.from({ length: 12 }, (_, index) => ({ ...rooms[0], item: `Item ${index + 1}` }));
  assert.match(answerStockQuestion('/room 101', items), /Next: \/room 101 --page 2/);
  assert.match(answerStockQuestion('/room 101 --page 2', items), /Item 12/);
});

test('Sheet replies paginate search and Type/Model values', () => {
  const tab: SheetTab = {
    name: 'Stock Room', readable: true,
    rows: [
      ['Item Name', 'Quantity', 'Category', 'Type/Model', 'Updated', 'Status', 'Hostname', 'SNID', 'Location'],
      ...Array.from({ length: 12 }, (_, index) => [`HDMI cable ${index + 1}`, '1', 'Cable', `Model ${index + 1}`, '', '', '', '', '109']),
    ],
  };
  assert.match(answerSheetQuestion('/find HDMI', [tab]) || '', /Next: \/find HDMI --page 2/);
  assert.match(answerSheetQuestion('/find HDMI --page 2', [tab]) || '', /HDMI cable 12/);
  assert.match(answerSheetQuestion('/types', [tab]) || '', /Next: \/types 2/);
  assert.match(answerSheetQuestion('/types 2', [tab]) || '', /Model 12/);
});

test('Telegram HTML formatting keeps Sheet values as text', () => {
  assert.equal(formatBotReply('Stock < 5 & more\nCable > HDMI'), '<b>Stock &lt; 5 &amp; more</b>\nCable &gt; HDMI');
});
