import { fetchWithRetry, getSpreadsheetMetadata } from './sheets';

export interface CustomDropdowns {
  tags: string[];
  typesByTag: Record<string, string[]>;
}

const dropdownsSheetExistsCache = new Set<string>();

export async function ensureDropdownsSheetExists(spreadsheetId: string): Promise<void> {
  if (dropdownsSheetExistsCache.has(spreadsheetId)) return;
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const hasDropdowns = meta.sheets.some(s => s.properties.title === 'Dropdowns');
  if (hasDropdowns) dropdownsSheetExistsCache.add(spreadsheetId);
  
  if (!hasDropdowns) {
    // Create the sheet
    try {
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: 'Dropdowns'
              }
            }
          }]
        })
      });
      
      // Seed headers
      const encodedRange = encodeURIComponent(`'Dropdowns'!A1:C1`);
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [
            ['Category', 'Value', 'Parent Tag']
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

export async function getCustomDropdowns(spreadsheetId: string): Promise<CustomDropdowns> {
  await ensureDropdownsSheetExists(spreadsheetId);
  
  const encodedRange = encodeURIComponent(`'Dropdowns'!A2:C`);
  const data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
  
  const result: CustomDropdowns = {
    tags: [],
    typesByTag: {}
  };
  
  if (data.values) {
    data.values.forEach((row: string[]) => {
      const category = row[0];
      const value = row[1];
      const parent = row[2];
      
      if (category === 'Tag' && value) {
        if (!result.tags.includes(value)) {
          result.tags.push(value);
        }
      } else if (category === 'Type' && value && parent) {
        if (!result.typesByTag[parent]) {
          result.typesByTag[parent] = [];
        }
        if (!result.typesByTag[parent].includes(value)) {
          result.typesByTag[parent].push(value);
        }
      }
    });
  }
  
  return result;
}

export async function addCustomTag(spreadsheetId: string, tag: string): Promise<void> {
  const encodedRange = encodeURIComponent(`'Dropdowns'!A1:C`);
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({
      values: [
        ['Tag', tag, '']
      ]
    })
  });
}

export async function addCustomType(spreadsheetId: string, tag: string, type: string): Promise<void> {
  const encodedRange = encodeURIComponent(`'Dropdowns'!A1:C`);
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({
      values: [
        ['Type', type, tag]
      ]
    })
  });
}

export async function updateAllDropdowns(spreadsheetId: string, dropdowns: CustomDropdowns): Promise<void> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheet = meta.sheets.find(s => s.properties.title === 'Dropdowns');
  if (!sheet) return;

  const rows = [['Category', 'Value', 'Parent Tag']];
  dropdowns.tags.forEach(tag => {
    rows.push(['Tag', tag, '']);
  });
  Object.entries(dropdowns.typesByTag).forEach(([tag, types]) => {
    types.forEach(type => {
      rows.push(['Type', type, tag]);
    });
  });

  // Clear existing
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Dropdowns!A:C:clear`, {
    method: 'POST'
  });

  // Write new
  await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Dropdowns!A1:C?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({
      values: rows
    })
  });
}

export async function getMergedCustomDropdowns(): Promise<CustomDropdowns> {
  const classesId = localStorage.getItem('quickStock_classesSheetId');
  const stockId = localStorage.getItem('quickStock_classesSheetId');
  
  const merged: CustomDropdowns = { tags: [], typesByTag: {} };
  
  const process = (data: CustomDropdowns) => {
    data.tags.forEach(t => { if (!merged.tags.includes(t)) merged.tags.push(t); });
    Object.entries(data.typesByTag).forEach(([tag, types]) => {
      if (!merged.typesByTag[tag]) merged.typesByTag[tag] = [];
      types.forEach(type => {
        if (!merged.typesByTag[tag].includes(type)) merged.typesByTag[tag].push(type);
      });
    });
  };

  if (classesId) {
    try { process(await getCustomDropdowns(classesId)); } catch (e) {}
  }
  if (stockId && stockId !== classesId) {
    try { process(await getCustomDropdowns(stockId)); } catch (e) {}
  }
  return merged;
}

export async function addMergedCustomTag(tag: string): Promise<void> {
  const classesId = localStorage.getItem('quickStock_classesSheetId');
  const stockId = localStorage.getItem('quickStock_classesSheetId');
  if (classesId) await addCustomTag(classesId, tag).catch(() => {});
  if (stockId && stockId !== classesId) await addCustomTag(stockId, tag).catch(() => {});
}

export async function addMergedCustomType(tag: string, type: string): Promise<void> {
  const classesId = localStorage.getItem('quickStock_classesSheetId');
  const stockId = localStorage.getItem('quickStock_classesSheetId');
  if (classesId) await addCustomType(classesId, tag, type).catch(() => {});
  if (stockId && stockId !== classesId) await addCustomType(stockId, tag, type).catch(() => {});
}

export async function updateMergedAllDropdowns(dropdowns: CustomDropdowns): Promise<void> {
  const classesId = localStorage.getItem('quickStock_classesSheetId');
  const stockId = localStorage.getItem('quickStock_classesSheetId');
  if (classesId) await updateAllDropdowns(classesId, dropdowns);
  if (stockId && stockId !== classesId) await updateAllDropdowns(stockId, dropdowns);
}
