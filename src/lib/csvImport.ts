import { fetchWithRetry, getSpreadsheetMetadata, resolveSheetName } from './sheets';
import { translate } from '../components/LanguageProvider';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error(translate('CSV has an unclosed quote.'));
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export interface ImportRow { location: string; item: string; quantity: string; category: string; type: string; hostname: string; snid: string; error?: string }
export function validateImport(rows: string[][]): ImportRow[] {
  if (!rows.length) return [];
  const header = rows[0].map(cell => cell.trim().toLowerCase());
  const field = (names: string[]) => header.findIndex(cell => names.includes(cell));
  const indexes = { location: field(['location', 'room', 'class']), item: field(['item', 'item name']), quantity: field(['quantity', 'qty']), category: field(['category', 'tag']), type: field(['type', 'model', 'type/model']), hostname: field(['hostname']), snid: field(['snid', 'serial', 'serial number']) };
  if (indexes.location < 0 || indexes.item < 0 || indexes.quantity < 0) throw new Error(translate('CSV needs Location, Item Name, and Quantity columns.'));
  const seen = new Set<string>();
  return rows.slice(1).map((row, index) => {
    const get = (key: keyof typeof indexes) => indexes[key] < 0 ? '' : (row[indexes[key]] || '').trim();
    const item: ImportRow = { location: get('location'), item: get('item'), quantity: get('quantity'), category: get('category'), type: get('type'), hostname: get('hostname'), snid: get('snid') };
    if (!item.location || !item.item) item.error = `${translate('Row')} ${index + 2}: ${translate('location and item are required.')}`;
    else if (!/^\d+$/.test(item.quantity)) item.error = `${translate('Row')} ${index + 2}: ${translate('quantity must be a whole number.')}`;
    else if ([item.location, item.item, item.category, item.type, item.hostname, item.snid].some(value => value.length > 200 || /^[=+@\t]/.test(value))) item.error = `${translate('Row')} ${index + 2}: ${translate('invalid or formula-like text.')}`;
    const identity = item.snid ? `snid:${item.snid.toLowerCase()}` : item.hostname ? `hostname:${item.hostname.toLowerCase()}` : '';
    if (!item.error && identity && seen.has(identity)) item.error = `${translate('Row')} ${index + 2}: ${translate('duplicate asset ID in CSV.')}`;
    if (identity) seen.add(identity);
    return item;
  });
}

export async function importCsvRows(sheetId: string, tabName: string, rows: ImportRow[]): Promise<void> {
  if (!rows.length || rows.some(row => row.error)) throw new Error(translate('Fix invalid rows before importing.'));
  const title = await resolveSheetName(sheetId, tabName);
  const meta = await getSpreadsheetMetadata(sheetId);
  const sheet = meta.sheets.find(entry => entry.properties.title === title);
  if (!sheet) throw new Error(translate('Target tab was not found.'));
  const isClasses = title.toLowerCase() === 'classes';
  const now = new Date().toISOString();
  const values = rows.map(row => isClasses
    ? [row.location, row.item, row.quantity, row.category, row.type, row.hostname, row.snid, now, '']
    : [row.item, row.quantity, row.category, row.type, now, '', row.hostname, row.snid, row.location]);
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ appendCells: { sheetId: sheet.properties.sheetId, rows: values.map(row => ({ values: row.map(value => ({ userEnteredValue: { stringValue: value } })) })), fields: 'userEnteredValue' } }] }),
  });
}
