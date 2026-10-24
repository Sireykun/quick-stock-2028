import { getAccessToken, getFirebaseIdToken } from './auth';

export interface AssetLifeState { custodian: string | null; checked_out_at: string | null; due_at: string | null; maintenance_status: string; maintenance_note: string | null }
export interface AssetLifeEvent { action: string; actor: string; person: string | null; note: string | null; created_at: string }
async function request(sheetId: string, assetKey: string, body?: object): Promise<{ state: AssetLifeState | null; events: AssetLifeEvent[] }> {
  const token = getAccessToken(); const firebase = await getFirebaseIdToken();
  if (!token || !firebase) throw new Error('Connect Google in Settings.');
  const response = await fetch(`/api/asset-lifecycle?${new URLSearchParams({ sheet: sheetId, asset: assetKey })}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'X-Firebase-Token': firebase, 'Content-Type': 'application/json' }, body: body ? JSON.stringify({ assetKey, ...body }) : undefined });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update asset.');
  return data;
}
export const loadAssetLifecycle = (sheetId: string, assetKey: string) => request(sheetId, assetKey);
export const saveAssetLifecycle = (sheetId: string, assetKey: string, body: object) => request(sheetId, assetKey, body);
