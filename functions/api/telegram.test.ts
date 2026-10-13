import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost } from './telegram';

test('group messages require an addressed question, an allowed user, and an allowed group', async () => {
  const sent: Array<{ chat_id: number; text: string; reply_markup?: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response('{}', { status: 200 });
  };
  const env = {
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'test-key',
    STOCK_SPREADSHEET_ID: 'test-sheet',
    TELEGRAM_ALLOWED_USER_IDS: '123',
    TELEGRAM_ALLOWED_GROUP_IDS: '-100456',
  };
  const send = async (text: string, userId = 123, groupId = -100456, replyToBot = false) => {
    const request = new Request('https://example.com/api/telegram', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-secret' },
      body: JSON.stringify({ message: {
        text, chat: { id: groupId, type: 'supergroup' }, from: { id: userId },
        ...(replyToBot ? { reply_to_message: { from: { username: 'SS2_stock_bot' } } } : {}),
      } }),
    });
    return onRequestPost({ request, env });
  };
  try {
    await send('hello everyone');
    await send('/summary@another_bot');
    await send('/summary@SS2_stock_bot', 999);
    assert.equal(sent.length, 0);

    await send('/summary@SS2_stock_bot', 123, -100999);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /group is not enabled/i);
    assert.equal(sent[0].chat_id, -100999);

    await send('/id@SS2_stock_bot');
    assert.match(sent[1].text, /This group ID: -100456/);
    assert.match(sent[1].text, /Your Telegram user ID: 123/);
    assert.equal(sent[1].reply_markup, undefined);

    await send('@SS2_stock_bot /id');
    assert.match(sent[2].text, /This group ID: -100456/);

    await send('/id', 123, -100456, true);
    assert.match(sent[3].text, /This group ID: -100456/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
