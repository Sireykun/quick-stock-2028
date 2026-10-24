import { changesBetween, notificationMessages, sendItemNotifications, type Snapshot, type TelegramConfig } from '../../server/itemNotifications';
import { describeSheetMutation, googleActor } from '../../server/activityLogs';
import { accessRole, verifiedFirebaseEmail } from '../../server/appAccess';

type Statement = { bind(...values: unknown[]): Statement; run(): Promise<{ meta: { changes: number } }>; first<T>(): Promise<T | null> };
export type NotificationDB = { prepare(sql: string): Statement };
type Env = TelegramConfig & { STOCK_SPREADSHEET_ID?: string; STOCK_SHEET_NAME?: string; ITEM_NOTIFICATION_DB?: NotificationDB };
type Context = { request: Request; env: Env; waitUntil(promise: Promise<unknown>): void };
const json = (value: unknown, status = 200) => Response.json(value, { status });
const failure = (message: string, status: number) => json({ error: { message } }, status);

export async function onRequestPost({ request, env, waitUntil }: Context): Promise<Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return failure('Google sign-in required', 401);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return failure('Forbidden', 403);
  let input: { url: string; method: string; body: string; operationId: string };
  try { input = await request.json(); } catch { return failure('Invalid request', 400); }
  if (!input || typeof input.url !== 'string' || typeof input.body !== 'string' || input.body.length > 2_000_000 ||
      !/^[a-zA-Z0-9-]{20,80}$/.test(input.operationId || '') || !['POST', 'PUT'].includes(input.method)) return failure('Invalid mutation', 400);
  let url: URL, body: any;
  try { url = new URL(input.url); body = JSON.parse(input.body); } catch { return failure('Invalid mutation', 400); }
  // Never forward an OAuth credential to a caller-controlled origin or arbitrary Google endpoint.
  const match = url.pathname.match(/^\/v4\/spreadsheets\/([a-zA-Z0-9_-]+)(:batchUpdate|\/values(?::batchUpdate|\/[^?#]+))$/);
  if (url.origin !== 'https://sheets.googleapis.com' || url.username || url.password || !match) return failure('Invalid Sheet URL', 400);
  if (!env.ITEM_NOTIFICATION_DB) return failure('Access database unavailable', 503);
  const firebaseEmail = await verifiedFirebaseEmail(request).catch(() => null);
  if (!firebaseEmail || !['owner', 'editor'].includes(await accessRole(env.ITEM_NOTIFICATION_DB, firebaseEmail))) return failure('Editor access required', 403);
  const spreadsheet = match[1];
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet}`;
  const google = async (target: string, init: RequestInit = {}) => {
    // Workers accepts manual/follow redirect modes. Never follow a redirect with
    // the user's OAuth credential, and reject it explicitly instead.
    const response = await fetch(target, { ...init, headers: { Authorization: authorization, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000), redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) throw new Error('Unexpected Google redirect');
    return response;
  };
  const watched = spreadsheet === env.STOCK_SPREADSHEET_ID?.trim();
  let reserved = false;
  let committed = false;
  let result: any;
  let resultStatus = 200;
  try {
    // Google enforces the existing user's access. No service-account write permission is added.
    const metadataResponse = await google(`${base}?fields=sheets(properties(sheetId,title))`);
    if (!metadataResponse.ok) return failure('Cannot access this spreadsheet', metadataResponse.status);
    const metadata = await metadataResponse.json() as any;
    const tabs = (metadata.sheets || []).map((s: any) => s.properties).filter((s: any) =>
      /^(class|classes)$/i.test(s.title) || s.title.toLowerCase() === (env.STOCK_SHEET_NAME || 'Stock Room').toLowerCase());
    const snapshot = async (): Promise<Snapshot[]> => {
      if (!tabs.length) return [];
      const params = new URLSearchParams();
      for (const tab of tabs) params.append('ranges', `'${tab.title.replace(/'/g, "''")}'!A1:I`);
      const response = await google(`${base}/values:batchGet?${params}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as any;
      return tabs.map((tab: any, index: number) => ({ id: tab.sheetId, name: tab.title, rows: data.valueRanges?.[index]?.values || [] }));
    };
    if (watched) {
      if (!env.ITEM_NOTIFICATION_DB) return failure('Configure ITEM_NOTIFICATION_DB before editing this spreadsheet', 503);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([input.url, input.method, input.body]))))).map(n => n.toString(16).padStart(2, '0')).join('');
      const db = env.ITEM_NOTIFICATION_DB;
      const inserted = await db.prepare('INSERT OR IGNORE INTO item_operations (id, spreadsheet, fingerprint, state) VALUES (?, ?, ?, \'pending\')').bind(input.operationId, spreadsheet, hash).run();
      if (!inserted.meta.changes) {
        const previous = await db.prepare('SELECT fingerprint, state, response, status FROM item_operations WHERE id = ?').bind(input.operationId).first<any>();
        if (!previous || previous.fingerprint !== hash || previous.state === 'pending') return failure('Another change is in progress. Refresh before trying again.', 409);
        return new Response(previous.response, { status: previous.status, headers: { 'Content-Type': 'application/json' } });
      }
      reserved = true;
    }
    const before = watched ? await snapshot() : [];
    const response = await google(url.href, { method: input.method, body: input.body });
    resultStatus = response.status;
    if (!response.ok) {
      result = { error: { message: `Google Sheets change failed (${response.status})` } };
    } else {
      // Acknowledgement is the commit boundary. Notification work cannot change the result after this.
      committed = true;
      result = await response.json().catch(() => ({}));
      if (env.ITEM_NOTIFICATION_DB) {
        const db = env.ITEM_NOTIFICATION_DB;
        waitUntil((async () => {
          try {
            const actor = await googleActor(authorization);
            const { action, target } = describeSheetMutation(url);
            await db.prepare('INSERT OR IGNORE INTO activity_logs (id, spreadsheet, actor_sub, actor_name, actor_email, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .bind(input.operationId, spreadsheet, actor.sub, actor.name, actor.email, action, target, new Date().toISOString()).run();
          } catch { console.warn('Activity log could not be recorded'); }
        })());
      }
      if (watched) {
        try {
          const after = await snapshot();
          const messages = notificationMessages(changesBetween(before, after, body.requests || []));
          waitUntil(sendItemNotifications(env, messages));
        } catch { console.warn('Item notification snapshot failed'); }
      }
    }
  } catch {
    console.warn(committed ? 'Item notification processing failed' : 'Sheet mutation failed or outcome unknown');
    if (!committed) { resultStatus = 502; result = { error: { message: 'Sheet change could not be confirmed. Refresh before trying again.' } }; }
  }
  if (reserved) {
    try {
      await env.ITEM_NOTIFICATION_DB!.prepare('UPDATE item_operations SET state = \'done\', response = ?, status = ? WHERE id = ?').bind(JSON.stringify(result || {}), resultStatus, input.operationId).run();
    } catch { console.warn('Item operation completion could not be recorded'); }
  }
  return json(result || {}, committed ? 200 : resultStatus);
}
