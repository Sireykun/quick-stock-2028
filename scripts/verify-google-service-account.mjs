import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';

const path = process.argv[2];
const spreadsheetId = process.argv[3];
if (!path || !spreadsheetId) {
  console.error('Usage: node scripts/verify-google-service-account.mjs <key.json> <spreadsheet-id>');
  process.exit(1);
}

const key = JSON.parse(await readFile(path, 'utf8'));
if (key.type !== 'service_account' || !key.client_email || !key.private_key) {
  throw new Error('This is not a Google service account JSON key.');
}
const now = Math.floor(Date.now() / 1000);
const base64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
  iss: key.client_email,
  scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
})}`;
const signer = createSign('RSA-SHA256');
signer.update(unsigned);
const assertion = `${unsigned}.${signer.sign(key.private_key).toString('base64url')}`;
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
});
if (!tokenResponse.ok) throw new Error(`Google token request failed (${tokenResponse.status})`);
const token = await tokenResponse.json();
const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(title,gridProperties))`, {
  headers: { Authorization: `Bearer ${token.access_token}` },
});
if (!response.ok) throw new Error(`Spreadsheet read failed (${response.status}). Check Viewer sharing and Sheets API.`);
const metadata = await response.json();
const stockSheet = (metadata.sheets || []).find(sheet => /stock\s*room/i.test(sheet.properties?.title || ''));
if (!stockSheet) throw new Error('The spreadsheet is accessible but has no Stock Room tab.');
const readable = (metadata.sheets || []).filter(sheet => sheet.properties?.gridProperties);
const params = new URLSearchParams();
for (const sheet of readable) params.append('ranges', `'${sheet.properties.title.replace(/'/g, "''")}'!A1:AZ`);
const valuesResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`, {
  headers: { Authorization: `Bearer ${token.access_token}` },
});
if (!valuesResponse.ok) throw new Error(`Spreadsheet rows could not be read (${valuesResponse.status}). Check Viewer sharing and Sheets API.`);
const values = await valuesResponse.json();
if ((values.valueRanges || []).length !== readable.length) throw new Error('Some spreadsheet tabs could not be read.');
console.log(`Verified: ${key.client_email} can read ${readable.length} data tabs, including Stock Room.`);
