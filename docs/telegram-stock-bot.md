# Telegram Sheet bot

The bot reads the complete Quick Stock spreadsheet for allowed Telegram user IDs in private chats. It can list every tab with `/tabs`, browse data rows with `/tab Item Master` or `/tab Lab_Template 2`, search cell values across tabs with `/find HDMI`, list Type/Model values with `/types`, and search by type with `/type Acer Core5`. Type searches include inventory, templates, and dropdown values. It can also answer inventory and field questions such as “What is the hostname of the keyboard in room 109?”. Dashboard tabs without cells are listed but have no rows to browse. Each question reads the current Sheet; the bot is read-only.

The Telegram command menu contains `/start`, `/menu`, `/tabs`, `/tab`, `/find`, `/types`, `/type`, `/summary`, `/rooms`, `/low`, `/help`, and `/id`. An allowed user can send `/menu` to show persistent question buttons. Users can also type longer questions such as “How many keyboards do we have in room 109?” or “Find type Acer Core5”. The bot matches tab names and Sheet values; it does not generate open-ended AI answers. To refresh the command menu after bot setup, run `node scripts/set-telegram-commands.mjs` with `TELEGRAM_BOT_TOKEN` set in the terminal.

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

   Optional plain variables: `STOCK_SHEET_NAME` (defaults to `Stock Room`) and `STOCK_LOW_THRESHOLD` (defaults to `5`). Do not add any of these values to Git or Vite's `VITE_` variables.

4. Deploy the site again after adding secrets, so Cloudflare binds them to the Function.
5. Register `https://quick-stock-2028.pages.dev/api/telegram` as the Telegram webhook with `scripts/set-telegram-webhook.mjs`. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` as temporary environment variables in the terminal, then run `node scripts/set-telegram-webhook.mjs`. The script does not print either secret. On the owner's Windows computer, `scripts/configure-telegram-from-clipboard.ps1` can instead read a copied BotFather token once, create the encrypted Cloudflare secrets, register the webhook, and clear the clipboard.
6. Have the manager message the bot `/id`. Add that numeric ID as the encrypted `TELEGRAM_ALLOWED_USER_IDS` secret in Cloudflare (comma separate multiple managers) and deploy again. Then the manager can use `/summary` to confirm access.

The `/id` command reports only the sender's own ID. Other commands reject users who are not on the allowlist. The endpoint requires Telegram's webhook secret header; the bot ignores group chats. If it cannot read the Sheet, it sends a generic error and logs the technical reason in Cloudflare.
