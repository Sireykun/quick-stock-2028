import { authorizeGoogleDrive, getDriveToken } from './auth';

type DrivePermission = { id: string; emailAddress?: string; role: string; type: string };

async function driveRequest(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(data?.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response;
}

export async function shareSpreadsheet(sheetId: string, email: string, role: 'editor' | 'viewer'): Promise<string> {
  const token = getDriveToken() || await authorizeGoogleDrive();
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sheetId)}/permissions`;
  const list = await driveRequest(`${base}?fields=permissions(id,emailAddress,role,type)&supportsAllDrives=true`, token);
  const permissions = (await list.json() as { permissions?: DrivePermission[] }).permissions || [];
  const existing = permissions.find(permission => permission.type === 'user' && permission.emailAddress?.toLowerCase() === email.toLowerCase());
  const driveRole = role === 'editor' ? 'writer' : 'reader';
  if (existing) {
    if (existing.role !== driveRole) await driveRequest(`${base}/${encodeURIComponent(existing.id)}?supportsAllDrives=true`, token, { method: 'PATCH', body: JSON.stringify({ role: driveRole }) });
    return existing.id;
  }
  const created = await driveRequest(`${base}?sendNotificationEmail=true&supportsAllDrives=true&fields=id`, token, { method: 'POST', body: JSON.stringify({ type: 'user', role: driveRole, emailAddress: email }) });
  const permission = await created.json() as { id?: string };
  if (!permission.id) throw new Error('Google Drive did not return a permission ID.');
  return permission.id;
}

export async function removeSpreadsheetShare(sheetId: string, permissionId: string): Promise<void> {
  const token = getDriveToken() || await authorizeGoogleDrive();
  await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sheetId)}/permissions/${encodeURIComponent(permissionId)}?supportsAllDrives=true`, token, { method: 'DELETE' });
}
