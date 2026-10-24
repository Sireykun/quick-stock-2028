import test from 'node:test';
import assert from 'node:assert/strict';
import { isOfficeDepartment, isOfficeOrCustomRoom, roomLabel } from '../src/lib/rooms';

test('Office departments remain distinct from classes and display their own names', () => {
  assert.equal(isOfficeDepartment('Office: Finance'), true);
  assert.equal(isOfficeOrCustomRoom('Office: Finance'), true);
  assert.equal(isOfficeOrCustomRoom('Office'), true);
  assert.equal(isOfficeOrCustomRoom('Room: Meeting room'), true);
  assert.equal(isOfficeOrCustomRoom('Class 106'), false);
  assert.equal(roomLabel('Office: Finance'), 'Finance');
  assert.equal(roomLabel('Room: Meeting room'), 'Meeting room');
});
