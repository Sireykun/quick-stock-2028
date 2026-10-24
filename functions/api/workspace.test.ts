import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './app-access';
import { onRequestPut } from './workspace';

test('approved Gmail accounts retain separate Sheet connections and shared members cannot replace the team Sheet', async () => {
  const previousFetch = globalThis.fetch;
  let signedIn = 'sireykun8@gmail.com';
  const ownSheets = new Map<string, string>();
  const members = new Map<string, { role: string; shared: string | null }>([
    ['editor@gmail.com', { role: 'editor', shared: null }],
    ['teammate@gmail.com', { role: 'viewer', shared: 'team_sheet_1234567890' }],
  ]);
  globalThis.fetch = async () => Response.json({ users: [{ email: signedIn, emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] });
  const db = { prepare(sql: string) {
    let args: unknown[] = [];
    const query = {
      bind(...values: unknown[]) { args = values; return query; },
      async first<T>() {
        const email = String(args[0]);
        if (sql.includes('SELECT role FROM app_access')) return (members.has(email) ? { role: members.get(email)?.role } : null) as T | null;
        if (sql.includes('SELECT shared_sheet_id')) return (members.has(email) ? { shared_sheet_id: members.get(email)?.shared } : null) as T | null;
        if (sql.includes('SELECT sheet_id FROM user_workspaces')) return (ownSheets.has(email) ? { sheet_id: ownSheets.get(email) } : null) as T | null;
        return null;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { if (sql.startsWith('INSERT INTO user_workspaces')) ownSheets.set(String(args[0]), String(args[1])); return {}; },
    };
    return query;
  } };
  const context = (method: 'GET' | 'PUT', sheetId?: string) => ({
    request: new Request('https://quick-stock.test/api/workspace', { method, headers: { Origin: 'https://quick-stock.test', 'X-Firebase-Token': 'verified', 'Content-Type': 'application/json' }, body: sheetId ? JSON.stringify({ sheetId }) : undefined }),
    env: { ITEM_NOTIFICATION_DB: db },
  });
  try {
    assert.equal((await onRequestPut(context('PUT', 'owner_sheet_1234567890'))).status, 200);
    signedIn = 'editor@gmail.com';
    assert.equal((await onRequestPut(context('PUT', 'editor_sheet_1234567890'))).status, 200);
    const editor = await onRequestGet(context('GET'));
    assert.equal((await editor.json()).workspaceSheetId, 'editor_sheet_1234567890');
    signedIn = 'sireykun8@gmail.com';
    const owner = await onRequestGet(context('GET'));
    assert.equal((await owner.json()).workspaceSheetId, 'owner_sheet_1234567890');
    signedIn = 'teammate@gmail.com';
    assert.equal((await onRequestPut(context('PUT', 'other_sheet_1234567890'))).status, 403);
    const teammate = await onRequestGet(context('GET'));
    assert.equal((await teammate.json()).sharedSheetId, 'team_sheet_1234567890');
    signedIn = 'stranger@gmail.com';
    assert.equal((await onRequestPut(context('PUT', 'stranger_sheet_1234567890'))).status, 403);
    assert.equal(ownSheets.size, 2);
  } finally { globalThis.fetch = previousFetch; }
});
