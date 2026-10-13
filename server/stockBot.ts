export type StockEntry = { room: string; item: string; quantity: number; status: string };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const key = (value: string) => clean(value).toLocaleLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const singular = (value: string) => value.endsWith('s') ? value.slice(0, -1) : value;

function mentions(query: string, name: string): boolean {
  const word = singular(key(name));
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(word)}s?($|[^a-z0-9])`, 'i').test(query);
}

export function stockQuestionKeyboard(entries: StockEntry[]): string[][] {
  const rooms = [...new Set(entries.map(entry => entry.room))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 4);
  const roomButtons: string[][] = [];
  for (let index = 0; index < rooms.length; index += 2) {
    roomButtons.push(rooms.slice(index, index + 2).map(room => `📍 ${room}`));
  }
  return [
    ['📊 Stock overview', '🏠 Show rooms'],
    ['⚠️ Low stock', '🔎 Find an item'],
    ['📄 All sheet tabs', '🧾 Item names'],
    ['How many items do we have in total?'],
    ['Which items are low or out of stock?'],
    ...(entries.some(entry => key(entry.room) === '109') ? [['What is in room 109?']] : []),
    ...roomButtons,
    ['❓ Help'],
  ];
}

export function parseStockRows(rows: string[][]): StockEntry[] {
  const first = rows[0] || [];
  const formatB = /^(item|item name)$/i.test(clean(first[0] || '')) ||
    (!/^(location|room|class name)$/i.test(clean(first[0] || '')) &&
      rows.slice(0, 8).some(row => clean(row[0] || '') && /^\d+$/.test(clean(row[1] || ''))));
  let currentRoom = '';
  const entries: StockEntry[] = [];
  for (const row of rows) {
    if (/^(location|room|class name)$/i.test(clean(row[0] || '')) ||
        /^(item|item name)$/i.test(clean(row[0] || ''))) continue;
    if (formatB) {
      const item = clean(row[0] || '');
      const room = clean(row[8] || '');
      if (item && room) entries.push({ room, item, quantity: Number(row[1]) || 0, status: clean(row[5] || '') });
    } else {
      if (clean(row[0] || '')) currentRoom = clean(row[0]);
      const item = clean(row[1] || '');
      if (item && currentRoom) entries.push({ room: currentRoom, item, quantity: Number(row[2]) || 0, status: clean(row[8] || '') });
    }
  }
  return entries;
}

const help = 'Tap a question below, or type a full question, for example:\n• What items are in room 109?\n• Which rooms have a keyboard?\n• What is in Item Master?\n• Show the Lab_Template.\n• What dropdown values are available?\n• Search the Sheet for HDMI.\nCommands: /summary, /rooms, /room 109, /item keyboard, /low, /tabs, /tab Item Master, /find HDMI';

export function answerStockQuestion(message: string, entries: StockEntry[], lowThreshold = 5): string {
  const pressed = clean(message.replace(/@[A-Za-z0-9_]+/g, ''));
  const shortcuts: Record<string, string> = {
    '📊 Stock overview': '/summary',
    '🏠 Show rooms': '/rooms',
    '⚠️ Low stock': '/low',
    '❓ Help': '/help',
    'How many items do we have in total?': '/summary',
    'Which items are low or out of stock?': '/low',
  };
  const query = shortcuts[pressed] || (pressed.startsWith('📍 ') ? `/room ${pressed.slice(3)}` : pressed);
  if (query === '🔎 Find an item') return 'Type /item followed by a name, for example: /item keyboard';
  if (!query || /^\/(start|help|menu)(\s|$)/i.test(query)) return help;
  if (!entries.length) return 'No inventory items were found in the Sheet.';

  const rooms = [...new Set(entries.map(entry => entry.room))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const explicitRoom = query.match(/^\/room\s+(.+)$/i)?.[1];
  const mentionedRoom = rooms.find(room => mentions(query, room)) ||
    rooms.find(room => /\b(?:room|class|location)\b/i.test(query) && key(query).includes(key(room)));
  const requestedRoom = explicitRoom || mentionedRoom ||
    query.match(/\b(?:room|class|location)\s+(\d+[a-z]?)\b/i)?.[1];
  const matchingRooms = requestedRoom
    ? rooms.filter(room => key(room) === key(requestedRoom) || key(room).includes(key(requestedRoom)))
    : [];
  const itemNames = [...new Set(entries.map(entry => entry.item))].sort((a, b) => b.length - a.length);
  const explicitItem = query.match(/^\/item\s+(.+)$/i)?.[1];
  const mentionedItem = itemNames.find(item => mentions(query, item));
  const itemTerm = explicitItem || mentionedItem ||
    query.match(/^(?:how many|where (?:is|are)|find|do we have)\s+(.+?)(?:\?|$)/i)?.[1];

  if (/^\/rooms?$/i.test(query) || /^(list|show) (all )?rooms?$/i.test(query) ||
      (!requestedRoom && !itemTerm && /\b(?:which|what|list|show)\b.*\brooms?\b/i.test(query))) {
    return `Stock rooms (${rooms.length}):\n${rooms.map(room => `• ${room}`).join('\n')}`.slice(0, 4000);
  }
  if (/^\/summary$/i.test(query) || /^(stock )?(summary|overview|total)$/i.test(query) ||
      (!requestedRoom && !mentionedItem &&
        (/\b(?:summary|overview|total|overall|altogether)\b/i.test(query) ||
          /\bhow many\b.*\b(?:items?|units?)\b/i.test(query)))) {
    const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const empty = entries.filter(entry => entry.quantity <= 0).length;
    return `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} · ${entries.length} ${entries.length === 1 ? 'item row' : 'item rows'} · ${total} units\nOut of stock: ${empty} ${empty === 1 ? 'item row' : 'item rows'}.\nUse /rooms, /room ${rooms[0]}, /item keyboard, or /low.`;
  }
  if (/^\/low$/i.test(query) || /\b(low|out of stock|missing|zero stock)\b/i.test(query)) {
    const low = entries.filter(entry => entry.quantity <= lowThreshold &&
      (!requestedRoom || matchingRooms.includes(entry.room)) &&
      (!mentionedItem || mentions(entry.item, mentionedItem))).sort((a, b) => a.quantity - b.quantity);
    if (requestedRoom && !matchingRooms.length) return `I couldn't find room “${clean(requestedRoom)}”. Use /rooms to see names.`;
    return low.length
      ? `Low stock (≤${lowThreshold} per item row${requestedRoom ? ` in ${matchingRooms.join(', ')}` : ''}):\n${low.map(entry => `• ${entry.item} — ${entry.quantity} in ${entry.room}`).join('\n')}`.slice(0, 4000)
      : `No item rows${requestedRoom ? ` in ${matchingRooms.join(', ')}` : ''} are at or below ${lowThreshold}.`;
  }

  if (requestedRoom && !matchingRooms.length) return `I couldn't find room “${clean(requestedRoom)}”. Use /rooms to see names.`;
  if (itemTerm) {
    const term = key(itemTerm.replace(/\b(?:do we have|in stock)\b/gi, ''));
    const matches = entries.filter(entry =>
      (key(entry.item).includes(term) || singular(key(entry.item)).includes(singular(term))) &&
      (!requestedRoom || matchingRooms.includes(entry.room)));
    if (!matches.length) return `I couldn't find “${clean(itemTerm)}”${requestedRoom ? ` in ${matchingRooms.join(', ')}` : ' in stock'}.`;
    const total = matches.reduce((sum, entry) => sum + entry.quantity, 0);
    return `${total} ${total === 1 ? 'unit' : 'units'} matching “${clean(itemTerm)}”${requestedRoom ? ` in ${matchingRooms.join(', ')}` : ''}:\n${matches.map(entry => `• ${entry.item}: ${entry.quantity} in ${entry.room}`).join('\n')}`.slice(0, 4000);
  }
  if (requestedRoom) {
    const lines = matchingRooms.flatMap(room => {
      const items = entries.filter(entry => entry.room === room);
      return [`${room} (${items.reduce((sum, entry) => sum + entry.quantity, 0)} units):`, ...items.map(entry => `• ${entry.item}: ${entry.quantity}`)];
    });
    return lines.join('\n').slice(0, 4000);
  }
  return help;
}
