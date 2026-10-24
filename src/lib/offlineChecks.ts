import { getClassInventory, updateClassInventory, type SheetRow } from './sheets';

export interface OfflineCheck { id: string; sheetId: string; tab: string; location: string; row: SheetRow; original?: SheetRow; savedAt: string }
const KEY = 'quickstock_pending_checks_v1';
function storedChecks(): OfflineCheck[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export function pendingChecks(): OfflineCheck[] {
  const activeSheet = localStorage.getItem('quickStock_classesSheetId');
  return activeSheet ? storedChecks().filter(item => item.sheetId === activeSheet) : [];
}
export function queueCheck(check: Omit<OfflineCheck, 'id' | 'savedAt'>): OfflineCheck {
  if (check.sheetId !== localStorage.getItem('quickStock_classesSheetId')) throw new Error('The active workspace changed. Reopen this inventory.');
  const item = { ...check, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify([...storedChecks(), item]));
  window.dispatchEvent(new Event('quickstock:pending-checks'));
  return item;
}
export async function syncChecks(): Promise<{ synced: number; error?: string }> {
  let synced = 0;
  for (const item of pendingChecks()) {
    try {
      const rows = await getClassInventory(item.sheetId, item.tab, item.location);
      const current = rows.find(row => row.row === item.row.row);
      if (!current || current.item.trim() !== (item.original?.item ?? item.row.item).trim() || (current.snid && current.snid !== (item.original?.snid ?? item.row.snid))) throw new Error(`Row ${item.row.row} changed; review ${item.row.item} before syncing.`);
      if (item.original && (['quantity', 'tag', 'type', 'hostname', 'snid', 'status'] as const).some(field => (current[field] || '') !== (item.original?.[field] || ''))) throw new Error(`Row ${item.row.row} changed in Google Sheets; review ${item.row.item} before syncing.`);
      await updateClassInventory(item.sheetId, item.tab, [item.row]);
      localStorage.setItem(KEY, JSON.stringify(storedChecks().filter(pending => pending.id !== item.id)));
      synced++;
    } catch (error) { window.dispatchEvent(new Event('quickstock:pending-checks')); return { synced, error: (error as Error).message }; }
  }
  window.dispatchEvent(new Event('quickstock:pending-checks'));
  return { synced };
}
