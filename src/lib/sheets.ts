
export async function resolveSheetName(spreadsheetId: string, preferredName: string): Promise<string> {
  if (!preferredName || !spreadsheetId) return preferredName || 'Sheet1';
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId);
    if (!meta.sheets || meta.sheets.length === 0) return preferredName;
    
    // 1. Exact match (case insensitive)
    const match = meta.sheets.find(
      (s) => s.properties.title.toLowerCase() === preferredName.toLowerCase()
    );
    if (match) return match.properties.title;

    // 2. Partial match
    const partialMatch = meta.sheets.find(
      (s) => s.properties.title.toLowerCase().includes(preferredName.toLowerCase()) ||
             preferredName.toLowerCase().includes(s.properties.title.toLowerCase())
    );
    if (partialMatch) return partialMatch.properties.title;

    // 3. Fallback to the first sheet if we cannot find it
    return meta.sheets[0].properties.title;
  } catch (err) {
    return preferredName;
  }
}

export async function resolveSheetNumericalId(spreadsheetId: string, preferredName: string, fallbackId: number = 0): Promise<number> {
  if (!spreadsheetId) return fallbackId;
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId);
    if (!meta.sheets || meta.sheets.length === 0) return fallbackId;
    
    if (preferredName) {
      const match = meta.sheets.find(
        (s) => s.properties.title.toLowerCase() === preferredName.toLowerCase()
      );
      if (match) return match.properties.sheetId;

      const partialMatch = meta.sheets.find(
        (s) => s.properties.title.toLowerCase().includes(preferredName.toLowerCase()) ||
               preferredName.toLowerCase().includes(s.properties.title.toLowerCase())
      );
      if (partialMatch) return partialMatch.properties.sheetId;
    }

    const fallbackMatch = meta.sheets.find(s => s.properties.sheetId === fallbackId);
    if (fallbackMatch) return fallbackMatch.properties.sheetId;

    return meta.sheets[0].properties.sheetId;
  } catch (err) {
    return fallbackId;
  }
}
import { getAccessToken, logout } from './auth';

export interface SheetMetadata {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  sheets: {
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }[];
}

export interface SheetRow {
  row: number;
  item: string;
  quantity: string;
  tag?: string;
  type?: string;
  lastUpdated?: string;
  status?: string;
  hostname?: string;
  snid?: string;
  location?: string;
  _isDeleted?: boolean;
}

export class SheetsApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
  }
}

export function isHeaderRow(row: string[]): boolean {
  if (!row || row.length === 0) return true;
  const col0 = String(row[0] || '').trim().toLowerCase();
  const col1 = String(row[1] || '').trim().toLowerCase();
  const col2 = String(row[2] || '').trim().toLowerCase();

  const headerExactMatches = [
    'class name', 'item name', 'location', 'quantity', 'category',
    'type/model', 'hostname', 'snid', 'last updated', 'status',
    'default tag', 'default type', 'room name', 'group name',
    'item', 'qty', 'tag', 'type'
  ];

  if (headerExactMatches.includes(col0) && headerExactMatches.includes(col1)) return true;
  if (col0 === 'class name' || col0 === 'location') return true;
  if (col0 === 'item name' && (col1 === 'quantity' || col1 === 'default tag' || col1 === '')) return true;
  if (col1 === 'item name' || col1 === 'quantity') return true;

  return false;
}

function parseGvizText(text: string): string[][] | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const jsonStr = text.substring(start, end + 1);
    const json = JSON.parse(jsonStr);
    if (!json.table) return null;

    const cols = json.table.cols || [];
    const rows = json.table.rows || [];

    const headers: string[] = cols.map((c: any, i: number) => {
      if (c && c.label && c.label.trim()) return c.label.trim();
      return `Column ${i + 1}`;
    });

    const resultRows: string[][] = [headers];

    for (const r of rows) {
      if (!r || !r.c) continue;
      const rowVal: string[] = r.c.map((cell: any) => {
        if (!cell || cell.v === null || cell.v === undefined) return '';
        if (cell.f !== undefined && cell.f !== null) return String(cell.f);
        return String(cell.v);
      });
      if (rowVal.some(v => v.trim() !== '')) {
        resultRows.push(rowVal);
      }
    }
    return resultRows;
  } catch (e) {
    return null;
  }
}

async function fetchGvizSheetData(spreadsheetId: string, sheetName: string): Promise<string[][] | null> {
  if (!spreadsheetId || spreadsheetId === 'admin_local_spreadsheet_id' || spreadsheetId.startsWith('demo_')) {
    return null;
  }
  try {
    const cleanSheetName = sheetName.split('!')[0].trim();
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(cleanSheetName)}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    return parseGvizText(text);
  } catch (e) {
    return null;
  }
}

async function getMockOrLocalResponse(url: string, options: RequestInit = {}): Promise<any> {
  const match = url.match(/spreadsheets\/([^/:?]+)/);
  const spreadsheetId = match ? match[1] : 'admin_local_spreadsheet_id';
  const storageKey = `quickStock_sheet_store_${spreadsheetId}`;
  
  let store: any = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) store = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse local sheet store', e);
  console.log('API CALL URL:', url, options);
  }

  if (!store || !store.sheets) {
    store = {
      spreadsheetId,
      title: 'Quick Stock Inventory Sheet',
      sheets: {
        'Classes': [
          ['Class Name', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'],
          ['Room 101', 'Laptop Dell XPS', '15', 'Computer', 'Dell XPS', 'HOST-101-01', 'SN-XPS-001', '2026-08-01', 'Checked'],
          ['Room 101', 'Wireless Mouse', '15', 'Peripheral', 'Logitech', '', '', '2026-08-01', 'Checked'],
          ['Room 102', 'Laptop Dell XPS', '20', 'Computer', 'MacBook Pro', 'HOST-102-01', 'SN-MAC-002', '2026-08-01', 'Checked']
        ],
        'Stock Room': [
          ['Item Name', 'Quantity', 'Category', 'Type/Model', 'Last Updated', 'Status', 'Hostname', 'SNID', 'Location'],
          ['Laptop Dell XPS', '50', 'Computer', 'Dell XPS', '2026-08-01', 'Checked', 'DEV-STOCK-01', 'SN-STOCK-001', 'Stock Room'],
          ['Wireless Mouse', '100', 'Peripheral', 'Logitech', '2026-08-01', 'Checked', '', '', 'Stock Room'],
          ['Mechanical Keyboard', '40', 'Peripheral', 'Keychron', '2026-08-01', 'Checked', '', '', 'Stock Room']
        ],
        'Item Master': [
          ['Item Name'], ['Laptop Dell XPS'], ['Wireless Mouse'], ['Mechanical Keyboard'], ['Monitor 24"'], ['Desktop Workstation']
        ],
        'Lab_Template': [
          ['Item Name', 'Default Tag', 'Default Type'], ['Desktop', 'Computer', 'Dell Workstation'], ['Monitor', 'Peripheral', '24" Dell']
        ]
      }
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch (e) {}
  }

  const isWrite = url.includes(':batchUpdate') || url.includes(':append') || options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE';
  if (isWrite) {
    console.log('API CALL IS WRITE:', url, options.body);
    if (options.body && typeof options.body === 'string') {
      try {
        const bodyObj = JSON.parse(options.body);
        if (bodyObj.values && Array.isArray(bodyObj.values)) {
          const decodedUrl = decodeURIComponent(url);
          for (const sheetName of Object.keys(store.sheets)) {
            if (decodedUrl.includes(sheetName)) {
              store.sheets[sheetName] = store.sheets[sheetName].concat(bodyObj.values);
              localStorage.setItem(storageKey, JSON.stringify(store));
              break;
            }
          }
        }
      } catch (e) {}
    }
    return { spreadsheetId, updatedRows: 1, updatedColumns: 1 };
  }

  const decodedUrl = decodeURIComponent(url);

  // Metadata request
  if (url.includes('spreadsheets/') && !url.includes('/values/')) {
    const sheetTitles = Object.keys(store.sheets);
    return {
      spreadsheetId,
      properties: { title: store.title },
      sheets: sheetTitles.map((title, idx) => ({
        properties: { sheetId: idx + 1, title }
      }))
    };
  }

  // Values request
  if (url.includes('/values/')) {
    let targetSheetName = '';
    for (const sheetName of Object.keys(store.sheets)) {
      if (decodedUrl.includes(sheetName)) {
        targetSheetName = sheetName;
        break;
      }
    }
    if (!targetSheetName) {
      const parts = decodedUrl.split('/values/');
      if (parts[1]) {
        targetSheetName = parts[1].split('!')[0].split('?')[0];
      }
    }

    if (targetSheetName) {
      let rows: string[][] = store.sheets[targetSheetName] || [];
      // Try fetching live GViz data from Google Sheets if shared with link / bot
      const liveGviz = await fetchGvizSheetData(spreadsheetId, targetSheetName);
      if (liveGviz && liveGviz.length > 0) {
        rows = liveGviz;
        store.sheets[targetSheetName] = liveGviz;
        try {
          localStorage.setItem(storageKey, JSON.stringify(store));
        } catch (e) {}
      }

      if (rows && rows.length > 0) {
        const isA2Request = decodedUrl.includes('!A2') || decodedUrl.includes('!B2') || decodedUrl.includes('!C2');
        let returnRows = rows;
        if (isA2Request) {
          returnRows = rows.slice(1);
        }
        returnRows = returnRows.filter(r => !isHeaderRow(r));
        return { values: returnRows };
      }
    }
    return { values: [] };
  }

  return {};
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3) {
  let attempt = 0;
  
  const activeToken = getAccessToken();
  const isDemo = url.includes('demo_admin_spreadsheet_id') || url.includes('demo_classes_spreadsheet_id') || url.includes('admin_local_spreadsheet_id');

  if (!isDemo && (!activeToken || activeToken === 'dummy_token_for_email_login')) {
    throw new SheetsApiError('Connect your Google account in Settings to read and edit this spreadsheet.');
  }

  // Keep the local demo store only for explicit demo spreadsheet IDs.
  if (isDemo) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
      };
      if (activeToken && activeToken !== 'dummy_token_for_email_login') {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const response = await fetch(url, { ...options, cache: "no-store", headers });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Ignore error and fall back to local store / GViz
    }
    return await getMockOrLocalResponse(url, options);
  }

  while (attempt < maxRetries) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
      };

      if (activeToken && activeToken !== 'dummy_token_for_email_login') {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout().catch(() => {});
          const errorData = await response.json().catch(() => null);
          let errorMessage = errorData?.error?.message || "Session expired. Please sign in again.";
          throw new SheetsApiError("Session expired. Please sign in again.", 401);
        }
        if (response.status === 403 || response.status === 404) {
          const errorData = await response.json().catch(() => null);
          let errorMessage = errorData?.error?.message || `Google Sheets API Error: ${response.status}`;
          if (response.status === 403) errorMessage = "Permission Denied to access this Spreadsheet. Please check the ID and your Google account.";
          if (response.status === 404) errorMessage = "Spreadsheet not found. Please check the Spreadsheet ID in Settings.";
          throw new SheetsApiError(errorMessage, response.status);
        }
        const errorData = await response.json().catch(() => null);
        let errorMessage = errorData?.error?.message || `Google Sheets API Error: ${response.status} ${response.statusText}`;
        throw new SheetsApiError(errorMessage, response.status);
      }

      return await response.json();
    } catch (error: any) {
      const status = error.status;
      
      if (status === 401 || status === 403 || status === 404) {
        throw error;
      }
      
      if (status === 400) {
        console.error('Google Sheets API Bad Request:', error.message);
        if (error.message?.includes('Unable to parse range')) {
            invalidateSpreadsheetMetadataCache();
        }
        throw error;
      }

      if (status === 429 || (status >= 500 && status < 600) || !status) {
        attempt++;
        if (attempt >= maxRetries) {
          return await getMockOrLocalResponse(url, options);
        }
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  return await getMockOrLocalResponse(url, options);
}

interface MetadataCacheEntry {
  timestamp: number;
  data: SheetMetadata;
}
const metadataCache = new Map<string, MetadataCacheEntry>();
const pendingMetadata = new Map<string, Promise<SheetMetadata>>();
const METADATA_TTL_MS = 60000; // 1 minute

export function invalidateSpreadsheetMetadataCache(spreadsheetId?: string) {
  if (spreadsheetId) {
    metadataCache.delete(spreadsheetId);
    pendingMetadata.delete(spreadsheetId);
  } else {
    metadataCache.clear();
    pendingMetadata.clear();
  }
}

/**
 * Fetches metadata about the spreadsheet, including all sheet tabs with in-memory caching.
 */
export async function getSpreadsheetMetadata(spreadsheetId: string, forceFresh = false): Promise<SheetMetadata> {
  if (!forceFresh && metadataCache.has(spreadsheetId)) {
    const entry = metadataCache.get(spreadsheetId)!;
    if (Date.now() - entry.timestamp < METADATA_TTL_MS) {
      return entry.data;
    }
  }
  if (!forceFresh && pendingMetadata.has(spreadsheetId)) {
    return pendingMetadata.get(spreadsheetId)!;
  }
  const request = fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,index))`
  ).then((data: SheetMetadata) => {
    metadataCache.set(spreadsheetId, { timestamp: Date.now(), data });
    return data;
  }).finally(() => {
    pendingMetadata.delete(spreadsheetId);
  });
  pendingMetadata.set(spreadsheetId, request);
  return request;
}

export async function deleteClassItems(spreadsheetId: string, sheetId: number, sheetName: string, rowsToDelete: number[], className: string): Promise<void> {
  if (rowsToDelete.length === 0) return;
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);
  // Fetch a wider range so we don't miss rows if Column A is sparse
  const range = `'${actualSheetName}'!A2:Z`;
  const encodedRange = encodeURIComponent(range);
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  
  let currentClass = '';
  let classRows: number[] = [];
  let classTitleRow = -1;

  if (data.values) {
    for (let index = 0; index < data.values.length; index++) {
      const row = data.values[index];
      if (row[0] && String(row[0]).trim() !== '') {
        currentClass = String(row[0]).trim();
      }
      
      if (currentClass === className) {
        const actualRow = index + 2;
        classRows.push(actualRow);
        if (row[0] && String(row[0]).trim() === className) {
          classTitleRow = actualRow;
        }
      } else if (currentClass !== className && classRows.length > 0) {
        break;
      }
    }
  }

  const rowsToDeleteSet = new Set(rowsToDelete);
  let migrateTitleToRow = -1;
  
  if (classTitleRow !== -1 && rowsToDeleteSet.has(classTitleRow)) {
    // The row with the title is being deleted. Find the next available row in this class.
    for (const r of classRows) {
      if (!rowsToDeleteSet.has(r)) {
        migrateTitleToRow = r;
        break;
      }
    }
  }

  const batchUpdateRequests: any[] = [];

  if (classTitleRow !== -1 && rowsToDeleteSet.has(classTitleRow)) {
    if (migrateTitleToRow !== -1) {
      // Migrate title to the next available row
      batchUpdateRequests.push({
        updateCells: {
          range: {
            sheetId: actualSheetId,
            startRowIndex: migrateTitleToRow - 1,
            endRowIndex: migrateTitleToRow,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          rows: [
            {
              values: [{ userEnteredValue: { stringValue: className } }]
            }
          ],
          fields: 'userEnteredValue'
        }
      });
    } else {
      // All items in the class are being deleted. Don't delete the title row, just clear its contents (Columns B to I).
      rowsToDeleteSet.delete(classTitleRow);
      
      batchUpdateRequests.push({
        updateCells: {
          range: {
            sheetId: actualSheetId,
            startRowIndex: classTitleRow - 1,
            endRowIndex: classTitleRow,
            startColumnIndex: 1,
            endColumnIndex: 9 // Up to column I
          },
          rows: [
            {
              values: [
                { userEnteredValue: { stringValue: '' } }, // B
                { userEnteredValue: { stringValue: '' } }, // C
                { userEnteredValue: { stringValue: '' } }, // D
                { userEnteredValue: { stringValue: '' } }, // E
                { userEnteredValue: { stringValue: '' } }, // F
                { userEnteredValue: { stringValue: '' } }, // G
                { userEnteredValue: { stringValue: '' } }, // H
                { userEnteredValue: { stringValue: '' } }  // I
              ]
            }
          ],
          fields: 'userEnteredValue'
        }
      });
    }
  }

  // Delete remaining rows in reverse order (from bottom to top) so row indices don't shift
  const sortedToDelete = Array.from(rowsToDeleteSet).sort((a, b) => b - a);

  for (const row of sortedToDelete) {
    batchUpdateRequests.push({
      deleteDimension: {
        range: {
          sheetId: actualSheetId,
          dimension: 'ROWS',
          startIndex: row - 1,
          endIndex: row
        }
      }
    });
  }

  if (batchUpdateRequests.length > 0) {
    await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: batchUpdateRequests
      })
    });
  }
}

export async function deleteRows(spreadsheetId: string, sheetId: number, sheetName: string, rowsToDelete: number[]): Promise<void> {
  if (rowsToDelete.length === 0) return;
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);
  
  const sortedToDelete = [...rowsToDelete].sort((a, b) => b - a);
  const requests = sortedToDelete.map(row => ({
    deleteDimension: {
      range: {
        sheetId: actualSheetId,
        dimension: 'ROWS',
        startIndex: row - 1,
        endIndex: row
      }
    }
  }));

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests })
  });
}

export async function deleteEntireClassOrLocation(spreadsheetId: string, sheetId: number, sheetName: string, className: string): Promise<void> {
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);
  const range = `'${actualSheetName}'!A1:I`;
  const encodedRange = encodeURIComponent(range);
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  
  if (!data.values || data.values.length === 0) return;

  const header = data.values[0] && isHeaderRow(data.values[0]) ? data.values[0] : undefined;
  const sheetFormat = detectSheetFormat(header, data.values.slice(1, 10));

  const targetNorm = className.replace(/\s+/g, ' ').trim().toLowerCase();
  const rowsToDelete: number[] = [];

  let currentGroup = '';
  for (let i = 0; i < data.values.length; i++) {
    const row = data.values[i];
    const rowNum = i + 1;

    if (isHeaderRow(row)) continue;

    if (sheetFormat === 'FormatA') {
      if (row[0] && String(row[0]).trim() !== '') {
        currentGroup = String(row[0]).trim();
      }
      if (currentGroup.replace(/\s+/g, ' ').trim().toLowerCase() === targetNorm) {
        rowsToDelete.push(rowNum);
      }
    } else {
      const loc = (row[8] ? String(row[8]).trim() : '');
      if (loc.replace(/\s+/g, ' ').trim().toLowerCase() === targetNorm) {
        rowsToDelete.push(rowNum);
      }
    }
  }

  if (rowsToDelete.length > 0) {
    await deleteRows(spreadsheetId, actualSheetId, actualSheetName, rowsToDelete);
  }
}

/**
 * Ensures that a Stock Room sheet has the 9-column headers and that old stock items
 * (where Location was stored in Col C instead of Col I) are migrated directly in Google Sheets.
 */
export async function ensureStockSheetMigrated(spreadsheetId: string, sheetName: string): Promise<{ values?: string[][] }> {
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const range = `'${actualSheetName}'!A1:I`;
  const encodedRange = encodeURIComponent(range);
  let data;
  const newHeaders = ['Location', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'];

  try {
    data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  } catch (error: any) {
    if (error.status === 400 && error.message?.includes('Unable to parse range')) {
      // The sheet does not exist! Fallback gracefully instead of creating.
      return { values: [] };
    }
    throw error;
  }

  if (!data.values || data.values.length === 0) {
    await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [newHeaders] })
    });
    return { values: [newHeaders] };
  }
  
  const header = data.values[0] && isHeaderRow(data.values[0]) ? data.values[0] : undefined;
  const format = detectSheetFormat(header, data.values.slice(1, 10));
  
  if (format === 'FormatB') {
    const newValues = [newHeaders];
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      // FormatB: [Item(0), Qty(1), Tag(2), Type(3), Timestamp(4), Status(5), Hostname(6), SNID(7), Location(8)]
      // FormatA: [Location(0), Item(1), Qty(2), Tag(3), Type(4), Hostname(5), SNID(6), Timestamp(7), Status(8)]
      newValues.push([
        row[8] || 'Stock Room',
        row[0] || '',
        row[1] || '0',
        row[2] || '',
        row[3] || '',
        row[6] || '',
        row[7] || '',
        row[4] || '',
        row[5] || ''
      ]);
    }
    
    await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: newValues })
    });
    return { values: newValues };
  }
  return data;
}

export function detectSheetFormat(headerRow?: string[], sampleRows?: string[][]): 'FormatA' | 'FormatB' {
  if (headerRow && headerRow.length > 0) {
    const col0 = String(headerRow[0] || '').trim().toLowerCase();
    const col1 = String(headerRow[1] || '').trim().toLowerCase();
    if (col0.includes('class') || col0.includes('location') || col0.includes('room') || col0.includes('stock') || col1.includes('item')) {
      return 'FormatA';
    }
    if (col0.includes('item') || col1.includes('qty') || col1.includes('quantity')) {
      return 'FormatB';
    }
  }

  if (sampleRows && sampleRows.length > 0) {
    let hasFormatBEvidence = false;
    for (const row of sampleRows) {
      if (row[0] && row[1]) {
        // In Format A, col 1 is Item Name (string)
        // In Format B, col 1 is Quantity (number)
        if (isNaN(Number(row[1]))) {
          return 'FormatA';
        } else {
          hasFormatBEvidence = true;
        }
      }
    }
    if (hasFormatBEvidence) {
      return 'FormatB';
    }
  }

  return 'FormatA';
}

export function detectRowFormat(headerRow?: string[], dataRow?: string[]): 'FormatA' | 'FormatB' {
  return detectSheetFormat(headerRow, dataRow ? [dataRow] : undefined);
}

/**
 * Reads items and quantities from a specific sheet.
 * Auto-detects whether Col A is Location/Class Name or Item Name.
 */
export async function getInventory(spreadsheetId: string, sheetName: string): Promise<SheetRow[]> {
  const data = await ensureStockSheetMigrated(spreadsheetId, sheetName);
  
  if (!data.values || data.values.length === 0) return [];

  const header = data.values[0] && isHeaderRow(data.values[0]) ? data.values[0] : undefined;
  const sheetFormat = detectSheetFormat(header, data.values.slice(1, 10));

  let currentGroupLocation = '';
  const result: SheetRow[] = [];

  for (let i = 0; i < data.values.length; i++) {
    const row = data.values[i];
    const rowNum = i + 1; // 1-indexed row in Google Sheets

    if (isHeaderRow(row)) continue;

    if (sheetFormat === 'FormatA') {
      if (row[0] && String(row[0]).trim() !== '') {
        currentGroupLocation = String(row[0]).trim();
      }

      const itemName = (row[1] || '').trim();

      if (!itemName) {
        if (row[0] && row[2] && !isNaN(Number(row[2]))) {
          result.push({
            row: rowNum,
            item: String(row[0]).trim(),
            quantity: row[2] || '0',
            tag: row[3] || '',
            type: row[4] || '',
            hostname: row[5] || '',
            snid: row[6] || '',
            lastUpdated: row[7] || '',
            status: row[8] || '',
            location: currentGroupLocation || String(row[0]).trim() || 'Uncategorized',
          });
        }
        continue;
      }

      let qty = row[2] || '0';
      let tag = row[3] || '';
      let type = row[4] || '';

      if ((!row[2] || isNaN(Number(row[2]))) && row[3] && !isNaN(Number(row[3]))) {
        qty = row[3];
        tag = row[4] || '';
        type = row[5] || '';
      }

      result.push({
        row: rowNum,
        item: itemName,
        quantity: qty,
        tag: tag,
        type: type,
        hostname: row[5] || '',
        snid: row[6] || '',
        lastUpdated: row[7] || '',
        status: row[8] || '',
        location: currentGroupLocation || (row[0] ? String(row[0]).trim() : '') || 'Uncategorized',
      });

    } else {
      const itemName = (row[0] || '').trim();
      if (!itemName) continue;

      result.push({
        row: rowNum,
        item: itemName,
        quantity: row[1] || '0',
        tag: row[2] || '',
        type: row[3] || '',
        lastUpdated: row[4] || '',
        status: row[5] || '',
        hostname: row[6] || '',
        snid: row[7] || '',
        location: (row[8] || '').trim() || 'Uncategorized',
      });
    }
  }

  return result;
}

/**
 * Updates multiple rows in a batch, respecting the sheet's existing column format.
 */
export async function updateInventory(spreadsheetId: string, sheetName: string, updates: SheetRow[]): Promise<void> {
  if (updates.length === 0) return;
  await ensureStockSheetMigrated(spreadsheetId, sheetName);
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);

  const fullData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I`);
  const header = fullData.values?.[0];
  const sampleRows = fullData.values?.slice(1, 10);
  const format = detectSheetFormat(header, sampleRows);
  let lastDataRow = 0;
  if (fullData.values) {
    for (let i = fullData.values.length - 1; i >= 0; i--) {
      if (fullData.values[i].some((cell) => String(cell).trim() !== '')) {
        lastDataRow = i + 1;
        break;
      }
    }
  }

  const now = new Date().toLocaleString();

  const data = updates.map(update => {
    let rowValues: string[];
    if (format === 'FormatA') {
      rowValues = [
        update.item,
        update.quantity,
        update.tag || '',
        update.type || '',
        update.hostname || '',
        update.snid || '',
        now,
        update.status || ''
      ];
      return {
        range: `'${actualSheetName}'!B${update.row}:I${update.row}`,
        values: [rowValues]
      };
    } else {
      rowValues = [
        update.item,
        update.quantity,
        update.tag || '',
        update.type || '',
        now,
        update.status || '',
        update.hostname || '',
        update.snid || '',
        update.location || ''
      ];
      return {
        range: `'${actualSheetName}'!A${update.row}:I${update.row}`,
        values: [rowValues]
      };
    }
  });

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data,
    })
  });

  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const targetSheet = meta.sheets.find(s => s.properties.title.toLowerCase() === actualSheetName.toLowerCase());
  if (targetSheet) {
    await formatClassColors(spreadsheetId, targetSheet.properties.sheetId, actualSheetName);
  }
}

/**
 * Appends a new item to the sheet, matching the sheet's column format.
 */
export async function appendInventoryItem(spreadsheetId: string, sheetName: string, item: string, quantity: string, tag: string = '', type: string = '', status: string = '', hostname: string = '', snid: string = '', location: string = ''): Promise<void> {
  await ensureStockSheetMigrated(spreadsheetId, sheetName);
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);

  const fullData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I`);
  const header = fullData.values?.[0];
  const sampleRows = fullData.values?.slice(1, 10);
  const format = detectSheetFormat(header, sampleRows);
  let lastDataRow = 0;
  if (fullData.values) {
    for (let i = fullData.values.length - 1; i >= 0; i--) {
      if (fullData.values[i].some((cell) => String(cell).trim() !== '')) {
        lastDataRow = i + 1;
        break;
      }
    }
  }

  const range = `'${actualSheetName}'!A:I`;
  const encodedRange = encodeURIComponent(range);
  const now = new Date().toLocaleString();

  let rowValues: string[];
  if (format === 'FormatA') {
    rowValues = [location, item, quantity, tag, type, hostname, snid, now, status];
  } else {
    rowValues = [item, quantity, tag, type, now, status, hostname, snid, location];
  }

  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheet = meta.sheets.find((s: any) => s.properties.title === actualSheetName);
  const actualSheetId = sheet?.properties.sheetId;
  const insertIndex = lastDataRow > 0 ? lastDataRow : 1;

  const cellValues = rowValues.map(val => ({ userEnteredValue: { stringValue: val } }));

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: actualSheetId,
              dimension: 'ROWS',
              startIndex: insertIndex,
              endIndex: insertIndex + 1
            },
            inheritFromBefore: true
          }
        },
        {
          updateCells: {
            rows: [
              {
                values: cellValues
              }
            ],
            fields: 'userEnteredValue',
            range: {
              sheetId: actualSheetId,
              startRowIndex: insertIndex,
              endRowIndex: insertIndex + 1,
              startColumnIndex: 0,
              endColumnIndex: 9
            }
          }
        }
      ]
    })
  });
}

/**
 * Fetches unique class names from Column A of the given sheet.
 */

export async function getLocations(spreadsheetId: string, sheetName: string): Promise<{title: string, isChecked: boolean}[]> {
  return getClasses(spreadsheetId, sheetName);
}

export async function getClasses(spreadsheetId: string, sheetName: string): Promise<{title: string, isChecked: boolean}[]> {
  const data = await ensureStockSheetMigrated(spreadsheetId, sheetName);
  
  if (!data.values || data.values.length === 0) return [];

  const header = data.values[0] && isHeaderRow(data.values[0]) ? data.values[0] : undefined;
  const sheetFormat = detectSheetFormat(header, data.values.slice(1, 10));

  const classStatusMap = new Map<string, { total: number, checked: number }>();

  let currentClass = '';
  for (let i = 0; i < data.values.length; i++) {
    const row = data.values[i];
    if (isHeaderRow(row)) continue;

    if (sheetFormat === 'FormatA') {
      if (row[0] && String(row[0]).trim() !== '') {
        currentClass = String(row[0]).trim();
      }
      const cName = currentClass;
      if (cName) {
        if (!classStatusMap.has(cName)) classStatusMap.set(cName, { total: 0, checked: 0 });
        const itemName = row[1];
        if (itemName && String(itemName).trim() !== '') {
          const stats = classStatusMap.get(cName)!;
          const quantity = parseInt(row[2]) || 0;
          stats.total += quantity;
          const status = row[8] ? String(row[8]).trim().toLowerCase() : '';
          if (status === 'checked' || status === 'ok' || status === 'yes') {
            stats.checked += quantity;
          }
        }
      }
    } else {
      const cName = (row[8] ? String(row[8]).trim() : '');
      if (cName) {
        if (!classStatusMap.has(cName)) classStatusMap.set(cName, { total: 0, checked: 0 });
        const itemName = row[0];
        if (itemName && String(itemName).trim() !== '') {
          const stats = classStatusMap.get(cName)!;
          const quantity = parseInt(row[1]) || 0;
          stats.total += quantity;
          const status = row[5] ? String(row[5]).trim().toLowerCase() : '';
          if (status === 'checked' || status === 'ok' || status === 'yes') {
            stats.checked += quantity;
          }
        }
      }
    }
  }

  return Array.from(classStatusMap.entries()).map(([title, stats]) => ({
    title,
    isChecked: stats.total > 0 && stats.checked >= stats.total
  }));
}

/**
 * Fetches the global summary of items and checked items across all classes.
 */
export async function getGlobalInventorySummary(spreadsheetId: string, sheetName: string): Promise<{totalItems: number, checkedItems: number, items: {name: string, quantity: number}[]}> {
  const inventory = await getInventory(spreadsheetId, sheetName);
  let totalItems = 0;
  let checkedItems = 0;
  const itemMap = new Map<string, number>();

  inventory.forEach(row => {
    const qty = parseInt(row.quantity) || 0;
    totalItems += qty;
    const status = (row.status || '').trim().toLowerCase();
    if (status === 'checked' || status === 'ok' || status === 'yes') {
      checkedItems += qty;
    }
    if (row.item) {
      itemMap.set(row.item, (itemMap.get(row.item) || 0) + qty);
    }
  });

  const items = Array.from(itemMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  return { totalItems, checkedItems, items };
}

/**
 * Reads items and quantities from a Flat List sheet.
 */
export async function getClassLastRow(spreadsheetId: string, sheetName: string, className: string): Promise<number | null> {
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const range = `'${actualSheetName}'!A1:I`;
  const encodedRange = encodeURIComponent(range);
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  
  if (!data.values || data.values.length === 0) return null;

  const header = data.values[0] && isHeaderRow(data.values[0]) ? data.values[0] : undefined;
  const sheetFormat = detectSheetFormat(header, data.values.slice(1, 10));

  let currentClass = '';
  let lastRow: number | null = null;
  const targetNorm = className.replace(/\s+/g, ' ').trim().toLowerCase();

  for (let index = 0; index < data.values.length; index++) {
    const row = data.values[index];
    const rowNum = index + 1;
    
    if (isHeaderRow(row)) continue;

    if (sheetFormat === 'FormatA') {
      if (row[0] && String(row[0]).trim() !== '') {
        currentClass = String(row[0]).trim();
      }
      
      if (currentClass.replace(/\s+/g, ' ').trim().toLowerCase() === targetNorm) {
        lastRow = rowNum;
      } else if (lastRow !== null && currentClass !== '') {
        break;
      }
    } else {
      const rowLoc = (row[8] || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (rowLoc === targetNorm) {
        lastRow = rowNum;
      }
    }
  }

  return lastRow;
}

export async function getClassInventory(spreadsheetId: string, sheetName: string, className: string): Promise<SheetRow[]> {
  const allMap = await getAllClassesAndItems(spreadsheetId, sheetName);
  const targetNorm = className.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const [key, rows] of Object.entries(allMap)) {
    if (key.replace(/\s+/g, ' ').trim().toLowerCase() === targetNorm) {
      return rows;
    }
  }
  return [];
}

export async function getAllClassesAndItems(spreadsheetId: string, sheetName: string): Promise<Record<string, SheetRow[]>> {
  const data = await ensureStockSheetMigrated(spreadsheetId, sheetName);
  
  const result: Record<string, SheetRow[]> = {};
  if (!data.values || data.values.length === 0) return result;

  const header = data.values[0] && isHeaderRow(data.values[0]) ? data.values[0] : undefined;
  const sheetFormat = detectSheetFormat(header, data.values.slice(1, 10));

  let currentClass = '';
  for (let i = 0; i < data.values.length; i++) {
    const row = data.values[i];
    const rowNum = i + 1;
    if (isHeaderRow(row)) continue;

    if (sheetFormat === 'FormatA') {
      if (row[0] && String(row[0]).trim() !== '') {
        currentClass = String(row[0]).trim();
      }
      const cName = currentClass || (row[0] ? String(row[0]).trim() : '') || 'Uncategorized';
      const itemName = (row[1] || '').trim();
      if (cName && itemName) {
        if (!result[cName]) result[cName] = [];
        result[cName].push({
          row: rowNum,
          item: itemName,
          quantity: row[2] || '0',
          tag: row[3] || '',
          type: row[4] || '',
          hostname: row[5] || '',
          snid: row[6] || '',
          lastUpdated: row[7] || '',
          status: row[8] || '',
          location: cName,
        });
      }
    } else {
      const cName = (row[8] || '').trim() || 'Uncategorized';
      const itemName = (row[0] || '').trim();
      if (cName && itemName) {
        if (!result[cName]) result[cName] = [];
        result[cName].push({
          row: rowNum,
          item: itemName,
          quantity: row[1] || '0',
          tag: row[2] || '',
          type: row[3] || '',
          lastUpdated: row[4] || '',
          status: row[5] || '',
          hostname: row[6] || '',
          snid: row[7] || '',
          location: cName,
        });
      }
    }
  }

  return result;
}

/**
 * Updates multiple rows for a specific class in the list format.
 */
export async function updateClassInventory(spreadsheetId: string, sheetName: string, updates: SheetRow[]): Promise<void> {
  if (updates.length === 0) return;
  await updateInventory(spreadsheetId, sheetName, updates);
}

const classTemplateExistsCache = new Set<string>();

export async function ensureClassTemplateSheetExists(spreadsheetId: string): Promise<void> {
  if (classTemplateExistsCache.has(spreadsheetId)) return;
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const hasTemplate = meta.sheets.some(s => s.properties.title === 'Class_Template');
  if (hasTemplate) classTemplateExistsCache.add(spreadsheetId);
  
  if (!hasTemplate) {
    try {
      // Create the sheet
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: 'Class_Template'
              }
            }
          }]
        })
      });
      invalidateSpreadsheetMetadataCache(spreadsheetId);
      
      // Seed initial values
      const encodedTemplateRange = encodeURIComponent(`'Class_Template'!A1:C`);
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedTemplateRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({
          values: [
            ['Item Name', 'Default Tag', 'Default Type'],
            ['USB Mouse', 'Peripheral', ''],
            ['HDMI Cable (2m)', 'Cable', '2m'],
            ['Standard Keyboard', 'Peripheral', ''],
            ['DisplayPort Adaptor', 'Accessory', '']
          ]
        })
      });
    } catch (e: any) {
      if (!e.message?.includes('already exists') && !e.message?.includes('another name')) {
        throw e;
      }
    }
  }
}

export async function getClassTemplate(spreadsheetId: string): Promise<Array<{name: string, tag: string, type: string}>> {
  const range = `'Class_Template'!A2:C`;
  const encodedRange = encodeURIComponent(range);
  
  let data;
  try {
    data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  } catch (err: any) {
    if (err.status === 400 && err.message?.includes('Unable to parse range')) {
      return [
        { name: 'USB Mouse', tag: 'Peripheral', type: '' },
        { name: 'HDMI Cable (2m)', tag: 'Cable', type: '2m' },
        { name: 'Standard Keyboard', tag: 'Peripheral', type: '' },
        { name: 'DisplayPort Adaptor', tag: 'Accessory', type: '' }
      ];
    }
    throw err;
  }
  
  if (!data.values || data.values.length === 0) {
    return [
      { name: 'USB Mouse', tag: 'Peripheral', type: '' },
      { name: 'HDMI Cable (2m)', tag: 'Cable', type: '2m' },
      { name: 'Standard Keyboard', tag: 'Peripheral', type: '' },
      { name: 'DisplayPort Adaptor', tag: 'Accessory', type: '' }
    ];
  }
  
  const rows = data.values.filter((r: string[]) => !isHeaderRow(r));
  
  return rows.map((row: any[]) => ({
    name: row[0] || '',
    tag: row[1] || '',
    type: row[2] || '',
  })).filter((item: any) => item.name);
}


export async function formatStockColors(spreadsheetId: string, sheetId: number, sheetName: string): Promise<void> {
  await ensureStockSheetMigrated(spreadsheetId, sheetName);
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);
  return formatClassColors(spreadsheetId, actualSheetId, actualSheetName);
}
export async function formatClassColors(spreadsheetId: string, sheetId: number, sheetName: string): Promise<void> {
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);
  const range = `'${actualSheetName}'!A2:I`;
  const encodedRange = encodeURIComponent(range);
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  
  if (!data.values || data.values.length === 0) return;

  const headerData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I1`);
  const header = headerData.values?.[0];
  const isFormatA = detectSheetFormat(header, data.values) === 'FormatA';

  // Ensure Headers
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({
      values: isFormatA 
        ? [['Class Name', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status']]
        : [['Item Name', 'Quantity', 'Category', 'Type/Model', 'Last Updated', 'Status', 'Hostname', 'SNID', 'Location']]
    })
  });

  const classRanges: { className: string, startRowIndex: number, endRowIndex: number }[] = [];
  let currentClass = '';
  let startRowIndex = -1;

  for (let i = 0; i < data.values.length; i++) {
    const row = data.values[i];
    const cellVal = isFormatA ? (row[0] ? String(row[0]).trim() : '') : (row[8] ? String(row[8]).trim() : '');

    if (cellVal !== '') {
      if (currentClass === '' || cellVal.toLowerCase() !== currentClass.toLowerCase()) {
        if (currentClass !== '') {
          classRanges.push({ className: currentClass, startRowIndex, endRowIndex: i + 1 });
        }
        currentClass = cellVal;
        startRowIndex = i + 1; // +1 because A2 is rowIndex 1 (0-indexed)
      }
    }
  }
  
  if (currentClass !== '') {
    classRanges.push({ className: currentClass, startRowIndex, endRowIndex: data.values.length + 1 });
  }

  if (classRanges.length === 0) return;

  // For Format A: Clean up Column A so only the FIRST row of each class block contains the className
  if (isFormatA) {
    let needsColAUpdate = false;
    const colAValues: string[][] = [];

    for (let i = 0; i < data.values.length; i++) {
      const row = data.values[i];
      const rowIndexInSheets = i + 1; // rowIndex 1 corresponds to A2
      const rangeObj = classRanges.find(cr => rowIndexInSheets >= cr.startRowIndex && rowIndexInSheets < cr.endRowIndex);
      
      let expectedColA = '';
      if (rangeObj && rowIndexInSheets === rangeObj.startRowIndex) {
        expectedColA = rangeObj.className;
      }
      
      const actualColA = row[0] ? String(row[0]).trim() : '';
      if (actualColA !== expectedColA) {
        needsColAUpdate = true;
      }
      colAValues.push([expectedColA]);
    }

    if (needsColAUpdate) {
      const colARange = `'${actualSheetName}'!A2:A${1 + colAValues.length}`;
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(colARange)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          values: colAValues
        })
      });
    }
  }

  const colors = [
    { red: 0.94, green: 0.97, blue: 1.0, alpha: 1 }, // light blue
    { red: 0.95, green: 0.99, blue: 0.95, alpha: 1 }, // light green
    { red: 1.0, green: 0.97, blue: 0.94, alpha: 1 }, // light orange
    { red: 0.99, green: 0.95, blue: 0.96, alpha: 1 }, // light pink
    { red: 0.96, green: 0.95, blue: 0.99, alpha: 1 }, // light purple
    { red: 0.99, green: 0.99, blue: 0.93, alpha: 1 }, // light yellow
    { red: 0.94, green: 0.98, blue: 0.98, alpha: 1 }, // light cyan
    { red: 0.97, green: 0.95, blue: 0.93, alpha: 1 }, // light brown
  ];

  const headerFormatRequest = {
    repeatCell: {
      range: {
        sheetId: actualSheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 9
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.9, green: 0.9, blue: 0.9, alpha: 1 },
          textFormat: { bold: true }
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)'
    }
  };

  const requests = classRanges.flatMap((cr, idx) => ([
    {
      repeatCell: {
        range: {
          sheetId: actualSheetId,
          startRowIndex: cr.startRowIndex,
          endRowIndex: cr.endRowIndex,
          startColumnIndex: 0,
          endColumnIndex: 9 // Columns A to I
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: colors[idx % colors.length]
          }
        },
        fields: 'userEnteredFormat.backgroundColor'
      }
    },
    {
      updateBorders: {
        range: {
          sheetId: actualSheetId,
          startRowIndex: cr.startRowIndex,
          endRowIndex: cr.endRowIndex,
          startColumnIndex: 0,
          endColumnIndex: 9
        },
        top: { style: 'SOLID_MEDIUM', color: { red: 0, green: 0, blue: 0, alpha: 1 } },
        bottom: { style: 'SOLID_MEDIUM', color: { red: 0, green: 0, blue: 0, alpha: 1 } },
        left: { style: 'SOLID_MEDIUM', color: { red: 0, green: 0, blue: 0, alpha: 1 } },
        right: { style: 'SOLID_MEDIUM', color: { red: 0, green: 0, blue: 0, alpha: 1 } },
        innerHorizontal: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8, alpha: 1 } },
        innerVertical: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8, alpha: 1 } }
      }
    }
  ]));

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [headerFormatRequest, ...requests] })
  });
}

/**
 * Appends a new class block to the sheet.
 */
export async function addClassToInventory(spreadsheetId: string, sheetName: string, className: string): Promise<void> {
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  
  if (sheetName.toLowerCase().includes('stock')) {
    await ensureStockSheetMigrated(spreadsheetId, sheetName);
  }

  // Prevent Duplicates
  const existingClasses = await getClasses(spreadsheetId, sheetName);
  if (existingClasses.some(c => c.title.toLowerCase().trim() === className.toLowerCase().trim())) {
    throw new Error(`Location "${className}" already exists in this Google Sheet.`);
  }

  const fullData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I`);
  const header = fullData.values?.[0];
  const sampleRows = fullData.values?.slice(1, 10);
  const format = detectSheetFormat(header, sampleRows);
  let lastDataRow = 0;
  if (fullData.values) {
    for (let i = fullData.values.length - 1; i >= 0; i--) {
      if (fullData.values[i].some((cell) => String(cell).trim() !== '')) {
        lastDataRow = i + 1;
        break;
      }
    }
  }

  const templateItems = className.toLowerCase().startsWith("lab") ? await getLabTemplate(spreadsheetId) : await getClassTemplate(spreadsheetId);
  const range = `'${actualSheetName}'!A1:I`;
  const encodedRange = encodeURIComponent(range);
  const now = new Date().toLocaleString();
  
  let values: string[][];
  if (format === 'FormatA') {
    if (templateItems.length === 0) {
      values = [[className, 'New Item', '0', '', '', '', '', now, '']];
    } else {
      values = templateItems.map((item, index) => [
        index === 0 ? className : '',
        item.name,
        '0',
        item.tag || '',
        item.type || '',
        '',
        '',
        now,
        ''
      ]);
    }
  } else {
    // Format B: Col A=Item, Col B=Qty, Col C=Tag, Col D=Type, Col E=Timestamp, Col F=Status, Col G=Hostname, Col H=SNID, Col I=Location
    if (templateItems.length === 0) {
      values = [['New Item', '0', '', '', now, '', '', '', className]];
    } else {
      values = templateItems.map((item) => [
        item.name,
        '0',
        item.tag || '',
        item.type || '',
        now,
        '',
        '',
        '',
        className
      ]);
    }
  }
  
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheet = meta.sheets.find((s: any) => s.properties.title === actualSheetName);
  const actualSheetId = sheet?.properties.sheetId;
  const insertIndex = lastDataRow > 0 ? lastDataRow : 1;

  const cellRows = values.map(rowVals => ({
    values: rowVals.map(val => ({ userEnteredValue: { stringValue: val } }))
  }));

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: actualSheetId,
              dimension: 'ROWS',
              startIndex: insertIndex,
              endIndex: insertIndex + values.length
            },
            inheritFromBefore: true
          }
        },
        {
          updateCells: {
            rows: cellRows,
            fields: 'userEnteredValue',
            range: {
              sheetId: actualSheetId,
              startRowIndex: insertIndex,
              endRowIndex: insertIndex + values.length,
              startColumnIndex: 0,
              endColumnIndex: 9
            }
          }
        }
      ]
    })
  });
}

const itemMasterExistsCache = new Set<string>();

export async function ensureItemMasterSheetExists(spreadsheetId: string): Promise<void> {
  if (itemMasterExistsCache.has(spreadsheetId)) return;
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const hasItemMaster = meta.sheets.some(s => s.properties.title === 'Item Master');
  if (hasItemMaster) itemMasterExistsCache.add(spreadsheetId);
  
  if (!hasItemMaster) {
    try {
      // Create the sheet
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: 'Item Master'
              }
            }
          }]
        })
      });
      invalidateSpreadsheetMetadataCache(spreadsheetId);
      
      // Seed initial values
      const encodedMasterRange = encodeURIComponent(`'Item Master'!A1:A`);
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedMasterRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({
          values: [
            ['Item Name'],
            ['USB Mouse'],
            ['HDMI Cable (2m)'],
            ['Standard Keyboard'],
            ['DisplayPort Adaptor'],
            ['Projector Remote'],
            ['Ethernet Cable'],
          ]
        })
      });
    } catch (e: any) {
      if (!e.message?.includes('already exists') && !e.message?.includes('another name')) {
        throw e;
      }
    }
  }
}

/**
 * Fetches the item master list from the spreadsheet.
 * Assumes Column A contains the item names.
 */
export async function getMasterItems(spreadsheetId: string, sheetName: string): Promise<string[]> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheet = meta.sheets.find((s: any) => s.properties.title === sheetName);
  if (!sheet) return [];
  
  const range = `'${sheet.properties.title}'!A2:A`;
  const encodedRange = encodeURIComponent(range);
  
  let data;
  try {
    data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  } catch (err: any) {
    if (err.status === 400 && err.message?.includes('Unable to parse range')) {
      return [];
    }
    throw err;
  }
  
  if (!data.values) return [];
  const rows = data.values.filter((r: string[]) => !isHeaderRow(r));
  
  const items = rows.map((row: string[]) => row[0]).filter(Boolean).map(i => String(i).trim());
  return Array.from(new Set(items));
}

/**
 * Inserts a new item into a specific class.
 */
export async function addItemToClass(
  spreadsheetId: string, 
  sheetId: number, 
  sheetName: string, 
  className: string, 
  itemName: string,
  afterRowIndex: number, // 1-indexed row index to insert after
  quantity: string = '0',
  tag: string = '',
  type: string = '',
  hostname: string = '',
  snid: string = ''
): Promise<void> {
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);
  const insertIndex = afterRowIndex;

  const fullData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I`);
  const header = fullData.values?.[0];
  const sampleRows = fullData.values?.slice(1, 10);
  const format = detectSheetFormat(header, sampleRows);
  let lastDataRow = 0;
  if (fullData.values) {
    for (let i = fullData.values.length - 1; i >= 0; i--) {
      if (fullData.values[i].some((cell) => String(cell).trim() !== '')) {
        lastDataRow = i + 1;
        break;
      }
    }
  }

  const now = new Date().toLocaleString();
  let rowValues: string[];
  if (format === 'FormatA') {
    rowValues = ['', itemName, quantity, tag, type, hostname, snid, now, ''];
  } else {
    // Format B: Col A=Item, Col B=Qty, Col C=Tag, Col D=Type, Col E=Timestamp, Col F=Status, Col G=Hostname, Col H=SNID, Col I=Location
    rowValues = [itemName, quantity, tag, type, now, '', hostname, snid, className];
  }

  const cellValues = rowValues.map(val => ({ userEnteredValue: { stringValue: val } }));

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: actualSheetId,
              dimension: 'ROWS',
              startIndex: insertIndex,
              endIndex: insertIndex + 1
            },
            inheritFromBefore: true
          }
        },
        {
          updateCells: {
            rows: [
              {
                values: cellValues
              }
            ],
            fields: 'userEnteredValue',
            start: {
              sheetId: actualSheetId,
              rowIndex: insertIndex,
              columnIndex: 0
            }
          }
        },
        {
          updateBorders: {
            range: {
              sheetId: actualSheetId,
              startRowIndex: insertIndex - 1,
              endRowIndex: insertIndex,
              startColumnIndex: 0,
              endColumnIndex: 9
            },
            bottom: {
              style: 'SOLID',
              color: { red: 0.8, green: 0.8, blue: 0.8, alpha: 1 }
            }
          }
        }
      ]
    })
  });

  await formatClassColors(spreadsheetId, actualSheetId, actualSheetName);
}

/**
 * Creates a new spreadsheet with the given title and optional sheets.
 */
export async function createSpreadsheet(title: string, sheetTitles?: string[]): Promise<SheetMetadata> {
  const body: any = {
    properties: {
      title
    }
  };
  
  if (sheetTitles && sheetTitles.length > 0) {
    body.sheets = sheetTitles.map(t => ({ properties: { title: t } }));
  }

  return fetchWithRetry('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Creates starter sheets for the user.
 */
export async function createStarterSheets(): Promise<{ stockSheetId: string, classesSheetId: string }> {
  // Create Stock Room Sheet
  const stockMeta = await createSpreadsheet('Quick Stock: Stock Room', ['Stock Room']);
  const stockTabTitle = stockMeta.sheets?.[0]?.properties?.title || 'Sheet1';
  
  // Add initial headers and data to Stock Room
  const encodedStockRange = encodeURIComponent(`'${stockTabTitle}'!A1:I`);
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${stockMeta.spreadsheetId}/values/${encodedStockRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({
      values: [
        ['Item Name', 'Quantity', 'Category', 'Type/Model', 'Last Updated', 'Status', 'Hostname', 'SNID', 'Location'],
        ['Dell XPS 15', '24', 'Computer', 'XPS 9520', '', 'Checked', 'DEV-XPS-01', 'SNID-001', 'Stock 1F'],
        ['Logitech MX Master', '12', 'Peripheral', 'MX Master 3S', '', '', '', '', 'Stock 1F'],
        ['USB-C Hub (7-in-1)', '45', 'Accessory', 'Anker 341', '', '', '', '', 'Stock 2F'],
        ['Standard Keyboard', '30', 'Peripheral', 'Logitech K120', '', '', '', '', 'Stock 2F'],
        ['HDMI Cable (2m)', '50', 'Cable', 'AmazonBasics', '', '', '', '', 'Stock 3F']
      ]
    })
  });

  // Create Classes Sheet using Flat Format
  const classesMeta = await createSpreadsheet('Quick Stock: Classes List', ['Classes', 'Item Master']);
  const classesTabTitle = classesMeta.sheets?.[0]?.properties?.title || 'Classes';
  const masterTabTitle = classesMeta.sheets?.[1]?.properties?.title || 'Item Master';
  
  // Add initial headers (Classes as rows)
  const encodedClassesRange = encodeURIComponent(`'${classesTabTitle}'!A1:I`);
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${classesMeta.spreadsheetId}/values/${encodedClassesRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({
      values: [
        ['Class Name', 'Item Name', 'Quantity', 'Category', 'Type/Model', 'Hostname', 'SNID', 'Last Updated', 'Status'],
        ['Lab 302', 'USB Mouse', '8', 'Peripheral', 'Logitech M100', '', '', '', ''],
        ['', 'HDMI Cable (2m)', '4', 'Cable', '', '', '', '', ''],
        ['', 'Standard Keyboard', '12', 'Peripheral', 'Dell KB216', '', '', '', 'Checked'],
        ['', 'DisplayPort Adaptor', '3', 'Accessory', '', '', '', '', ''],
        ['Conference Room A', 'HDMI Cable (2m)', '1', 'Cable', '', '', '', '', ''],
        ['', 'Standard Keyboard', '5', 'Peripheral', 'Dell KB216', '', '', '', ''],
        ['Office 101', 'Standard Keyboard', '2', 'Peripheral', 'Dell KB216', '', '', '', '']
      ]
    })
  });

  const encodedMasterRange = encodeURIComponent(`'${masterTabTitle}'!A1:A`);
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${classesMeta.spreadsheetId}/values/${encodedMasterRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({
      values: [
        ['Item Name'],
        ['USB Mouse'],
        ['HDMI Cable (2m)'],
        ['Standard Keyboard'],
        ['DisplayPort Adaptor'],
        ['Projector Remote'],
        ['Ethernet Cable'],
      ]
    })
  });

  return {
    stockSheetId: stockMeta.spreadsheetId,
    classesSheetId: classesMeta.spreadsheetId
  };
}

export async function addTemplateItemsToClass(
  spreadsheetId: string, 
  sheetId: number, 
  sheetName: string, 
  className: string
): Promise<void> {
  const templateItems = await getClassTemplate(spreadsheetId);
  if (templateItems.length === 0) return;
  
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);

  const fullData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:I`);
  
  let lastDataRow = 0;
  if (fullData.values) {
    for (let i = fullData.values.length - 1; i >= 0; i--) {
      if (fullData.values[i].some((cell: any) => String(cell).trim() !== '')) {
        lastDataRow = i + 1;
        break;
      }
    }
  }

  const insertIndex = lastDataRow > 0 ? lastDataRow : 1;
  const now = new Date().toLocaleString();
  
  const requests: any[] = [
    {
      insertDimension: {
        range: {
          sheetId: actualSheetId,
          dimension: 'ROWS',
          startIndex: insertIndex,
          endIndex: insertIndex + templateItems.length
        },
        inheritFromBefore: insertIndex > 1
      }
    },
    {
      updateCells: {
        rows: templateItems.map(item => ({
          values: [
            { userEnteredValue: { stringValue: '' } }, // Index 0 (Col A): Empty for sub-items
            { userEnteredValue: { stringValue: item.name } }, // Index 1 (Col B): Item Name
            { userEnteredValue: { stringValue: '0' } }, // Index 2 (Col C): Qty
            { userEnteredValue: { stringValue: item.tag || '' } }, // Col D: Tag
            { userEnteredValue: { stringValue: item.type || '' } }, // Col E: Type
            { userEnteredValue: { stringValue: '' } }, // Col F: Hostname
            { userEnteredValue: { stringValue: '' } }, // Col G: SNID
            { userEnteredValue: { stringValue: now } }, // Col H: Last Updated
            { userEnteredValue: { stringValue: '' } }  // Col I: Status
          ]
        })),
        fields: 'userEnteredValue',
        start: {
          sheetId: actualSheetId,
          rowIndex: insertIndex,
          columnIndex: 0
        }
      }
    }
  ];

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests })
  });
}

export async function getLabTemplate(spreadsheetId: string): Promise<Array<{name: string, tag: string, type: string}>> {
  const range = `'Lab_Template'!A2:C`;
  const encodedRange = encodeURIComponent(range);
  
  let data;
  try {
    data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  } catch (err: any) {
    if (err.status === 400 && err.message?.includes('Unable to parse range')) {
      return [
        { name: 'Lab Desktop', tag: 'Computer', type: 'OptiPlex 7000' },
        { name: 'Lab Monitor', tag: 'Peripheral', type: '24" Dell' },
        { name: 'Ethernet Switch', tag: 'Accessory', type: '8-port' }
      ];
    }
    throw err;
  }
  
  if (!data.values || data.values.length === 0) {
    return [
      { name: 'Lab Desktop', tag: 'Computer', type: 'OptiPlex 7000' },
      { name: 'Lab Monitor', tag: 'Peripheral', type: '24" Dell' },
      { name: 'Ethernet Switch', tag: 'Accessory', type: '8-port' }
    ];
  }
  
  const rows = data.values.filter((r: string[]) => !isHeaderRow(r));
  
  return rows.map((row: any[]) => ({
    name: row[0] || '',
    tag: row[1] || '',
    type: row[2] || '',
  })).filter((item: any) => item.name);
}

export async function addLabTemplateItemsToClass(
  spreadsheetId: string, 
  sheetId: number, 
  sheetName: string, 
  className: string
): Promise<void> {
  const templateItems = await getLabTemplate(spreadsheetId);
  if (templateItems.length === 0) return;
  
  const actualSheetName = await resolveSheetName(spreadsheetId, sheetName);
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, actualSheetName, sheetId);

  const lastRow = await getClassLastRow(spreadsheetId, actualSheetName, className);
  if (lastRow === null) return;
  
  const insertIndex = lastRow;
  const now = new Date().toLocaleString();
  
  const requests: any[] = [
    {
      insertDimension: {
        range: {
          sheetId: actualSheetId,
          dimension: 'ROWS',
          startIndex: insertIndex,
          endIndex: insertIndex + templateItems.length
        },
        inheritFromBefore: true
      }
    },
    {
      updateCells: {
        rows: templateItems.map((item: any) => ({
          values: [
            { userEnteredValue: { stringValue: '' } },
            { userEnteredValue: { stringValue: item.name } },
            { userEnteredValue: { stringValue: '0' } },
            { userEnteredValue: { stringValue: item.tag || '' } },
            { userEnteredValue: { stringValue: item.type || '' } },
            { userEnteredValue: { stringValue: '' } },
            { userEnteredValue: { stringValue: '' } },
            { userEnteredValue: { stringValue: now } },
            { userEnteredValue: { stringValue: '' } }
          ]
        })),
        fields: 'userEnteredValue',
        start: {
          sheetId: actualSheetId,
          rowIndex: insertIndex,
          columnIndex: 0
        }
      }
    }
  ];

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests })
  });
}

export async function duplicateItemInClass(
  spreadsheetId: string, 
  sheetId: number, 
  item: SheetRow,
  sheetName?: string
): Promise<void> {
  const actualSheetId = await resolveSheetNumericalId(spreadsheetId, sheetName || '', sheetId);
  const insertIndex = item.row; // item.row is 1-indexed, so inserting at item.row puts it right after the current item
  
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: actualSheetId,
              dimension: 'ROWS',
              startIndex: insertIndex,
              endIndex: insertIndex + 1
            },
            inheritFromBefore: true
          }
        },
        {
          updateCells: {
            rows: [
              {
                values: [
                  { userEnteredValue: { stringValue: '' } }, // Index 0 (Col A): Empty for duplicate sub-items
                  { userEnteredValue: { stringValue: item.item || '' } }, // Index 1
                  { userEnteredValue: { stringValue: item.quantity || '0' } }, // Index 2
                  { userEnteredValue: { stringValue: item.tag || '' } }, // Index 3
                  { userEnteredValue: { stringValue: item.type || '' } }, // Index 4
                  { userEnteredValue: { stringValue: item.hostname || '' } }, // Index 5
                  { userEnteredValue: { stringValue: item.snid || '' } }, // Index 6
                  { userEnteredValue: { stringValue: new Date().toLocaleString() } }, // Index 7
                  { userEnteredValue: { stringValue: item.status || '' } } // Index 8
                ]
              }
            ],
            fields: 'userEnteredValue',
            start: {
              sheetId: actualSheetId,
              rowIndex: insertIndex,
              columnIndex: 0
            }
          }
        }
      ]
    })
  });

  const actualSheetName = sheetName ? await resolveSheetName(spreadsheetId, sheetName) : '';
  if (actualSheetName) {
    await formatClassColors(spreadsheetId, actualSheetId, actualSheetName);
  }
}

export async function moveItemToClassOrStock(
  spreadsheetId: string,
  sourceSheetId: number,
  sourceTabName: string,
  sourceClassName: string,
  item: SheetRow,
  targetTabName: string,
  targetClassName: string,
  moveQuantity?: string
): Promise<void> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sourceSheet = meta.sheets.find(s => s.properties.title.toLowerCase() === sourceTabName.toLowerCase());
  const targetSheet = meta.sheets.find(s => s.properties.title.toLowerCase() === targetTabName.toLowerCase());
  if (!sourceSheet || !targetSheet) throw new Error('Source or destination sheet was not found.');
  if (sourceSheet.properties.sheetId === targetSheet.properties.sheetId && sourceClassName.trim().toLowerCase() === targetClassName.trim().toLowerCase()) return;
  const current = (await getClassInventory(spreadsheetId, sourceTabName, sourceClassName)).find(r => r.row === item.row);
  if (!current || ['item', 'quantity', 'tag', 'type', 'hostname', 'snid', 'status'].some(key => (current[key] || '') !== (item[key] || ''))) {
    throw new Error('This item changed. Refresh before moving it.');
  }
  const quantity = Number(moveQuantity || current.quantity || '1');
  const available = Number(current.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > available) throw new Error('Move quantity must be positive and no greater than the available quantity.');
  const targetName = targetSheet.properties.title;
  await ensureStockSheetMigrated(spreadsheetId, targetName);
  let insertIndex = await getClassLastRow(spreadsheetId, targetName, targetClassName);
  const now = new Date().toLocaleString();
  const targetRows: string[][] = [];
  if (insertIndex === null) {
    const range = encodeURIComponent(`'${targetName.replace(/'/g, "''")}'!A1:I`);
    const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
    insertIndex = Math.max(1, data.values?.length || 0);
    const defaults = targetClassName.toLowerCase().startsWith('lab') ? await getLabTemplate(spreadsheetId) : await getClassTemplate(spreadsheetId);
    for (const entry of defaults) targetRows.push([targetRows.length ? '' : targetClassName, entry.name, '0', entry.tag || '', entry.type || '', '', '', now, '']);
  }
  targetRows.push([targetRows.length ? '' : targetClassName, current.item, String(quantity), current.tag || '', current.type || '', current.hostname || '', current.snid || '', now, current.status || '']);
  // Both sides commit in one Google Sheets batch. Keep the source's location cell
  // when removing its last item so grouped rows retain their classroom/location.
  const sourceValues = quantity === available ? ['', '', '', '', '', '', now, ''] : [current.item, String(available - quantity), current.tag || '', current.type || '', current.hostname || '', current.snid || '', now, current.status || ''];
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [
      { updateCells: { start: { sheetId: sourceSheet.properties.sheetId, rowIndex: current.row - 1, columnIndex: 1 }, rows: [{ values: sourceValues.map(stringValue => ({ userEnteredValue: { stringValue } })) }], fields: 'userEnteredValue' } },
      { insertDimension: { range: { sheetId: targetSheet.properties.sheetId, dimension: 'ROWS', startIndex: insertIndex, endIndex: insertIndex + targetRows.length }, inheritFromBefore: true } },
      { updateCells: { start: { sheetId: targetSheet.properties.sheetId, rowIndex: insertIndex, columnIndex: 0 }, rows: targetRows.map(row => ({ values: row.map(stringValue => ({ userEnteredValue: { stringValue } })) })), fields: 'userEnteredValue' } },
    ] }),
  });
  // Cosmetic updates must not turn a committed movement into a failed operation.
  await Promise.all([
    formatClassColors(spreadsheetId, sourceSheet.properties.sheetId, sourceTabName).catch(() => {}),
    formatClassColors(spreadsheetId, targetSheet.properties.sheetId, targetName).catch(() => {}),
  ]);
}


export async function addMasterItem(spreadsheetId: string, itemName: string): Promise<void> {
  await ensureItemMasterSheetExists(spreadsheetId);
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheet = meta.sheets.find((s: any) => s.properties.title === 'Item Master');
  const actualSheetName = sheet ? sheet.properties.title : 'Item Master';
  const actualSheetId = sheet ? sheet.properties.sheetId : 0;
  
  const fullData = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${actualSheetName}'!A1:A`);
  
  let lastDataRow = 0;
  if (fullData.values) {
    for (let i = fullData.values.length - 1; i >= 0; i--) {
      if (fullData.values[i].some((cell: any) => String(cell).trim() !== '')) {
        lastDataRow = i + 1;
        break;
      }
    }
  }

  const insertIndex = lastDataRow > 0 ? lastDataRow : 1;

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: actualSheetId,
              dimension: 'ROWS',
              startIndex: insertIndex,
              endIndex: insertIndex + 1
            },
            inheritFromBefore: insertIndex > 1
          }
        },
        {
          updateCells: {
            rows: [
              {
                values: [
                  { userEnteredValue: { stringValue: itemName } }
                ]
              }
            ],
            fields: 'userEnteredValue',
            start: {
              sheetId: actualSheetId,
              rowIndex: insertIndex,
              columnIndex: 0
            }
          }
        }
      ]
    })
  });
}

export async function removeMasterItem(spreadsheetId: string, itemName: string): Promise<void> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheet = meta.sheets.find(s => s.properties.title === 'Item Master');
  if (!sheet) return;
  const actualSheetName = sheet.properties.title;
  const actualSheetId = sheet.properties.sheetId;
  
  const encodedRange = encodeURIComponent(`'${actualSheetName}'`);
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  
  if (!data.values) return;
  
  const rowIndex = data.values.findIndex((row: string[]) => row[0]?.trim() === itemName.trim());
  if (rowIndex === -1) return;
  
  await deleteRows(spreadsheetId, actualSheetId, actualSheetName, [rowIndex + 1]);
}

export interface DashboardSummary {
  classes: {
    totalItems: number;
    checkedItems: number;
  };
  stock: {
    totalItems: number;
    checkedItems: number;
  };
  items: { name: string, quantity: number, inStock: number, inClasses: number, tag: string, type: string }[];
  tags: { name: string, quantity: number }[];
  missingTemplateAlerts: { room: string, template: 'class' | 'lab', missingItems: string[] }[];
  templateAlertsError: boolean;
}

export async function getDashboardSummary(spreadsheetId: string): Promise<DashboardSummary> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  
  const classesSheet = meta.sheets.find((s: any) => ['class', 'classes'].includes(s.properties.title.toLowerCase())) || meta.sheets[0];
  const stockSheet = meta.sheets.find((s: any) => s.properties.title.toLowerCase() === 'stock room');

  const classesTabName = classesSheet?.properties?.title || 'Sheet1';
  const stockTabName = stockSheet?.properties?.title;

  const result: DashboardSummary = {
    classes: { totalItems: 0, checkedItems: 0 },
    stock: { totalItems: 0, checkedItems: 0 },
    items: [],
    tags: [],
    missingTemplateAlerts: [],
    templateAlertsError: false,
  };

  const itemMap = new Map<string, { quantity: number, inStock: number, inClasses: number, tag: string, type: string }>();
  const tagMap = new Map<string, number>();

  const readSavedTemplate = async (name: 'Class_Template' | 'Lab_Template'): Promise<string[]> => {
    if (!meta.sheets.some(sheet => sheet.properties.title === name)) return [];
    const range = encodeURIComponent(`'${name}'!A2:C`);
    const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
    return (data.values || [])
      .filter((row: string[]) => !isHeaderRow(row))
      .map((row: string[]) => String(row[0] || '').trim())
      .filter(Boolean);
  };

  const [classesMap, stockMap, classTemplateResult, labTemplateResult] = await Promise.all([
    getAllClassesAndItems(spreadsheetId, classesTabName).catch((error) => {
      console.error('Failed to load classes data for dashboard', error);
      return {} as Record<string, SheetRow[]>;
    }),
    stockTabName
      ? getAllClassesAndItems(spreadsheetId, stockTabName).catch((error) => {
          console.error('Failed to load stock room data for dashboard', error);
          return {} as Record<string, SheetRow[]>;
        })
      : Promise.resolve({} as Record<string, SheetRow[]>),
    readSavedTemplate('Class_Template').then(items => ({ items, error: false })).catch(error => {
      console.error('Failed to load class defaults for dashboard', error);
      return { items: [] as string[], error: true };
    }),
    readSavedTemplate('Lab_Template').then(items => ({ items, error: false })).catch(error => {
      console.error('Failed to load lab defaults for dashboard', error);
      return { items: [] as string[], error: true };
    }),
  ]);

  result.templateAlertsError = classTemplateResult.error || labTemplateResult.error;
  const normalizeItem = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  for (const [room, rows] of Object.entries(classesMap)) {
    if (room === 'Uncategorized') continue;
    const isLab = room.trim().toLocaleLowerCase().startsWith('lab');
    const template = isLab ? labTemplateResult : classTemplateResult;
    if (template.error || template.items.length === 0) continue;
    const present = new Set(rows.filter(row => !row._isDeleted).map(row => normalizeItem(row.item)));
    const missingItems = [...new Map(template.items.map(item => [normalizeItem(item), item])).entries()]
      .filter(([key]) => !present.has(key))
      .map(([, label]) => label);
    if (missingItems.length) result.missingTemplateAlerts.push({ room, template: isLab ? 'lab' : 'class', missingItems });
  }
  result.missingTemplateAlerts.sort((a, b) => b.missingItems.length - a.missingItems.length || a.room.localeCompare(b.room));

  // Fetch Classes
  for (const [_, rows] of Object.entries(classesMap)) {
    rows.forEach((row) => {
      const itemName = row.item ? row.item.trim() : '';
      if (itemName) {
        const quantity = parseInt(row.quantity) || 0;
        const tag = row.tag ? row.tag.trim() : 'Uncategorized';
        const type = row.type ? row.type.trim() : '';

        result.classes.totalItems += quantity;
        const status = row.status ? row.status.trim().toLowerCase() : '';
        if (status === 'checked' || status === 'ok' || status === 'yes') result.classes.checkedItems += quantity;

        const existing = itemMap.get(itemName) || { quantity: 0, inStock: 0, inClasses: 0, tag, type };
        existing.quantity += quantity;
        existing.inClasses += quantity;
        itemMap.set(itemName, existing);

        tagMap.set(tag, (tagMap.get(tag) || 0) + quantity);
      }
    });
  }

  // Fetch Stock Room
  if (stockTabName) {
    for (const [_, rows] of Object.entries(stockMap)) {
      rows.forEach((row) => {
        const itemName = row.item ? row.item.trim() : '';
        if (itemName) {
          const quantity = parseInt(row.quantity) || 0;
          const tag = row.tag ? row.tag.trim() : 'Uncategorized';
          const type = row.type ? row.type.trim() : '';

          result.stock.totalItems += quantity;
          const status = row.status ? row.status.trim().toLowerCase() : '';
          if (status === 'checked' || status === 'ok' || status === 'yes') result.stock.checkedItems += quantity;

          const existing = itemMap.get(itemName) || { quantity: 0, inStock: 0, inClasses: 0, tag, type };
          existing.quantity += quantity;
          existing.inStock += quantity;
          itemMap.set(itemName, existing);

          tagMap.set(tag, (tagMap.get(tag) || 0) + quantity);
        }
      });
    }
  }

  result.items = Array.from(itemMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity);
    
  result.tags = Array.from(tagMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  return result;
}


export async function ensureLabTemplateSheetExists(spreadsheetId: string): Promise<void> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const exists = meta.sheets.some((s: any) => s.properties.title === 'Lab Default Template');
  if (exists) return;

  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: 'Lab Default Template',
              gridProperties: {
                rowCount: 100,
                columnCount: 9
              }
            }
          }
        }
      ]
    })
  });

  const newMeta = await getSpreadsheetMetadata(spreadsheetId);
  const newSheet = newMeta.sheets.find((s: any) => s.properties.title === 'Lab Default Template');
  if (newSheet) {
    const sheetId = newSheet.properties.sheetId;
    await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateCells: {
              rows: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Item Name' } },
                    { userEnteredValue: { stringValue: 'Tag' } },
                    { userEnteredValue: { stringValue: 'Type' } }
                  ]
                }
              ],
              fields: 'userEnteredValue',
              start: {
                sheetId,
                rowIndex: 0,
                columnIndex: 0
              }
            }
          }
        ]
      })
    });
  }
}
