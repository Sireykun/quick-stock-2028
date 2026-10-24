import type { SheetRow } from './sheets';

export interface StockItemGroup {
  key: string;
  name: string;
  rows: SheetRow[];
  totalQuantity: number;
  modelCount: number;
}

export function groupStockItems(rows: SheetRow[]): StockItemGroup[] {
  const groups = new Map<string, StockItemGroup>();
  for (const row of rows) {
    if (row._isDeleted) continue;
    const name = row.item?.trim() || 'Unnamed item';
    const key = name.toLocaleLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { key, name, rows: [], totalQuantity: 0, modelCount: 0 };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.totalQuantity += Math.max(0, Number.parseInt(row.quantity, 10) || 0);
  }
  for (const group of groups.values()) {
    group.modelCount = new Set(group.rows.map(row => row.type?.trim().toLocaleLowerCase() || 'unspecified')).size;
  }
  return [...groups.values()];
}

export function stockModelChoices(group: StockItemGroup, typesByTag: Record<string, string[]>): string[] {
  const category = group.rows[0]?.tag?.trim() || '';
  const choices = [...(typesByTag[category] || []), ...group.rows.map(row => row.type || '')];
  const seen = new Set<string>();
  return choices.filter(value => {
    const name = value.trim();
    const key = name.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
