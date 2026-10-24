import { fetchWithRetry, getSpreadsheetMetadata } from './sheets';

export interface SheetBackup {
  id: string;
  sheetId: string;
  createdAt: string;
  kind: 'automatic' | 'manual';
  tabs: { title: string; values: string[][] }[];
}

const DB_NAME = 'quickstock-backups';
const STORE = 'snapshots';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listBackups(sheetId: string): Promise<SheetBackup[]> {
  const all = await transact<SheetBackup[]>('readonly', store => store.getAll());
  return all.filter(item => item.sheetId === sheetId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveBackup(backup: SheetBackup): Promise<void> {
  await transact('readwrite', store => store.put(backup));
}

const range = (title: string) => `'${title.replaceAll("'", "''")}'!A1:Z`;
async function readTabs(sheetId: string, titles: string[]): Promise<string[][][]> {
  const params = new URLSearchParams();
  for (const title of titles) params.append('ranges', range(title));
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params}`);
  return titles.map((_, index) => (data.valueRanges?.[index]?.values || []) as string[][]);
}

export async function captureBackup(sheetId: string, kind: SheetBackup['kind']): Promise<SheetBackup> {
  const metadata = await getSpreadsheetMetadata(sheetId, true);
  const titles = metadata.sheets.map(sheet => sheet.properties.title);
  const values = await readTabs(sheetId, titles);
  const tabs = titles.map((title, index) => ({ title, values: values[index] }));
  const backup: SheetBackup = { id: crypto.randomUUID(), sheetId, createdAt: new Date().toISOString(), kind, tabs };
  await saveBackup(backup);
  return backup;
}

export async function captureDailyBackupOnOpen(sheetId: string): Promise<void> {
  if (!sheetId || sheetId.startsWith('demo_')) return;
  const existing = await listBackups(sheetId);
  const day = new Date().toISOString().slice(0, 10);
  if (existing.some(item => item.kind === 'automatic' && item.createdAt.startsWith(day))) return;
  await captureBackup(sheetId, 'automatic');
}

export async function previewBackup(backup: SheetBackup): Promise<{ title: string; before: number; after: number }[]> {
  const current = await readTabs(backup.sheetId, backup.tabs.map(tab => tab.title));
  return backup.tabs.map((tab, index) => ({ title: tab.title, before: current[index].length, after: tab.values.length }));
}

export async function restoreBackup(backup: SheetBackup): Promise<void> {
  const current = await readTabs(backup.sheetId, backup.tabs.map(tab => tab.title));
  const data = backup.tabs.map((tab, index) => {
    const width = Math.max(9, ...tab.values.map(row => row.length), ...current[index].map(row => row.length));
    const height = Math.max(1, tab.values.length, current[index].length);
    const values = Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => String(tab.values[row]?.[col] ?? '')));
    return { range: range(tab.title), values };
  });
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${backup.sheetId}/values:batchUpdate`, {
    method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}
