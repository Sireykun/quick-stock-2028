const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.env.QUICK_STOCK_URL || 'https://quick-stock-2028.pages.dev';

if (!token || !secret) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in this terminal first.');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error('The webhook secret may contain only A-Z, a-z, 0-9, _ and -.');
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: new URL('/api/telegram', baseUrl).toString(),
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }),
});
const result = await response.json();
if (!response.ok || !result.ok) {
  console.error('Telegram rejected the webhook:', result.description || response.status);
  process.exit(1);
}
console.log('Telegram webhook connected to Quick Stock.');
