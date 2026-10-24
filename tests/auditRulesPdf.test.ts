import assert from 'node:assert/strict';
import test from 'node:test';
import { auditFieldFlags, DEFAULT_AUDIT_RULES, matchingAuditRule } from '../src/lib/auditRules';
import { buildAuditPdf, type AuditPdfRow } from '../src/lib/auditPdf';

test('audit rules target AIO and selected TV models without flagging accessories', () => {
  assert.deepEqual(auditFieldFlags({ item: 'AIO', type: 'Acer Core3', snid: '', hostname: '' }, DEFAULT_AUDIT_RULES), { isMissingSNID: true, isMissingHostname: true, checkDuplicate: true });
  assert.deepEqual(auditFieldFlags({ item: 'TV', type: 'Samsung', snid: '', hostname: '' }, DEFAULT_AUDIT_RULES), { isMissingSNID: true, isMissingHostname: false, checkDuplicate: false });
  assert.deepEqual(auditFieldFlags({ item: 'Keyboards', type: 'Acer', snid: '', hostname: '' }, DEFAULT_AUDIT_RULES), { isMissingSNID: false, isMissingHostname: false, checkDuplicate: false });
  assert.equal(matchingAuditRule({ item: 'TV', type: 'Interactive Samsung' }, DEFAULT_AUDIT_RULES)?.id, 'interactive-tv');
});

test('audit PDF makes exactly one page per ten items', async () => {
  const rows: AuditPdfRow[] = Array.from({ length: 23 }, (_, index) => ({ row: index + 2, item: `AIO ${index + 1}`, type: 'Acer', tag: 'Computer', quantity: '1', snid: '', hostname: '', sourceLocation: 'Class: 106', isMissingSNID: true, isMissingHostname: true, isUnchecked: true, isZeroQty: false, duplicateFields: [] }));
  const pdf = await buildAuditPdf(rows, 'all', new Date('2026-10-16T00:00:00Z'));
  assert.equal(pdf.getNumberOfPages(), 3);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
});
