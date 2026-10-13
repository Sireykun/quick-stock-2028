export type StockEntry = { room: string; item: string; quantity: number; status: string; type?: string; hostname?: string; snid?: string };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const key = (value: string) => clean(value).toLocaleLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const singular = (value: string) => value.endsWith('s') ? value.slice(0, -1) : value;

function mentions(query: string, name: string): boolean {
  const word = singular(key(name));
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(word)}s?($|[^a-z0-9])`, 'i').test(query);
}

export type StockMenuView = 'main' | 'items' | 'rooms';

export function stockMenuView(message: string): StockMenuView {
  const choice = clean(message.replace(/@[A-Za-z0-9_]+/g, ''));
  if (choice === '📦 Items' || choice === '🧾 Item names' || choice === '🔽 Types' ||
      choice === '💻 Models' || choice === '🔎 Search item' || choice === '🔎 Find an item' ||
      /^\/(?:item|type|types|model|models)(?:\s|$)/i.test(choice)) return 'items';
  if (choice === '🏠 Rooms' || choice === '🏠 Show rooms' || choice === '🔎 Find room' ||
      choice.startsWith('📍 ') || /^\/rooms?(?:\s|$)/i.test(choice)) return 'rooms';
  return 'main';
}

export function stockQuestionKeyboard(entries: StockEntry[], view: StockMenuView = 'main'): string[][] {
  if (view === 'items') return [
    ['🧾 Item names', '🔽 Types'],
    ['💻 Models', '🔎 Search item'],
    ['⬅️ Back'],
  ];
  const rooms = [...new Set(entries.map(entry => entry.room))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 6);
  if (view === 'rooms') return [
    ...rooms.map(room => [`📍 ${room}`]),
    ['🔎 Find room', '⬅️ Back'],
  ];
  return [
    ['📦 Items', '🏠 Rooms'],
    ['📊 Overview', '⚠️ Low stock'],
    ['📄 PDF', '📄 Sheet tabs'],
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
      if (item && room) entries.push({ room, item, quantity: Number(row[1]) || 0, status: clean(row[5] || ''), type: clean(row[3] || ''), hostname: clean(row[6] || ''), snid: clean(row[7] || '') });
    } else {
      if (clean(row[0] || '')) currentRoom = clean(row[0]);
      const item = clean(row[1] || '');
      if (item && currentRoom) entries.push({ room: currentRoom, item, quantity: Number(row[2]) || 0, status: clean(row[8] || ''), type: clean(row[4] || ''), hostname: clean(row[5] || ''), snid: clean(row[6] || '') });
    }
  }
  return entries;
}

const help = '👋 Quick Stock\n\nTry a question or command:\n/summary  Stock totals\n/rooms  Browse rooms\n/room 109  Items in a room\n/item keyboard  Find an item\n/type Acer Core5  Find a model\n/find HDMI  Search the Sheet\n/pdf  Monthly stock PDF\n\nMore: /tabs · /low · /types';

export function answerStockQuestion(message: string, entries: StockEntry[], lowThreshold = 5): string {
  const pressed = clean(message.replace(/@[A-Za-z0-9_]+/g, ''));
  const shortcuts: Record<string, string> = {
    '📊 Overview': '/summary',
    '📊 Stock overview': '/summary',
    '🏠 Rooms': '/rooms',
    '🏠 Show rooms': '/rooms',
    '⚠️ Low stock': '/low',
    '❓ Help': '/help',
    'How many items do we have in total?': '/summary',
    'Which items are low or out of stock?': '/low',
  };
  const query = shortcuts[pressed] || (pressed.startsWith('📍 ') ? `/room ${pressed.slice(3)}` : pressed);
  if (query === '📦 Items') return '📦 Items\n\nChoose Item names, Types, or Models below. To search, tap Search item.';
  if (query === '⬅️ Back') return 'Main menu\n\nChoose Items, Rooms, Overview, or Sheet tabs.';
  if (query === '🔎 Find room') return '🔎 Find a room\n\nType /room followed by a room name.\nExample: /room 1F Printer Room';
  if (query === '🔎 Search item') return '🔎 Search an item\n\nType /item followed by an item name.\nExample: /item keyboard';
  if (query === '🔎 Find an item') return '🔎 Find an item\n\nType /item followed by a name.\nExample: /item keyboard';
  if (!query || /^\/(start|help|menu)(\s|$)/i.test(query)) return help;
  if (!entries.length) return 'No inventory items were found in the Sheet.';

  const rooms = [...new Set(entries.map(entry => entry.room))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const roomDetailCommand = query.match(/^\/room\s+(.+?)(?:\s+--page\s+(\d+))?$/i);
  const explicitRoom = roomDetailCommand?.[1];
  const mentionedRoom = rooms.find(room => mentions(query, room)) ||
    rooms.find(room => /\b(?:room|class|location)\b/i.test(query) && key(query).includes(key(room)));
  const requestedRoom = explicitRoom || mentionedRoom ||
    query.match(/\b(?:room|class|location)\s+(\d+[a-z]?)\b/i)?.[1];
  const matchingRooms = requestedRoom
    ? rooms.filter(room => key(room) === key(requestedRoom) || key(room).includes(key(requestedRoom)))
    : [];
  const itemNames = [...new Set(entries.map(entry => entry.item))].sort((a, b) => b.length - a.length);
  const itemDetailCommand = query.match(/^\/item\s+(.+?)(?:\s+--page\s+(\d+))?$/i);
  const explicitItem = itemDetailCommand?.[1];
  const mentionedItem = itemNames.find(item => mentions(query, item));
  const itemTerm = explicitItem || mentionedItem ||
    query.match(/^(?:how many|where (?:is|are)|find|do we have)\s+(.+?)(?:\?|$)/i)?.[1];

  const roomPage = query.match(/^\/rooms(?:\s+(\d+))?$/i);
  if (roomPage || /^\/room$/i.test(query) || /^(list|show) (all )?rooms?$/i.test(query) ||
      (!requestedRoom && !itemTerm && /\b(?:which|what|list|show)\b.*\brooms?\b/i.test(query))) {
    const pageSize = 8;
    const pages = Math.max(1, Math.ceil(rooms.length / pageSize));
    const page = Math.max(1, Number(roomPage?.[1]) || 1);
    if (page > pages) return `🏠 Rooms\nOnly ${pages} page${pages === 1 ? '' : 's'}. Try /rooms ${pages}.`;
    const visible = rooms.slice((page - 1) * pageSize, page * pageSize);
    return `🏠 Rooms · ${page}/${pages}\n${rooms.length} total\n\n${visible.map(room => `• ${room}`).join('\n')}${page < pages ? `\n\nNext: /rooms ${page + 1}` : ''}${visible.length ? `\nOpen: /room ${visible[0]}` : ''}`;
  }
  if (/^\/summary$/i.test(query) || /^(stock )?(summary|overview|total)$/i.test(query) ||
      (!requestedRoom && !mentionedItem &&
        (/\b(?:summary|overview|total|overall|altogether)\b/i.test(query) ||
          /\bhow many\b.*\b(?:items?|units?)\b/i.test(query)))) {
    const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const empty = entries.filter(entry => entry.quantity <= 0).length;
    return `📊 Stock overview\n\n${rooms.length} rooms · ${entries.length} item rows\n${total} units recorded\n${empty} out of stock\n\n/rooms · /low · /tabs`;
  }
  const lowPage = query.match(/^\/low(?:\s+(\d+))?$/i);
  if (lowPage || /\b(low|out of stock|missing|zero stock)\b/i.test(query)) {
    const low = entries.filter(entry => entry.quantity <= lowThreshold &&
      (!requestedRoom || matchingRooms.includes(entry.room)) &&
      (!mentionedItem || mentions(entry.item, mentionedItem))).sort((a, b) => a.quantity - b.quantity);
    if (requestedRoom && !matchingRooms.length) return `I couldn't find room “${clean(requestedRoom)}”. Use /rooms to see names.`;
    const pageSize = 8;
    const pages = Math.max(1, Math.ceil(low.length / pageSize));
    const page = Math.max(1, Number(lowPage?.[1]) || 1);
    if (page > pages) return `⚠️ Low stock\nOnly ${pages} page${pages === 1 ? '' : 's'}. Try /low ${pages}.`;
    return low.length
      ? `⚠️ Low stock · ${page}/${pages}\n${low.length} rows at ${lowThreshold} or fewer${requestedRoom ? ` · ${matchingRooms.join(', ')}` : ''}\n\n${low.slice((page - 1) * pageSize, page * pageSize).map(entry => `• ${entry.item} · ${entry.quantity}\n  ${entry.room}`).join('\n')}${page < pages && !requestedRoom ? `\n\nNext: /low ${page + 1}` : ''}`
      : `✅ No item rows${requestedRoom ? ` in ${matchingRooms.join(', ')}` : ''} are at ${lowThreshold} units or fewer.`;
  }

  if (requestedRoom && !matchingRooms.length) return `I couldn't find room “${clean(requestedRoom)}”. Use /rooms to see names.`;
  if (itemTerm) {
    const term = key(itemTerm.replace(/\b(?:do we have|in stock)\b/gi, ''));
    const matches = entries.filter(entry =>
      (key(entry.item).includes(term) || singular(key(entry.item)).includes(singular(term))) &&
      (!requestedRoom || matchingRooms.includes(entry.room)));
    if (!matches.length) return `I couldn't find “${clean(itemTerm)}”${requestedRoom ? ` in ${matchingRooms.join(', ')}` : ' in stock'}.`;
    const total = matches.reduce((sum, entry) => sum + entry.quantity, 0);
    const pageSize = 8;
    const pages = Math.ceil(matches.length / pageSize);
    const page = Math.max(1, Number(itemDetailCommand?.[2]) || 1);
    if (page > pages) return `🔎 ${clean(itemTerm)}\nOnly ${pages} page${pages === 1 ? '' : 's'}.`;
    const shown = matches.slice((page - 1) * pageSize, page * pageSize);
    return `🔎 ${clean(itemTerm)} · ${page}/${pages}\n${total} units · ${matches.length} rows${requestedRoom ? ` · ${matchingRooms.join(', ')}` : ''}\n\n${shown.map(entry => `• ${entry.item} · ${entry.quantity}\n  ${entry.room}`).join('\n')}${page < pages && explicitItem ? `\n\nNext: /item ${explicitItem} --page ${page + 1}` : ''}`;
  }
  if (requestedRoom) {
    const blocks = matchingRooms.map(room => {
      const items = entries.filter(entry => entry.room === room);
      const total = items.reduce((sum, entry) => sum + entry.quantity, 0);
      const pageSize = 8;
      const pages = Math.max(1, Math.ceil(items.length / pageSize));
      const page = Math.max(1, Number(roomDetailCommand?.[2]) || 1);
      if (page > pages) return `📍 ${room}\nOnly ${pages} page${pages === 1 ? '' : 's'}.`;
      const shown = items.slice((page - 1) * pageSize, page * pageSize);
      return `📍 ${room} · ${page}/${pages}\n${total} units · ${items.length} item rows\n\n${shown.map(entry => `• ${entry.item} · ${entry.quantity}`).join('\n')}${page < pages ? `\n\nNext: /room ${room} --page ${page + 1}` : ''}`;
    });
    return blocks.join('\n\n');
  }
  return help;
}
