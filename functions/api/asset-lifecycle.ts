import { accessRole, verifiedFirebaseEmail, type AccessDB } from '../../server/appAccess';

type Context = { request: Request; env: { ITEM_NOTIFICATION_DB?: AccessDB } };
const bad = (message: string, status: number) => Response.json({ error: message }, { status });
async function authorize({ request, env }: Context) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return null;
  const email = await verifiedFirebaseEmail(request);
  if (!email || !env.ITEM_NOTIFICATION_DB) return null;
  const role = await accessRole(env.ITEM_NOTIFICATION_DB, email);
  if (!role) return null;
  const sheet = new URL(request.url).searchParams.get('sheet') || '';
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-zA-Z0-9_-]{10,120}$/.test(sheet) || !token) return null;
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet}?fields=spreadsheetId`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' });
  if (!response.ok) return null;
  return { email, role, sheet, db: env.ITEM_NOTIFICATION_DB };
}
export async function onRequestGet(context: Context): Promise<Response> {
  try {
    const user = await authorize(context); if (!user) return bad('Access denied', 403);
    const assetKey = new URL(context.request.url).searchParams.get('asset') || '';
    if (!/^(Classes|Stock Room):[1-9]\d*$/.test(assetKey)) return bad('Invalid asset', 400);
    const state = await user.db.prepare('SELECT * FROM asset_lifecycle WHERE spreadsheet = ? AND asset_key = ?').bind(user.sheet, assetKey).first();
    const events = (await user.db.prepare('SELECT action, actor, person, note, created_at FROM asset_lifecycle_events WHERE spreadsheet = ? AND asset_key = ? ORDER BY created_at DESC LIMIT 50').bind(user.sheet, assetKey).all()).results;
    return Response.json({ state, events }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return bad('Could not load asset history', 503); }
}
export async function onRequestPost(context: Context): Promise<Response> {
  try {
    const user = await authorize(context); if (!user || user.role === 'viewer') return bad('Editor access required', 403);
    const body = await context.request.json() as { assetKey?: string; action?: string; person?: string; dueAt?: string; maintenanceStatus?: string; note?: string };
    const assetKey = String(body.assetKey || ''); const action = String(body.action || '');
    if (!/^(Classes|Stock Room):[1-9]\d*$/.test(assetKey) || !['checkout', 'return', 'maintenance'].includes(action)) return bad('Invalid action', 400);
    const person = String(body.person || '').trim().slice(0, 200);
    const note = String(body.note || '').trim().slice(0, 1000);
    if (action === 'checkout' && !person) return bad('Enter the person receiving the equipment', 400);
    const status = String(body.maintenanceStatus || 'working');
    if (!['working', 'needs_repair', 'in_repair', 'retired'].includes(status)) return bad('Invalid maintenance status', 400);
    const previous = await user.db.prepare('SELECT * FROM asset_lifecycle WHERE spreadsheet = ? AND asset_key = ?').bind(user.sheet, assetKey).first<{ custodian: string | null; checked_out_at: string | null; due_at: string | null; maintenance_status: string; maintenance_note: string | null }>();
    if (action === 'checkout' && previous?.custodian) return bad('This asset is already checked out', 409);
    if (action === 'return' && !previous?.custodian) return bad('This asset is not checked out', 409);
    const now = new Date().toISOString();
    const custodian = action === 'checkout' ? person : action === 'return' ? null : previous?.custodian || null;
    const checkedOutAt = action === 'checkout' ? now : action === 'return' ? null : previous?.checked_out_at || null;
    const dueAt = action === 'checkout' && body.dueAt && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : action === 'return' ? null : previous?.due_at || null;
    const maintenanceStatus = action === 'maintenance' ? status : previous?.maintenance_status || 'working';
    const maintenanceNote = action === 'maintenance' ? note : previous?.maintenance_note || null;
    await user.db.prepare('INSERT INTO asset_lifecycle (spreadsheet, asset_key, custodian, checked_out_at, due_at, maintenance_status, maintenance_note, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(spreadsheet, asset_key) DO UPDATE SET custodian = excluded.custodian, checked_out_at = excluded.checked_out_at, due_at = excluded.due_at, maintenance_status = excluded.maintenance_status, maintenance_note = excluded.maintenance_note, updated_at = excluded.updated_at, updated_by = excluded.updated_by').bind(user.sheet, assetKey, custodian, checkedOutAt, dueAt, maintenanceStatus, maintenanceNote, now, user.email).run();
    await user.db.prepare('INSERT INTO asset_lifecycle_events (id, spreadsheet, asset_key, action, actor, person, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), user.sheet, assetKey, action, user.email, person || null, note || null, now).run();
    return Response.json({ ok: true });
  } catch { return bad('Could not save asset status', 503); }
}
