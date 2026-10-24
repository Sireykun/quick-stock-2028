import assert from 'node:assert/strict';
import test from 'node:test';
import { findDuplicateMatches, getDuplicateAssets, type LocatedAsset } from '../src/lib/duplicateAssets';

const asset = (row: number, sourceLocation: string, snid = '', hostname = ''): LocatedAsset => ({
  row, sourceLocation, snid, hostname, item: `Asset ${row}`, quantity: '1',
});

test('matches IDs across locations regardless of case or surrounding spaces', () => {
  const first = asset(2, 'Class: Room A', ' SN-123 ', 'PC-01');
  const second = asset(7, 'Stock: Storage', 'sn-123', 'pc-01 ');
  const matches = findDuplicateMatches(first, [first, second]);
  assert.deepEqual(matches.map(match => match.field), ['SNID', 'Hostname']);
  assert.deepEqual(matches.map(match => match.matches), [[second], [second]]);
});

test('does not treat an edited row, blank IDs, or distinct IDs as duplicates', () => {
  const current = asset(2, 'Class: Room A', 'SN-123');
  const sameRecord = asset(2, 'Class: Room A', 'sn-123');
  const other = asset(3, 'Class: Room A', 'SN-999');
  assert.deepEqual(findDuplicateMatches(current, [sameRecord, other]), []);
  assert.equal(getDuplicateAssets([asset(4, 'Stock: Storage'), other]).size, 0);
});

test('flags duplicate IDs within the same location when rows differ', () => {
  const first = asset(2, 'Class: Room A', 'SN-123');
  const second = asset(3, 'Class: Room A', 'sn-123');
  assert.equal(getDuplicateAssets([first, second]).size, 2);
});
