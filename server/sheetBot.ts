export type SheetTab = { name: string; rows: string[][]; readable: boolean };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const norm = (value: string) => clean(value).toLocaleLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matchesWord = (text: string, word: string) => {
  const root = norm(word).replace(/s$/, '');
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(root)}s?($|[^a-z0-9])`, 'i').test(text);
};
const body = (tab: SheetTab) => {
  const grouped = /^(class name|location|room)$/i.test(clean(tab.rows[0]?.[0] || ''));
  let currentRoom = '';
  return tab.rows.slice(1).flatMap((row, index) => {
    if (!row.some(cell => clean(cell || ''))) return [];
    const values = [...row];
    if (grouped) {
      currentRoom = clean(values[0] || '') || currentRoom;
      if (!values[0]) values[0] = currentRoom;
    }
    return [{ values, rowNumber: index + 2 }];
  });
};

type TypeRecord = { tab: string; type: string; room: string; item: string; category: string; quantity: number | null };

function typeRecords(tabs: SheetTab[]): TypeRecord[] {
  return tabs.filter(tab => tab.readable).flatMap(tab => {
    const headers = (tab.rows[0] || []).map(norm);
    const dropdown = norm(tab.name) === 'dropdowns';
    const typeIndex = dropdown ? headers.indexOf('value') : headers.findIndex(header => /^(type\/model|default type)$/.test(header));
    if (typeIndex < 0) return [];
    const itemIndex = headers.indexOf('item name');
    const quantityIndex = headers.indexOf('quantity');
    const categoryIndex = headers.indexOf('category') >= 0 ? headers.indexOf('category') : headers.indexOf('default tag');
    return body(tab).flatMap(row => {
      if (dropdown && norm(row.values[0] || '') !== 'type') return [];
      const type = clean(row.values[typeIndex] || '');
      if (!type) return [];
      return [{
        tab: tab.name,
        type,
        room: /^(class name|location|room)$/.test(headers[0] || '') ? clean(row.values[0] || '') : '',
        item: itemIndex >= 0 ? clean(row.values[itemIndex] || '') : '',
        category: dropdown ? clean(row.values[2] || '') : categoryIndex >= 0 ? clean(row.values[categoryIndex] || '') : '',
        quantity: quantityIndex >= 0 ? Number(row.values[quantityIndex]) || 0 : null,
      }];
    });
  });
}

function typeAnswer(query: string, tabs: SheetTab[]): string | null {
  const records = typeRecords(tabs);
  const modelsOnly = /^\/models?$/i.test(query) || query === '💻 Models' ||
    /^(?:show|list|what are) (?:the )?models(?: available)?\??$/i.test(query);
  if (modelsOnly || /^\/types?$/i.test(query) || query === '🔽 Browse types' || query === '🔽 Types' ||
      /\b(?:which|what|list|show)\b.*\b(?:types|models)\b.*\b(?:available|exist|have|sheet)?\b/i.test(query)) {
    const counts = new Map<string, { name: string; count: number }>();
    for (const record of modelsOnly ? records.filter(record => norm(record.tab) !== 'dropdowns') : records) {
      const id = norm(record.type);
      const current = counts.get(id);
      counts.set(id, { name: current?.name || record.type, count: (current?.count || 0) + 1 });
    }
    const values = [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const heading = modelsOnly ? '💻 Models in inventory & templates' : '🔽 Types & models';
    return values.length
      ? `${heading}\n${values.length} values found\n\n${values.map(value => `• ${value.name} · ${value.count} ${value.count === 1 ? 'row' : 'rows'}`).join('\n')}\n\nSearch: /type Acer Core5`
      : `${heading}\n\nNo values found in the Sheet.`;
  }

  const explicit = query.match(/^\/type\s+(.+)$/i)?.[1] ||
    query.match(/\b(?:find|search|look up)\s+(?:for\s+)?(?:type|model)\s+(.+?)(?:\?|$)/i)?.[1];
  const known = [...new Set(records.map(record => record.type))].sort((a, b) => b.length - a.length)
    .find(value => matchesWord(query, value));
  const term = explicit?.replace(/\s+in\s+(?:room|class)\s+\d+[a-z]?$/i, '') ||
    (/\b(?:type|model)\b/i.test(query) ? known : undefined);
  if (!term) return null;
  const room = query.match(/\b(?:room|class)\s+(\d+[a-z]?)\b/i)?.[1];
  const found = records.filter(record => norm(record.type).includes(norm(term)) && (!room || norm(record.room) === norm(room)));
  if (!found.length) return `I couldn't find Type/Model “${clean(term)}”${room ? ` in room ${room}` : ''}. Use /types to see available values.`;
  const grouped = new Map<string, { record: TypeRecord; count: number; units: number }>();
  for (const record of found) {
    const id = [record.tab, record.room, record.item, record.category, record.type].map(norm).join('|');
    const current = grouped.get(id);
    grouped.set(id, { record, count: (current?.count || 0) + 1, units: (current?.units || 0) + (record.quantity || 0) });
  }
  const sections = new Map<string, string[]>();
  for (const { record, count, units } of grouped.values()) {
    const detail = [record.room, record.item, record.category].filter(Boolean).join(' · ') || 'Value';
    const amount = record.quantity !== null ? `${units} ${units === 1 ? 'unit' : 'units'}` : count > 1 ? `${count} rows` : '';
    const lines = sections.get(record.tab) || [];
    lines.push(`• ${detail} — ${record.type}${amount ? ` · ${amount}` : ''}`);
    sections.set(record.tab, lines);
  }
  const shown = [...sections.entries()].map(([name, lines]) => `${name}\n${lines.join('\n')}`);
  return `🔽 Type / Model: ${clean(term)}\n${found.length} matching ${found.length === 1 ? 'row' : 'rows'}${room ? ` · room ${room}` : ''}\n\n${shown.join('\n\n')}`;
}

function rowText(tab: SheetTab, values: string[]): string {
  const headers = tab.rows[0] || [];
  const labels: Record<string, string> = {
    'class name': 'Room', location: 'Room', 'item name': 'Item', quantity: 'Qty',
    'type/model': 'Type', 'default type': 'Type', 'default tag': 'Tag',
    'parent tag': 'Tag', 'last updated': 'Updated', hostname: 'Host',
  };
  const fields = values.map((value, index) => {
    const header = clean(headers[index] || `Column ${index + 1}`);
    return { label: labels[norm(header)] || header, value: clean(value || '') };
  })
    .filter(field => field.value);
  if (fields.length === 1) return fields[0].value;
  const lead = fields.slice(0, 3).map(field => `${field.label}: ${field.value}`).join(' · ');
  const detail = fields.slice(3).map(field => `${field.label}: ${field.value}`).join(' · ');
  return `${lead}${detail ? `\n   ${detail}` : ''}`;
}

function tabAnswer(tab: SheetTab, page: number, term?: string): string {
  if (!tab.readable) return `📄 ${tab.name}\n\nThis dashboard has no readable cells.`;
  const rows = body(tab);
  const selected = term ? rows.filter(row => row.values.some(value => matchesWord(value || '', term))) : rows;
  if (!selected.length) return term ? `No rows in ${tab.name} match “${term}”.` : `${tab.name} has no data rows.`;
  const pageSize = 10;
  const pages = Math.ceil(selected.length / pageSize);
  if (page > pages) return `${tab.name} has ${pages} page${pages === 1 ? '' : 's'}. Use /tab ${tab.name} ${pages}.`;
  const start = (page - 1) * pageSize;
  const lines = selected.slice(start, start + pageSize).map(row => `• ${row.rowNumber}. ${rowText(tab, row.values)}`);
  const next = page < pages ? `\n\nNext page: /tab ${tab.name} ${page + 1}` : '';
  return `📄 ${tab.name}${term ? ` · ${term}` : ''}\nPage ${page}/${pages} · ${selected.length} ${selected.length === 1 ? 'row' : 'rows'}\n\n${lines.join('\n')}${next}`;
}

function namedTab(query: string, tabs: SheetTab[]): SheetTab | undefined {
  const exact = tabs.slice().sort((a, b) => b.name.length - a.name.length)
    .find(tab => norm(query).includes(norm(tab.name)) &&
      (/\b(?:tab|sheet|template|default|dropdown|master)\b/i.test(query) ||
        !/^(class|stock room)$/i.test(tab.name)));
  if (exact) return exact;
  const aliases: [RegExp, string][] = [
    [/\bitem master\b|\bitem names?\b|^🧾 Item names$/i, 'Item Master'],
    [/\blab[_ ](?:default|template)\b|\b(?:default|template)\b.*\blab\b/i, 'Lab_Template'],
    [/\bclass[_ ]template\b|\bclass\b.*\b(?:default|template)\b|\b(?:default|template)\b.*\bclass\b/i, 'Class_Template'],
    [/\bdropdowns?\b/i, 'Dropdowns'],
  ];
  for (const [pattern, alias] of aliases) {
    if (pattern.test(query)) {
      const tab = tabs.find(candidate => norm(candidate.name) === norm(alias));
      if (tab) return tab;
    }
  }
  return undefined;
}

function fieldAnswer(query: string, tabs: SheetTab[]): string | null {
  const fields: [RegExp, string][] = [
    [/\bhostname\b|\bhost name\b/i, 'Hostname'],
    [/\bsnid\b|\bserial(?: number)?\b/i, 'SNID'],
    [/\btype\b|\bmodel\b/i, 'Type/Model'],
    [/\bcategory\b/i, 'Category'],
    [/\bstatus\b/i, 'Status'],
    [/\blast updated\b|\bupdated when\b/i, 'Last Updated'],
  ];
  const field = fields.find(([pattern]) => pattern.test(query))?.[1];
  if (!field) return null;
  const room = query.match(/\b(?:room|class|location)\s+(\d+[a-z]?)\b/i)?.[1];
  const inventory = tabs.filter(tab => /^(class|classes|stock room)$/i.test(tab.name));
  const names = [...new Set(inventory.flatMap(tab => body(tab).map(row => clean(row.values[1] || ''))))]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  const item = names.find(name => matchesWord(query, name));
  if (!item && !room) return null;
  const found: string[] = [];
  for (const tab of inventory) {
    let currentRoom = '';
    const fieldIndex = (tab.rows[0] || []).findIndex(header => norm(header) === norm(field));
    if (fieldIndex < 0) continue;
    for (const row of body(tab)) {
      currentRoom = clean(row.values[0] || '') || currentRoom;
      if (room && norm(currentRoom) !== norm(room)) continue;
      if (item && !matchesWord(row.values[1] || '', item)) continue;
      found.push(`• ${currentRoom} · ${clean(row.values[1] || '')}: ${clean(row.values[fieldIndex] || '') || '(blank)'}`);
    }
  }
  if (!found.length) return `No ${field.toLowerCase()} record matches${item ? ` ${item}` : ''}${room ? ` in room ${room}` : ''}.`;
  return `🔎 ${field}${item ? ` · ${item}` : ''}${room ? ` · room ${room}` : ''}\n${found.length} ${found.length === 1 ? 'row' : 'rows'}\n\n${found.slice(0, 20).join('\n')}${found.length > 20 ? `\n…${found.length - 20} more rows` : ''}`;
}

export function answerSheetQuestion(message: string, tabs: SheetTab[]): string | null {
  const query = clean(message.replace(/@[A-Za-z0-9_]+/g, ''));
  if (!query) return null;
  const typeResult = typeAnswer(query, tabs);
  if (typeResult) return typeResult;
  if (/^\/tabs?$/i.test(query) || query === '📄 All sheet tabs' || query === '📄 Sheet tabs' ||
      /\b(?:which|what|list|show)\b.*\b(?:sheet tabs|tabs in the sheet)\b/i.test(query)) {
    return `📄 Sheet tabs\n${tabs.length} tabs\n\n${tabs.map(tab => `• ${tab.name}${tab.readable ? ` — ${body(tab).length} ${body(tab).length === 1 ? 'row' : 'rows'}` : ' — dashboard'}`).join('\n')}\n\nOpen: /tab Item Master`;
  }

  const command = query.match(/^\/tab\s+(.+)$/i);
  if (command) {
    const exact = tabs.find(candidate => norm(candidate.name) === norm(command[1]));
    if (exact) return tabAnswer(exact, 1);
    const page = command[1].match(/^(.+?)\s+(\d+)$/);
    const tab = tabs.find(candidate => norm(candidate.name) === norm(page?.[1] || command[1]));
    return tab ? tabAnswer(tab, Math.max(1, Number(page?.[2]) || 1)) : `I couldn't find tab “${command[1]}”. Use /tabs to see names.`;
  }

  const search = query.match(/^\/(?:find|search)\s+(.+)$/i)?.[1] ||
    query.match(/\b(?:find|search|look up)\s+(?:the (?:(?:whole|entire) )?sheet\s+)?(?:for\s+)?[“"]?(.+?)[”"]?\??$/i)?.[1];
  if (search) {
    const term = clean(search.replace(/\?$/, '').replace(/\s+(?:across|in)\s+(?:all\s+)?(?:tabs|the sheet)$/i, ''));
    const results = tabs.filter(tab => tab.readable).flatMap(tab =>
      body(tab).filter(row => row.values.some(value => matchesWord(value || '', term)))
        .map(row => ({ tab: tab.name, text: `• Row ${row.rowNumber} · ${rowText(tab, row.values)}` })));
    const sections = new Map<string, string[]>();
    for (const result of results.slice(0, 15)) sections.set(result.tab, [...(sections.get(result.tab) || []), result.text]);
    const lines = [...sections.entries()].map(([name, rows]) => `${name}\n${rows.join('\n')}`).join('\n\n');
    return results.length
      ? `🔎 Search: ${term}\n${results.length} matching ${results.length === 1 ? 'row' : 'rows'}\n\n${lines}${results.length > 15 ? `\n\n…${results.length - 15} more rows. Try a narrower search.` : ''}`
      : `🔎 Search: ${term}\n\nNo matching rows in the Sheet.`;
  }

  const tab = namedTab(query, tabs);
  if (tab) {
    const candidates = [...new Set(body(tab).flatMap(row => row.values.map(value => clean(value || ''))))].filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const term = candidates.find(name => matchesWord(query, name) && norm(name) !== norm(tab.name));
    return tabAnswer(tab, 1, term);
  }

  return fieldAnswer(query, tabs);
}
