export type StockEntry = { room: string; item: string; quantity: number; status: string };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const key = (value: string) => clean(value).toLocaleLowerCase();

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

const help = 'Ask about stock:\n/summary — total rooms and items\n/rooms — room list\n/room 106 — items in a room\n/item keyboard — quantity and rooms\n/low — items with 5 or fewer\nYou can also ask “What is in room 106?” or “How many keyboards?”';

export function answerStockQuestion(message: string, entries: StockEntry[], lowThreshold = 5): string {
  const query = clean(message.replace(/@[A-Za-z0-9_]+/g, ''));
  if (!query || /^\/(start|help)(\s|$)/i.test(query)) return help;
  if (!entries.length) return 'No stock items were found in the Stock Room sheet.';

  const rooms = [...new Set(entries.map(entry => entry.room))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (/^\/rooms?$/i.test(query) || /^(list|show) (all )?rooms?$/i.test(query)) {
    return `Stock rooms (${rooms.length}):\n${rooms.map(room => `• ${room}`).join('\n')}`.slice(0, 4000);
  }
  if (/^\/summary$/i.test(query) || /^(stock )?(summary|overview|total)$/i.test(query)) {
    const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const empty = entries.filter(entry => entry.quantity <= 0).length;
    return `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} · ${entries.length} ${entries.length === 1 ? 'item row' : 'item rows'} · ${total} units\nOut of stock: ${empty} ${empty === 1 ? 'item row' : 'item rows'}.\nUse /rooms, /room ${rooms[0]}, /item keyboard, or /low.`;
  }
  if (/^\/low$/i.test(query) || /\b(low|out of stock|missing|zero stock)\b/i.test(query)) {
    const low = entries.filter(entry => entry.quantity <= lowThreshold).sort((a, b) => a.quantity - b.quantity);
    return low.length
      ? `Low stock (≤${lowThreshold} per item row):\n${low.map(entry => `• ${entry.item} — ${entry.quantity} in ${entry.room}`).join('\n')}`.slice(0, 4000)
      : `No item rows are at or below ${lowThreshold}.`;
  }

  const roomTerm = query.match(/^\/room\s+(.+)$/i)?.[1] ||
    query.match(/(?:in|inside|at) (?:the )?room\s+(.+?)(?:\?|$)/i)?.[1] ||
    query.match(/^(?:room|what is in)\s+(.+?)(?:\?|$)/i)?.[1];
  if (roomTerm) {
    const matches = rooms.filter(room => key(room) === key(roomTerm) || key(room).includes(key(roomTerm)));
    if (!matches.length) return `I couldn't find room “${clean(roomTerm)}”. Use /rooms to see names.`;
    const lines = matches.flatMap(room => {
      const items = entries.filter(entry => entry.room === room);
      return [`${room} (${items.reduce((sum, entry) => sum + entry.quantity, 0)} units):`, ...items.map(entry => `• ${entry.item}: ${entry.quantity}`)];
    });
    return lines.join('\n').slice(0, 4000);
  }

  const itemTerm = query.match(/^\/item\s+(.+)$/i)?.[1] ||
    query.match(/^(?:how many|where (?:is|are)|find|do we have)\s+(.+?)(?:\?|$)/i)?.[1];
  if (itemTerm) {
    const term = key(itemTerm.replace(/\b(?:do we have|in stock)\b/gi, ''));
    const singular = term.endsWith('s') ? term.slice(0, -1) : term;
    const matches = entries.filter(entry => key(entry.item).includes(term) || key(entry.item).includes(singular));
    if (!matches.length) return `I couldn't find “${clean(itemTerm)}” in stock.`;
    const total = matches.reduce((sum, entry) => sum + entry.quantity, 0);
    return `${total} units matching “${clean(itemTerm)}”:\n${matches.map(entry => `• ${entry.item}: ${entry.quantity} in ${entry.room}`).join('\n')}`.slice(0, 4000);
  }
  return help;
}
