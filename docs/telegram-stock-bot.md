# Telegram stock bot

The bot answers stock questions from the same Google Sheet as Quick Stock. It is read-only and works in private chats for allowed Telegram user IDs. Supported questions include `/summary`, `/rooms`, `/room 106`, `/item keyboard`, `/low`, “What is in room 106?” and “How many keyboards?”. Each question reads the current sheet.

## One-time setup

1. In Telegram, create a bot with [@BotFather](https://t.me/BotFather). Keep its token private.
2. In Google Cloud, create a service account in a project with the Google Sheets API enabled. Create a JSON key. Share the Quick Stock spreadsheet with the service account's `client_email` as **Viewer**. Keep the JSON key private.
3. In Cloudflare **Workers & Pages → quick-stock-2028 → Settings → Variables and Secrets**, add these **encrypted** production secrets:

   | Name | Value |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | BotFather token |
   | `TELEGRAM_WEBHOOK_SECRET` | A random 32+ character string using letters, digits, `_` or `-` |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON key's `client_email` |
   | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | JSON key's `private_key`, including BEGIN/END lines |
   | `STOCK_SPREADSHEET_ID` | Spreadsheet ID from Quick Stock Settings |
   | `TELEGRAM_ALLOWED_USER_IDS` | Manager's Telegram numeric user ID; comma separated for multiple managers |

   Optional plain variables: `STOCK_SHEET_NAME` (defaults to `Stock Room`) and `STOCK_LOW_THRESHOLD` (defaults to `5`). Do not add any of these values to Git or Vite's `VITE_` variables.

4. Deploy the site again after adding secrets, so Cloudflare binds them to the Function.
5. Register `https://quick-stock-2028.pages.dev/api/telegram` as the Telegram webhook with `scripts/set-telegram-webhook.mjs`. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` as temporary environment variables in the terminal, then run `node scripts/set-telegram-webhook.mjs`. The script does not print either secret.
6. Have the manager message the bot `/id`. Add that numeric ID to `TELEGRAM_ALLOWED_USER_IDS` in Cloudflare and deploy again. Then the manager can use `/summary` to confirm access.

The `/id` command reports only the sender's own ID. Other commands reject users who are not on the allowlist. The endpoint requires Telegram's webhook secret header; the bot ignores group chats. If it cannot read the Sheet, it sends a generic error and logs the technical reason in Cloudflare.
