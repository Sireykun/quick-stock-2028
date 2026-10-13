import assert from 'node:assert/strict';
import test from 'node:test';
import { answerSheetQuestion, type SheetTab } from '../server/sheetBot';

const tabs: SheetTab[] = [
  { name: 'CLASS', readable: true, rows: [
    ['Class Name', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'],
    ['109', 'Keyboards', '1', 'Accessory', 'acer', 'HOST-109', 'SERIAL-109', '13/10/2026', 'Checked'],
    ['', 'Mouse', '1', 'Accessory', 'jeoel'],
  ] },
  { name: 'stock room', readable: true, rows: [
    ['Class Name', 'Item Name', 'Quantity'],
    ['Stock Room Office', 'HDMI', '4'],
  ] },
  { name: 'Item Master', readable: true, rows: [['Item Name'], ['AIO'], ['Keyboards'], ['HDMI']] },
  { name: 'Class_Template', readable: true, rows: [['Item Name', 'Default Tag', 'Default Type'], ['Keyboards', 'Accessory', 'acer']] },
  { name: 'Lab_Template', readable: true, rows: [['Item Name', 'Default Tag', 'Default Type'], ['AIO', 'Computer', 'Acer Core5']] },
  { name: 'Dropdowns', readable: true, rows: [['Category', 'Value', 'Parent Tag'], ['Type', 'Acer Core5', 'Computer']] },
  { name: 'Dashboard', readable: false, rows: [] },
];

test('lists and browses all readable sheet tabs', () => {
  assert.match(answerSheetQuestion('/tabs', tabs)!, /Item Master — 3 data rows/);
  assert.match(answerSheetQuestion('/tabs', tabs)!, /Dashboard — dashboard/);
  assert.match(answerSheetQuestion('📄 All sheet tabs', tabs)!, /Lab_Template/);
  assert.match(answerSheetQuestion('What is in Item Master?', tabs)!, /Item Name: Keyboards/);
  assert.match(answerSheetQuestion('🧾 Item names', tabs)!, /Item Name: HDMI/);
  assert.match(answerSheetQuestion('Show the Lab_Template', tabs)!, /Default Type: Acer Core5/);
  assert.match(answerSheetQuestion('What dropdown values are available?', tabs)!, /Acer Core5/);
  assert.match(answerSheetQuestion('/types', tabs)!, /Acer Core5/);
  assert.match(answerSheetQuestion('🔽 Browse types', tabs)!, /acer/);
  assert.match(answerSheetQuestion('/type Acer Core5', tabs)!, /Lab_Template.*AIO.*Acer Core5/);
  assert.match(answerSheetQuestion('Find type Acer Core5', tabs)!, /Dropdowns.*Computer.*Acer Core5/);
  assert.match(answerSheetQuestion('/type acer in room 109', tabs)!, /CLASS · 109 · Keyboards.*acer/);
  assert.match(answerSheetQuestion('/tab Dashboard', tabs)!, /no readable cells/);
});

test('finds records across tabs and answers inventory fields', () => {
  assert.match(answerSheetQuestion('/find HDMI', tabs)!, /stock room, row 2/);
  assert.match(answerSheetQuestion('/find HDMI', tabs)!, /Item Master, row 4/);
  assert.match(answerSheetQuestion('Search the Sheet for HDMI', tabs)!, /Item Master, row 4/);
  assert.match(answerSheetQuestion('Find HDMI across all tabs', tabs)!, /stock room, row 2/);
  assert.match(answerSheetQuestion('What is the hostname of the keyboard in room 109?', tabs)!, /HOST-109/);
  assert.match(answerSheetQuestion('What is the serial number of the keyboard in room 109?', tabs)!, /SERIAL-109/);
  assert.match(answerSheetQuestion('Show me class template defaults', tabs)!, /Keyboards/);
  assert.equal(answerSheetQuestion('How many keyboards are in room 109?', tabs), null);
});
