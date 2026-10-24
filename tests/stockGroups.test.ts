import assert from 'node:assert/strict';
import test from 'node:test';
import { groupStockItems, stockModelChoices } from '../src/lib/stockGroups';

test('one stock card opens all rows and model types for the same item name', () => {
  const groups = groupStockItems([
    { row: 2, item: 'Keyboards', tag: 'Accessory', type: 'Acer', quantity: '2' },
    { row: 3, item: 'TV', type: 'Samsung', quantity: '1' },
    { row: 4, item: ' keyboards ', tag: 'Accessory', type: 'Logitech', quantity: '3' },
    { row: 5, item: 'Keyboards', tag: 'Accessory', type: 'Acer', quantity: '1' },
    { row: 6, item: 'Keyboards', type: 'Hidden', quantity: '9', _isDeleted: true },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].rows.map(row => row.row), [2, 4, 5]);
  assert.equal(groups[0].modelCount, 2);
  assert.equal(groups[0].totalQuantity, 6);
  assert.equal(groups[1].name, 'TV');
  assert.deepEqual(stockModelChoices(groups[0], { Accessory: ['Bluetooth', 'Acer'] }), ['Bluetooth', 'Acer', 'Logitech']);
});
