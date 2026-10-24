import { accessRole, verifiedFirebaseEmail, type AccessDB } from '../../server/appAccess';

type Context = { request: Request; env: { ITEM_NOTIFICATION_DB?: AccessDB } };
const fail = (message: string, status: number) => Response.json({ error: { message } }, { status });

export async function onRequestPut({ request, env }: Context): Promise<Response> {
  try {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return fail('Invalid origin', 403);
    if (!env.ITEM_NOTIFICATION_DB) return fail('Workspace storage unavailable', 503);
    const email = await verifiedFirebaseEmail(request);
    if (!email) return fail('Verified Google sign-in required', 401);
    const role = await accessRole(env.ITEM_NOTIFICATION_DB, email);
    if (!role) return fail('App access required', 403);
    if (role !== 'owner') {
      const membership = await env.ITEM_NOTIFICATION_DB.prepare("SELECT shared_sheet_id FROM app_access WHERE email = ? AND status = 'active'").bind(email).first<{ shared_sheet_id: string | null }>();
      if (membership?.shared_sheet_id) return fail('This account uses the Owner’s shared Sheet', 403);
    }
    const input = await request.json() as { sheetId?: string };
    const sheetId = String(input.sheetId || '').trim();
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(sheetId)) return fail('Enter a valid Google Sheets ID', 400);
    await env.ITEM_NOTIFICATION_DB.prepare('INSERT INTO user_workspaces (email, sheet_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET sheet_id = excluded.sheet_id, updated_at = excluded.updated_at').bind(email, sheetId, new Date().toISOString()).run();
    return Response.json({ sheetId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return fail('Could not save workspace', 503); }
}
