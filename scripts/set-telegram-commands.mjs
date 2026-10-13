const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in this terminal first.');
  process.exit(1);
}

const commands = [
  { command: 'start', description: 'Open Sheet question buttons' },
  { command: 'menu', description: 'Show ready-to-tap questions' },
  { command: 'tabs', description: 'List every Sheet tab' },
  { command: 'tab', description: 'Browse a tab, for example Item Master' },
  { command: 'find', description: 'Search all tabs for a value' },
  { command: 'types', description: 'List Type/Model values' },
  { command: 'type', description: 'Find items by Type/Model' },
  { command: 'summary', description: 'See total rooms and inventory' },
  { command: 'rooms', description: 'List inventory rooms' },
  { command: 'low', description: 'Find low or empty stock' },
  { command: 'help', description: 'See Sheet question examples' },
  { command: 'id', description: 'Show your Telegram user ID' },
];

const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ commands }),
});
const result = await response.json();
if (!response.ok || !result.ok) {
  console.error('Could not update Telegram commands:', result.description || response.status);
  process.exit(1);
}
console.log(`Telegram command menu updated (${commands.length} commands).`);
