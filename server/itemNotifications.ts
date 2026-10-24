// Only inventory fields are admitted. Never spread request/session/person data into alerts.
export type Item = { row: number; tab: string; item: string; quantity: string; location: string;
  tag: string; type: string; hostname: string; snid: string; status: string };
export type Snapshot = { id: number; name: string; rows: string[][] };
export type Change = { action: 'added' | 'edited' | 'deleted' | 'moved'; before?: Item; after?: Item; quantity?: string };
const fields = ['item', 'quantity', 'location', 'tag', 'type', 'hostname', 'snid', 'status'] as const;
const labels = { item: 'Item', quantity: 'Quantity', location: 'Location', tag: 'Category', type: 'Type/model', hostname: 'Hostname', snid: 'Code/SNID', status: 'Status' };

export function inventoryRows(sheet: Snapshot): Item[] {
  const legacy = /^(item|item name)$/i.test(String(sheet.rows[0]?.[0] || '').trim());
  let location = '';
  return sheet.rows.flatMap((r, row) => {
    if (row === 0) return [];
    const cell = (i: number) => String(r[i] ?? '').trim();
    location = legacy ? cell(8) : cell(0) || location;
    const item = cell(legacy ? 0 : 1);
    if (!item) return [];
    return [{ row, tab: sheet.name, item, quantity: cell(legacy ? 1 : 2) || '0', location: location || 'Uncategorized',
      tag: cell(legacy ? 2 : 3), type: cell(legacy ? 3 : 4), hostname: cell(legacy ? 6 : 5),
      snid: cell(legacy ? 7 : 6), status: cell(legacy ? 5 : 8) }];
  });
}

export function changesBetween(before: Snapshot[], after: Snapshot[], requests: any[] = []): Change[] {
  const changes: Change[] = [];
  for (const oldSheet of before) {
    const newSheet = after.find(s => s.id === oldSheet.id);
    const oldItems = inventoryRows(oldSheet);
    // Track physical row shifts, so deleting/inserting one row never reports edits to its neighbours.
    const positions: Array<number | null> = oldSheet.rows.map((_, i) => i);
    for (const request of requests) {
      const insertion = request.insertDimension?.range;
      const deletion = request.deleteDimension?.range;
      if (insertion?.sheetId === oldSheet.id && insertion.dimension === 'ROWS') {
        positions.splice(insertion.startIndex, 0, ...Array(insertion.endIndex - insertion.startIndex).fill(null));
      }
      if (deletion?.sheetId === oldSheet.id && deletion.dimension === 'ROWS') {
        positions.splice(deletion.startIndex, deletion.endIndex - deletion.startIndex);
      }
    }
    const remaining = new Map((newSheet ? inventoryRows(newSheet) : []).map(i => [i.row, i]));
    for (const previous of oldItems) {
      const newRow = positions.indexOf(previous.row);
      const next = remaining.get(newRow);
      if (next) {
        remaining.delete(newRow);
        if (fields.some(f => previous[f] !== next[f])) changes.push({ action: previous.location !== next.location ? 'moved' : 'edited', before: previous, after: next });
      } else changes.push({ action: 'deleted', before: previous });
    }
    for (const next of remaining.values()) changes.push({ action: 'added', after: next });
  }
  for (const sheet of after.filter(s => !before.some(b => b.id === s.id))) {
    for (const next of inventoryRows(sheet)) changes.push({ action: 'added', after: next });
  }
  // An atomic transfer is an addition plus a removal/decrease. Fold it into one movement.
  for (const addition of [...changes].filter(c => c.action === 'added')) {
    const to = addition.after!;
    const source = changes.find(c => c !== addition && c.before &&
      (c.before.location !== to.location || c.before.tab !== to.tab) &&
      ['item', 'tag', 'type', 'hostname', 'snid', 'status'].every(f => c.before![f] === to[f]) &&
      ((c.action === 'deleted' && c.before.quantity === to.quantity) ||
       (c.action === 'edited' && c.after && fields.filter(f => f !== 'quantity').every(f => c.before![f] === c.after![f]) &&
        Number(c.before.quantity) - Number(c.after.quantity) === Number(to.quantity))));
    if (source) {
      changes.splice(changes.indexOf(source), 1);
      addition.action = 'moved'; addition.before = source.before; addition.quantity = to.quantity;
    }
  }
  return changes;
}

const clean = (value: string) => value.replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 180) || '(empty)';
export function notificationMessages(changes: Change[], at = new Date()): string[] {
  if (!changes.length) return [];
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', dateStyle: 'medium', timeStyle: 'medium' }).format(at);
  const footer = `\nTime: ${time} (Asia/Phnom_Penh)`;
  const blocks = changes.map(c => {
    const item = c.after || c.before!;
    const lines = [
      `📦 Item ${c.action}`,
      `Item: ${clean(item.item)}`,
      ...(c.action === 'edited' ? [`From: ${clean(item.tab)} = ${clean(item.location)}`] : []),
      ...(item.snid ? [`Code: ${clean(item.snid)}`] : []),
      `Quantity: ${clean(c.quantity || item.quantity)}`,
    ];
    if (c.action === 'moved') lines.push(`From: ${clean(c.before!.location)}`, `To: ${clean(c.after!.location)}`);
    if (c.before && c.after) for (const f of fields) {
      if (c.before[f] !== c.after[f] && !(c.action === 'moved' && (f === 'location' || (f === 'quantity' && c.quantity)))) {
        lines.push(`${labels[f]}: ${clean(c.before[f])} → ${clean(c.after[f])}`);
      }
    }
    return lines.join('\n');
  });
  const messages: string[] = [];
  const heading = changes.length > 1 ? `📦 Bulk inventory changes: ${changes.length}\n\n` : '';
  let current = heading;
  for (const block of blocks) {
    if (current.length + block.length + footer.length > 3900) { messages.push(current.trimEnd() + footer); current = heading; }
    current += block + '\n\n';
  }
  if (current.trim()) messages.push(current.trimEnd() + footer);
  return messages;
}

export type TelegramConfig = { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_ALLOWED_GROUP_IDS?: string; TELEGRAM_NOTIFICATION_CHAT_IDS?: string };
export async function sendItemNotifications(env: TelegramConfig, messages: string[]): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chats = [...new Set((env.TELEGRAM_NOTIFICATION_CHAT_IDS ?? env.TELEGRAM_ALLOWED_GROUP_IDS ?? '').split(',').map(s => s.trim()).filter(s => /^-?\d+$/.test(s)))];
  if (!token || !chats.length || !messages.length) return;
  // Total background work is bounded, including large multi-part summaries. No retries:
  // Telegram has no idempotency key, so a timed-out delivery must never be resent automatically.
  const signal = AbortSignal.timeout(20_000);
  await Promise.all(chats.map(async chat_id => {
    for (const text of messages) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text }), signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok || !(await response.json() as { ok?: boolean }).ok) throw new Error();
      } catch { console.warn('Item notification delivery failed'); break; }
    }
  }));
}
