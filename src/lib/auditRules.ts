import type { SheetRow } from './sheets';

export interface AuditRule {
  id: string;
  itemName: string;
  modelContains: string;
  requireSnid: boolean;
  requireHostname: boolean;
  checkDuplicate: boolean;
}

export const DEFAULT_AUDIT_RULES: AuditRule[] = [
  { id: 'aio', itemName: 'AIO', modelContains: '', requireSnid: true, requireHostname: true, checkDuplicate: true },
  { id: 'interactive-tv', itemName: 'TV', modelContains: 'Interactive', requireSnid: true, requireHostname: false, checkDuplicate: false },
  { id: 'samsung-tv', itemName: 'TV', modelContains: 'Samsung', requireSnid: true, requireHostname: false, checkDuplicate: false },
];

const storageKey = (sheetId: string) => `quickStock_auditRules_v1_${sheetId}`;
const normalize = (value?: string) => (value || '').trim().toLocaleLowerCase();

export function readAuditRules(sheetId: string): AuditRule[] {
  try {
    const saved = localStorage.getItem(storageKey(sheetId));
    if (!saved) return DEFAULT_AUDIT_RULES.map(rule => ({ ...rule }));
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((rule): rule is AuditRule =>
      typeof rule?.id === 'string' && typeof rule?.itemName === 'string' &&
      typeof rule?.modelContains === 'string' && typeof rule?.requireSnid === 'boolean' &&
      typeof rule?.requireHostname === 'boolean' && typeof rule?.checkDuplicate === 'boolean') : DEFAULT_AUDIT_RULES.map(rule => ({ ...rule }));
  } catch {
    return DEFAULT_AUDIT_RULES.map(rule => ({ ...rule }));
  }
}

export function writeAuditRules(sheetId: string, rules: AuditRule[]) {
  localStorage.setItem(storageKey(sheetId), JSON.stringify(rules));
}

export function matchingAuditRule(item: Pick<SheetRow, 'item' | 'type'>, rules: AuditRule[]): AuditRule | undefined {
  const name = normalize(item.item);
  const model = normalize(item.type);
  return [...rules]
    .filter(rule => normalize(rule.itemName) === name && (!normalize(rule.modelContains) || model.includes(normalize(rule.modelContains))))
    .sort((a, b) => normalize(b.modelContains).length - normalize(a.modelContains).length)[0];
}

export function auditFieldFlags(item: Pick<SheetRow, 'item' | 'type' | 'snid' | 'hostname'>, rules: AuditRule[]) {
  const rule = matchingAuditRule(item, rules);
  return {
    isMissingSNID: Boolean(rule?.requireSnid && !normalize(item.snid)),
    isMissingHostname: Boolean(rule?.requireHostname && !normalize(item.hostname)),
    checkDuplicate: Boolean(rule?.checkDuplicate),
  };
}
