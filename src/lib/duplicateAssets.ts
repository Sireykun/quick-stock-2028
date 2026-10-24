import { getAllClassesAndItems, getInventory, type SheetRow } from './sheets';

export interface LocatedAsset extends SheetRow {
  sourceLocation: string;
}

export interface DuplicateMatch {
  field: 'SNID' | 'Hostname';
  value: string;
  matches: LocatedAsset[];
}

const normalizeId = (value?: string) => (value || '').trim().toLocaleLowerCase();

export async function loadLocatedAssets(spreadsheetId: string): Promise<LocatedAsset[]> {
  const [classMap, stockRows] = await Promise.all([
    getAllClassesAndItems(spreadsheetId, 'Classes'),
    getInventory(spreadsheetId, 'Stock Room'),
  ]);
  return [
    ...Object.entries(classMap).flatMap(([name, rows]) => rows.map(row => ({ ...row, sourceLocation: `Class: ${name}` }))),
    ...stockRows.map(row => ({ ...row, sourceLocation: `Stock: ${row.location || 'Stock Room'}` })),
  ];
}

export function findDuplicateMatches(asset: LocatedAsset, assets: LocatedAsset[]): DuplicateMatch[] {
  return ([['SNID', asset.snid, 'snid'], ['Hostname', asset.hostname, 'hostname']] as const)
    .filter(([, value]) => normalizeId(value))
    .map(([field, value, key]) => ({
      field,
      value: value!.trim(),
      matches: assets.filter(other =>
        other !== asset &&
        !(other.sourceLocation === asset.sourceLocation && other.row === asset.row) &&
        normalizeId(other[key]) === normalizeId(value)
      ),
    }))
    .filter(match => match.matches.length > 0);
}

export function getDuplicateAssets(assets: LocatedAsset[]): Map<LocatedAsset, DuplicateMatch[]> {
  const duplicates = new Map<LocatedAsset, DuplicateMatch[]>();
  for (const asset of assets) {
    const matches = findDuplicateMatches(asset, assets);
    if (matches.length) duplicates.set(asset, matches);
  }
  return duplicates;
}
