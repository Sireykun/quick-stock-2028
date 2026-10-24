import { APP_OWNER_EMAIL, accessRole, verifiedFirebaseEmail, type AccessDB } from '../../server/appAccess';

type Context = { request: Request; env: { ITEM_NOTIFICATION_DB?: AccessDB } };
const failure = (message: string, status: number) => Response.json({ error: { message } }, { status });

async function actor(context: Context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return null;
  if (!env.ITEM_NOTIFICATION_DB) return null;
  const email = await verifiedFirebaseEmail(request);
  if (!email) return null;
  const role = await accessRole(env.ITEM_NOTIFICATION_DB, email);
  if (role && role !== 'owner') await env.ITEM_NOTIFICATION_DB.prepare("UPDATE app_access SET last_access_at = ? WHERE email = ? AND status = 'active'").bind(new Date().toISOString(), email).run();
  return { email, role, db: env.ITEM_NOTIFICATION_DB };
}

export async function onRequestGet(context: Context): Promise<Response> {
  try {
    const current = await actor(context);
    if (!current) return failure('Verified Google sign-in required', 401);
    const members = current.role === 'owner'
      ? (await current.db.prepare('SELECT email, role, status, invited_at, last_access_at, revoked_at, shared_sheet_id, drive_permission_id FROM app_access ORDER BY status, email').all<{ email: string; role: string; status: string; invited_at: string | null; last_access_at: string | null; revoked_at: string | null; shared_sheet_id: string | null; drive_permission_id: string | null }>()).results
      : undefined;
    const workspace = current.role ? await current.db.prepare('SELECT sheet_id FROM user_workspaces WHERE email = ?').bind(current.email).first<{ sheet_id: string }>() : null;
    const membership = current.role && current.role !== 'owner' ? await current.db.prepare("SELECT shared_sheet_id FROM app_access WHERE email = ? AND status = 'active'").bind(current.email).first<{ shared_sheet_id: string | null }>() : null;
    return Response.json({ email: current.email, role: current.role, owner: APP_OWNER_EMAIL, members, workspaceSheetId: workspace?.sheet_id || null, sharedSheetId: membership?.shared_sheet_id || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure('Could not check app access', 503); }
}

export async function onRequestPost(context: Context): Promise<Response> {
  try {
    const current = await actor(context);
    if (!current || current.role !== 'owner') return failure('Owner access required', 403);
    const input = await context.request.json() as { email?: string; role?: string; status?: string; sharedSheetId?: string };
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@gmail\.com$/.test(email) || email.length > 254 || email === APP_OWNER_EMAIL || !['editor', 'viewer'].includes(String(input.role))) return failure('Enter a Gmail address and a valid role', 400);
    const status = input.status === 'pending' ? 'pending' : 'active';
    const sharedSheetId = String(input.sharedSheetId || '');
    if (sharedSheetId && !/^[a-zA-Z0-9_-]{10,120}$/.test(sharedSheetId)) return failure('Invalid spreadsheet', 400);
    await current.db.prepare('INSERT INTO app_access (email, role, status, invited_at, revoked_at, shared_sheet_id) VALUES (?, ?, ?, ?, NULL, ?) ON CONFLICT(email) DO UPDATE SET role = excluded.role, status = excluded.status, invited_at = excluded.invited_at, revoked_at = NULL, shared_sheet_id = excluded.shared_sheet_id').bind(email, input.role, status, new Date().toISOString(), sharedSheetId || null).run();
    return Response.json({ email, role: input.role, status });
  } catch { return failure('Could not save app access', 503); }
}

export async function onRequestDelete(context: Context): Promise<Response> {
  try {
    const current = await actor(context);
    if (!current || current.role !== 'owner') return failure('Owner access required', 403);
    const input = await context.request.json() as { email?: string };
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@gmail\.com$/.test(email) || email === APP_OWNER_EMAIL) return failure('Invalid Gmail address', 400);
    await current.db.prepare("UPDATE app_access SET status = 'revoked', revoked_at = ? WHERE email = ?").bind(new Date().toISOString(), email).run();
    return Response.json({ email, revoked: true });
  } catch { return failure('Could not remove app access', 503); }
}

export async function onRequestPatch(context: Context): Promise<Response> {
  try {
    const current = await actor(context);
    if (!current || current.role !== 'owner') return failure('Owner access required', 403);
    const input = await context.request.json() as { email?: string; permissionId?: string; sharedSheetId?: string };
    const email = String(input.email || '').trim().toLowerCase();
    const sheetId = String(input.sharedSheetId || '');
    const permissionId = String(input.permissionId || '');
    if (!/^[^\s@]+@gmail\.com$/.test(email) || !/^[a-zA-Z0-9_-]{10,120}$/.test(sheetId) || !/^[a-zA-Z0-9_-]{2,120}$/.test(permissionId)) return failure('Invalid sharing confirmation', 400);
    await current.db.prepare("UPDATE app_access SET status = 'active', revoked_at = NULL, shared_sheet_id = ?, drive_permission_id = ? WHERE email = ? AND status = 'pending'").bind(sheetId, permissionId, email).run();
    return Response.json({ email, activated: true });
  } catch { return failure('Could not activate access', 503); }
}
