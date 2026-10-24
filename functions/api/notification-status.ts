import { DEFAULT_SPREADSHEET_ID } from '../../src/lib/config';
import type { NotificationDB } from './sheet-mutation';
import type { TelegramConfig } from '../../server/itemNotifications';

type Env = TelegramConfig & { STOCK_SPREADSHEET_ID?: string; ITEM_NOTIFICATION_DB?: NotificationDB };

// Read-only deployment diagnostics. Return readiness only, never secret values,
// spreadsheet/chat IDs, bot identity, membership details or Telegram error text.
export async function onRequestGet({ env, request }: { env: Env; request?: Request }): Promise<Response> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chats = [...new Set((env.TELEGRAM_NOTIFICATION_CHAT_IDS ?? env.TELEGRAM_ALLOWED_GROUP_IDS ?? '').split(',').map(s => s.trim()).filter(s => /^-?\d+$/.test(s)))];
  let databaseReady = false;
  let legacyRedirectModeSupported = true;
  try { new Request('https://sheets.googleapis.com/', { redirect: 'error' }); }
  catch { legacyRedirectModeSupported = false; }
  try {
    if (env.ITEM_NOTIFICATION_DB) {
      await env.ITEM_NOTIFICATION_DB.prepare('SELECT COUNT(*) AS operations FROM item_operations').first();
      databaseReady = true;
    }
  } catch { /* No infrastructure details are exposed. */ }
  let botReady = false;
  let destinationReady = false;
  if (token) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) });
      botReady = response.ok && Boolean((await response.json() as { ok?: boolean }).ok);
      if (botReady && chats.length) {
        const results = await Promise.all(chats.map(async chat_id => {
          const r = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id }), signal: AbortSignal.timeout(5000),
          });
          return r.ok && Boolean((await r.json() as { ok?: boolean }).ok);
        }));
        destinationReady = results.every(Boolean);
      }
    } catch { /* Telegram URLs can contain credentials: never log exception objects. */ }
  }
  return Response.json({
    databaseReady,
    botReady,
    destinationConfigured: chats.length > 0,
    destinationReady,
    defaultSpreadsheetWatched: env.STOCK_SPREADSHEET_ID?.trim() === DEFAULT_SPREADSHEET_ID,
    requestedSpreadsheetWatched: request ? env.STOCK_SPREADSHEET_ID?.trim() === new URL(request.url).searchParams.get('spreadsheet') : false,
    legacyRedirectModeSupported,
    abortSignalAnySupported: typeof AbortSignal.any === 'function',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
