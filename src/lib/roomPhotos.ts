import { fetchWithRetry, getSpreadsheetMetadata, invalidateSpreadsheetMetadataCache } from './sheets';

const PHOTO_TAB = 'Room_Photos';
const photoRange = (range: string) => encodeURIComponent(`'${PHOTO_TAB}'!${range}`);
const valuesUrl = (sheetId: string, range: string) => `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${photoRange(range)}`;

async function findRoomRow(sheetId: string, room: string): Promise<number | null> {
  const data = await fetchWithRetry(valuesUrl(sheetId, 'A2:A'));
  const index = (data.values || []).findIndex((row: string[]) => String(row[0] || '').trim().toLocaleLowerCase() === room.trim().toLocaleLowerCase());
  return index < 0 ? null : index + 2;
}

export async function getRoomPhoto(sheetId: string, room: string): Promise<string | null> {
  const meta = await getSpreadsheetMetadata(sheetId);
  if (!meta.sheets.some(sheet => sheet.properties.title === PHOTO_TAB)) return null;
  const row = await findRoomRow(sheetId, room);
  if (row === null) return null;
  const data = await fetchWithRetry(valuesUrl(sheetId, `B${row}`));
  const photo = String(data.values?.[0]?.[0] || '');
  return photo.startsWith('data:image/jpeg;base64,') ? photo : null;
}

export async function getRoomPhotos(sheetId: string): Promise<Record<string, string>> {
  const meta = await getSpreadsheetMetadata(sheetId);
  if (!meta.sheets.some(sheet => sheet.properties.title === PHOTO_TAB)) return {};
  const data = await fetchWithRetry(valuesUrl(sheetId, 'A2:B'));
  return Object.fromEntries((data.values || [])
    .filter((row: string[]) => String(row[1] || '').startsWith('data:image/jpeg;base64,'))
    .map((row: string[]) => [String(row[0] || '').trim().toLocaleLowerCase(), String(row[1])]));
}

export async function saveRoomPhoto(sheetId: string, room: string, photo: string): Promise<void> {
  if (!photo.startsWith('data:image/jpeg;base64,') || photo.length > 45000) {
    throw new Error('The room photo is too large to save.');
  }
  const meta = await getSpreadsheetMetadata(sheetId);
  if (!meta.sheets.some(sheet => sheet.properties.title === PHOTO_TAB)) {
    await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: PHOTO_TAB, hidden: true, gridProperties: { rowCount: 100, columnCount: 2 } } } }] }),
    });
    invalidateSpreadsheetMetadataCache(sheetId);
    await fetchWithRetry(`${valuesUrl(sheetId, 'A1:B1')}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [['Room', 'Photo']] }),
    });
  }
  const row = await findRoomRow(sheetId, room);
  if (row !== null) {
    await fetchWithRetry(`${valuesUrl(sheetId, `A${row}:B${row}`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [[room, photo]] }),
    });
  } else {
    await fetchWithRetry(`${valuesUrl(sheetId, 'A:B')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: [[room, photo]] }),
    });
  }
}

export async function compressRoomPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photo.');
    for (const edge of [640, 512, 420, 320, 240]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.72, 0.58, 0.44]) {
        const photo = canvas.toDataURL('image/jpeg', quality);
        if (photo.length <= 45000) return photo;
      }
    }
    throw new Error('This photo could not be compressed enough. Try a simpler image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
