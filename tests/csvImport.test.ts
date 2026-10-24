import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, validateImport } from '../src/lib/csvImport';

test('CSV preview parses quoted commas, validates quantities and detects repeated IDs', () => {
  const rows = parseCsv('Location,Item Name,Quantity,SNID\r\n106,"AIO, Core i3",1,SN01\r\n107,TV,2,SN01\r\n108,Mouse,-1,\r\n');
  const preview = validateImport(rows);
  assert.equal(preview[0].item, 'AIO, Core i3');
  assert.equal(preview[0].error, undefined);
  assert.match(preview[1].error || '', /duplicate/);
  assert.match(preview[2].error || '', /whole number/);
  assert.throws(() => parseCsv('"unclosed'), /unclosed quote/);
});
