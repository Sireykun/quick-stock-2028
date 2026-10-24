type Statement = { bind(...values: unknown[]): Statement; all<T>(): Promise<{ results: T[] }> };
type ActivityDB = { prepare(sql: string): Statement };
type Env = { ITEM_NOTIFICATION_DB?: ActivityDB };
type Context = { request: Request; env: Env };

const failure = (message: string, status: number) => Response.json({ error: { message } }, { status });

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return failure('Google sign-in required', 401);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return failure('Forbidden', 403);
  const spreadsheet = new URL(request.url).searchParams.get('spreadsheet') || '';
  if (!/^[a-zA-Z0-9_-]{10,120}$/.test(spreadsheet)) return failure('Invalid spreadsheet', 400);
  if (!env.ITEM_NOTIFICATION_DB) return failure('Activity log database unavailable', 503);
  try {
    const access = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet}?fields=spreadsheetId`, {
      headers: { Authorization: authorization },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (!access.ok) return failure('Cannot access this spreadsheet', access.status >= 300 && access.status < 400 ? 403 : access.status);
    const { results } = await env.ITEM_NOTIFICATION_DB.prepare('SELECT id, created_at, actor_name, actor_email, action, target FROM activity_logs WHERE spreadsheet = ? ORDER BY created_at DESC, rowid DESC LIMIT 250').bind(spreadsheet).all();
    return Response.json({ logs: results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return failure('Could not load activity logs', 502);
  }
}
