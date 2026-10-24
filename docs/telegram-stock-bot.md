# Telegram Sheet bot

## Automatic item notifications

Production setup completed on **14 October 2026** at
`https://quick-stock-2028.pages.dev`. A Cloudflare runtime fix was deployed on
**15 October 2026** (deployment `16c3db04`): Google requests now use
`redirect: 'manual'` and reject redirects explicitly because Workers does not
support `redirect: 'error'`. A live authorization probe now reaches Google and
returns the expected 401 for an invalid token, rather than failing locally with 502.
The D1 schema is
applied and `ITEM_NOTIFICATION_DB` is bound in production. Existing encrypted
bot settings were retained. Live app/API authentication checks and all 15 focused
tests passed. Actual Telegram delivery after a signed-in Google inventory change
was confirmed on **15 October 2026**, and the operation ledger recorded successful
live commits. The setup below is retained for new environments.

App writes go through `/api/sheet-mutation`, using the signed-in Google account's
existing OAuth access. The service account stays read-only. After Google confirms
a change, the backend compares inventory snapshots for `Class`/`Classes` and
`STOCK_SHEET_NAME` (default `Stock Room`). It sends additions, deletions, changed
fields and movements, including quantity/status changes, with `Asia/Phnom_Penh`
time. Timestamp-only saves, unchanged values, formatting, dictionary/template
maintenance and reads are silent. Adding template items **to inventory** produces
a bulk summary. There is currently no separate borrow/return workflow.

Messages contain inventory fields only; no action performer is collected or sent.
Both sides of a move now commit in one atomic Google Sheets batch. Mixed edits and
deletions from the inventory Save button also commit together. Bulk batches are
summarized and long summaries split below Telegram's message limit.

### Required deployment setup

Reuse the existing encrypted `TELEGRAM_BOT_TOKEN` and `STOCK_SPREADSHEET_ID`.
Notifications default to the existing `TELEGRAM_ALLOWED_GROUP_IDS`. To choose a
different destination (including a private chat that has started the bot), set
the backend-only `TELEGRAM_NOTIFICATION_CHAT_IDS` secret to comma-separated numeric
chat IDs. An explicitly empty value disables delivery. Do not put these values
in frontend code or `VITE_` variables.

Create a Cloudflare D1 database and apply `migrations/001_item_operations.sql`:

```sh
npx wrangler d1 create quick-stock-item-operations
npx wrangler d1 execute quick-stock-item-operations --remote --file=migrations/001_item_operations.sql
```

Bind it to the Pages project as **`ITEM_NOTIFICATION_DB`**, then deploy the app
and Functions together. See [Cloudflare's Pages D1 binding instructions](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases).
The configured spreadsheet requires this binding before accepting writes. Other
spreadsheets retain Google-authorized writes but do not send alerts. Local/demo
inventory does not send alerts. Vite alone does not serve the Functions; use a
Pages development environment with the D1 migration applied for integration tests.

The D1 ledger stores random operation IDs, request fingerprints and Sheet result
metadata, never OAuth/Telegram credentials or actor identities. A unique pending
operation per spreadsheet serializes app writes while snapshots are read. Replays
of a completed operation return the stored result without writing or alerting
again. Retain operation IDs to retain replay protection. An interrupted runtime
can leave a pending operation: inspect the real Sheet before manually marking that
specific record done with an error response/status (for example 409); never delete
it and blindly retry an ambiguous write.

Telegram delivery runs in `waitUntil` after the Sheet commit: 5 seconds per send,
20 seconds total, generic logs only. There are no automatic send retries because
Telegram cannot deduplicate an ambiguous timeout. A Telegram outage, timeout or
post-commit snapshot failure may lose an alert, but never rolls back or reports a
committed item change as failed. This is best-effort, at-most-once delivery, not a
guaranteed-delivery queue. Direct edits in Google Sheets or other clients are not
watched; the serialization covers this app's writes only.

Verification: `npx tsx --test tests/itemNotifications.test.ts tests/itemMutations.test.ts functions/api/sheet-mutation.test.ts`,
`npm run lint`, and `npm run build`. Tests use simulated Sheets and Telegram; after
deployment, check an add, edit, unchanged save, movement, delete and multi-item
save in a test inventory location and confirm the configured chat receives them.

The bot reads the complete Quick Stock spreadsheet for allowed Telegram user IDs in private chats and explicitly allowed groups. It can list every tab with `/tabs`, browse data rows with `/tab Item Master` or `/tab Lab_Template 2`, search cell values across tabs with `/find HDMI`, list Type/Model values with `/types`, and search by type with `/type Acer Core5`. Type searches include inventory, templates, and dropdown values. It can also answer inventory and field questions such as “What is the hostname of the keyboard in room 109?”. Dashboard tabs without cells are listed but have no rows to browse. Each question reads the current Sheet; the bot is read-only.

The Telegram command menu contains `/start`, `/menu`, `/tabs`, `/tab`, `/find`, `/types`, `/models`, `/type`, `/summary`, `/rooms`, `/low`, `/pdf`, `/help`, and `/id`. An allowed user can send `/menu` to show a short main keyboard. **Items** opens Item names, Types, Models, and Search item; **Rooms** opens room shortcuts and Find room. **Back** returns to the main keyboard. Users can also type longer questions such as “How many keyboards do we have in room 109?” or “Find type Acer Core5”. Long answers are split into short pages; follow the `Next:` command shown in the reply. The bot matches tab names and Sheet values; it does not generate open-ended AI answers. To refresh the command menu after bot setup, run `node scripts/set-telegram-commands.mjs` with `TELEGRAM_BOT_TOKEN` set in the terminal.

Use `/pdf` or the **PDF** button to receive a monthly PDF of the **Stock Room** tab only. `/pdf 2026-10` sets the report month. The file uses current Sheet values when requested and has blank columns for physical counts; it is not a historical month-end balance. In an approved group, send `/pdf@SS2_stock_bot`.

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

If Quick Stock is switched to another spreadsheet, share the new spreadsheet with the service account as **Viewer**, update Cloudflare's encrypted `STOCK_SPREADSHEET_ID` to the new spreadsheet ID, and redeploy Pages. Changing the spreadsheet in app Settings alone does not update the bot's Cloudflare secret. Run `node scripts/verify-google-service-account.mjs <key.json> <new-spreadsheet-id>` to confirm that the bot can read every data tab before deploying.

## Use in a Telegram group

1. Add **@SS2_stock_bot** to the group. It needs permission to send messages, but it does not need administrator rights. Keep BotFather privacy mode enabled.
2. An already allowed user sends `/id@SS2_stock_bot` in the group. The reply shows the negative group ID (often beginning with `-100`).
3. Add that ID to the encrypted Cloudflare Pages production secret `TELEGRAM_ALLOWED_GROUP_IDS`. Separate multiple group IDs with commas. Redeploy Pages so the Function receives the new secret. `TELEGRAM_ALLOWED_USER_IDS` continues to control which members may ask questions.
4. Test `/summary@SS2_stock_bot`, `/room@SS2_stock_bot 109`, or `/type@SS2_stock_bot Acer Core5` in the group. To ask a longer question, reply to one of the bot's messages. Replies are visible to everyone in the group; private chats still show the tap keyboard.

If the bot's username changes, set `TELEGRAM_BOT_USERNAME` to the new username (without `@`) in Cloudflare and redeploy. With privacy mode enabled, Telegram delivers commands addressed to the bot and replies to it; the bot does not need to read every group message. [Telegram's bot FAQ](https://core.telegram.org/bots/faq) explains privacy mode.

The `/id` command reports the sender's own ID and, in a group, the group ID. Other commands require both an allowed user and an allowed group. The endpoint requires Telegram's webhook secret header. If it cannot read the Sheet, it sends a generic error and logs the technical reason in Cloudflare.
