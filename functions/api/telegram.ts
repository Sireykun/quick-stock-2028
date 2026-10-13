import { answerStockQuestion, parseStockRows, stockMenuView, stockQuestionKeyboard, type StockEntry } from '../../server/stockBot';
import { answerSheetQuestion, type SheetTab } from '../../server/sheetBot';
import { fitBotReply } from '../../server/botReply';

type Env = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ALLOWED_USER_IDS?: string;
  TELEGRAM_ALLOWED_GROUP_IDS?: string;
  TELEGRAM_BOT_USERNAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  STOCK_SPREADSHEET_ID?: string;
  STOCK_SHEET_NAME?: string;
  STOCK_LOW_THRESHOLD?: string;
};

type Context = { request: Request; env: Env };
type TelegramUpdate = { message?: { text?: string; chat?: { id?: number; type?: string }; from?: { id?: number }; reply_to_message?: { from?: { username?: string } } } };

function addressedGroupQuestion(message: NonNullable<TelegramUpdate['message']>, botUsername: string): string | null {
  const text = message.text?.trim() || '';
  const command = text.match(/^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?=\s|$)/i);
  if (command) {
    if (command[2] && command[2].toLowerCase() !== botUsername.toLowerCase()) return null;
    return `/${command[1]}${text.slice(command[0].length)}`.trim();
  }
  const mention = new RegExp(`(^|\\s)@${botUsername}(?=\\s|$|[?!,.])`, 'i');
  const isReply = message.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase();
  if (!mention.test(text) && !isReply) return null;
  return text.replace(mention, ' ').trim() || '/help';
}

const encode = (value: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

async function googleAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const pem = privateKey.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(pem);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`)));
  const jwt = `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Google did not provide an access token');
  return data.access_token;
}

async function googleGet(url: string, token: string): Promise<any> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Sheets read failed (${response.status})`);
  return response.json();
}

async function sheetData(env: Env): Promise<{ tabs: SheetTab[]; entries: StockEntry[] }> {
  const token = await googleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!);
  const id = env.STOCK_SPREADSHEET_ID!;
  const metadata = await googleGet(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets(properties(title,gridProperties))`, token);
  const sheets: { name: string; readable: boolean }[] = (metadata.sheets || [])
    .map((sheet: any) => ({ name: sheet.properties?.title, readable: Boolean(sheet.properties?.gridProperties) }))
    .filter((sheet: { name?: string }) => Boolean(sheet.name));
  const wanted = (env.STOCK_SHEET_NAME || 'Stock Room').toLowerCase();
  const stockName = sheets.find(sheet => sheet.name.toLowerCase() === wanted)?.name || sheets.find(sheet => /stock\s*room/i.test(sheet.name))?.name;
  if (!stockName) throw new Error('Stock Room tab was not found');
  const readable = sheets.filter(sheet => sheet.readable);
  const params = new URLSearchParams();
  for (const sheet of readable) params.append('ranges', `'${sheet.name.replace(/'/g, "''")}'!A1:AZ`);
  const result = await googleGet(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet?${params}`, token);
  const valueRanges: { values?: string[][] }[] = result.valueRanges || [];
  const rowsByName = new Map(readable.map((sheet, index) => [sheet.name, valueRanges[index]?.values || []]));
  const tabs: SheetTab[] = sheets.map(sheet => ({ ...sheet, rows: rowsByName.get(sheet.name) || [] }));
  const entries = tabs.filter(tab => tab.name === stockName || /^(class|classes)$/i.test(tab.name))
    .flatMap(tab => parseStockRows(tab.rows));
  return { tabs, entries };
}

async function sendMessage(token: string, chatId: number, text: string, keyboard?: string[][]): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: fitBotReply(text),
      ...(keyboard ? { reply_markup: { keyboard, resize_keyboard: true, is_persistent: true, input_field_placeholder: 'Ask about the Sheet' } } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Telegram send failed (${response.status})`);
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  const config: Env = {
    ...env,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN?.trim(),
    TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET?.trim(),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
    STOCK_SPREADSHEET_ID: env.STOCK_SPREADSHEET_ID?.trim(),
  };
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_WEBHOOK_SECRET || !config.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !config.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !config.STOCK_SPREADSHEET_ID) {
    return new Response('Bot is not configured', { status: 503 });
  }
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== config.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  let update: TelegramUpdate;
  try { update = await request.json() as TelegramUpdate; } catch { return new Response('Invalid JSON', { status: 400 }); }
  const message = update.message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  if (!message?.text || !chatId || !userId) return new Response('OK');
  const isPrivate = message.chat?.type === 'private';
  const isGroup = message.chat?.type === 'group' || message.chat?.type === 'supergroup';
  if (!isPrivate && !isGroup) return new Response('OK');
  const botUsername = (config.TELEGRAM_BOT_USERNAME || 'SS2_stock_bot').replace(/^@/, '').trim();
  if (!/^[a-z0-9_]+$/i.test(botUsername)) return new Response('Bot username is invalid', { status: 503 });
  const question = isGroup ? addressedGroupQuestion(message, botUsername) : message.text.trim();
  if (!question) return new Response('OK');
  if (/^\/id$/i.test(question)) {
    await sendMessage(config.TELEGRAM_BOT_TOKEN, chatId, isGroup
      ? `Your Telegram user ID: ${userId}\nThis group ID: ${chatId}`
      : `Your Telegram user ID: ${userId}`);
    return new Response('OK');
  }
  const allowed = (config.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(String(userId))) {
    if (isPrivate) await sendMessage(config.TELEGRAM_BOT_TOKEN, chatId, 'Access is restricted. Send /id to see your user ID, then ask the Quick Stock owner to add it.');
    return new Response('OK');
  }
  if (isGroup) {
    const allowedGroups = (config.TELEGRAM_ALLOWED_GROUP_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!allowedGroups.includes(String(chatId))) {
      await sendMessage(config.TELEGRAM_BOT_TOKEN, chatId, `This group is not enabled. Ask the Quick Stock owner to add group ID ${chatId}.`);
      return new Response('OK');
    }
  }
  try {
    const { tabs, entries } = await sheetData(config);
    const answer = answerSheetQuestion(question, tabs) ||
      answerStockQuestion(question, entries, Number(config.STOCK_LOW_THRESHOLD) || 5);
    await sendMessage(config.TELEGRAM_BOT_TOKEN, chatId, answer, isPrivate ? stockQuestionKeyboard(entries, stockMenuView(question)) : undefined);
    return new Response('OK');
  } catch (error) {
    console.error('Stock bot failed:', error);
    await sendMessage(config.TELEGRAM_BOT_TOKEN, chatId, 'I could not read the Sheet right now. Please try again later.');
    return new Response('OK');
  }
}

export function onRequestGet(): Response {
  return new Response('Telegram stock bot endpoint', { status: 200 });
}
