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

function rowText(tab: SheetTab, values: string[]): string {
  const headers = tab.rows[0] || [];
  const fields = values.map((value, index) => ({ label: clean(headers[index] || `Column ${index + 1}`), value: clean(value || '') }))
    .filter(field => field.value);
  return fields.map(field => `${field.label}: ${field.value}`).join(' · ');
}

function tabAnswer(tab: SheetTab, page: number, term?: string): string {
  if (!tab.readable) return `${tab.name} is a dashboard tab with no readable cells.`;
  const rows = body(tab);
  const selected = term ? rows.filter(row => row.values.some(value => matchesWord(value || '', term))) : rows;
  if (!selected.length) return term ? `No rows in ${tab.name} match “${term}”.` : `${tab.name} has no data rows.`;
  const pageSize = 10;
  const pages = Math.ceil(selected.length / pageSize);
  if (page > pages) return `${tab.name} has ${pages} page${pages === 1 ? '' : 's'}. Use /tab ${tab.name} ${pages}.`;
  const start = (page - 1) * pageSize;
  const lines = selected.slice(start, start + pageSize).map(row => `• Row ${row.rowNumber}: ${rowText(tab, row.values)}`);
  const next = page < pages ? `\nNext: /tab ${tab.name} ${page + 1}` : '';
  return `${tab.name}${term ? ` matching “${term}”` : ''} (${selected.length} rows, page ${page}/${pages}):\n${lines.join('\n')}${next}`.slice(0, 4000);
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
  return `${field}${item ? ` for ${item}` : ''}${room ? ` in room ${room}` : ''}:\n${found.slice(0, 20).join('\n')}${found.length > 20 ? `\n…${found.length - 20} more rows` : ''}`.slice(0, 4000);
}

export function answerSheetQuestion(message: string, tabs: SheetTab[]): string | null {
  const query = clean(message.replace(/@[A-Za-z0-9_]+/g, ''));
  if (!query) return null;
  if (/^\/tabs?$/i.test(query) || query === '📄 All sheet tabs' ||
      /\b(?:which|what|list|show)\b.*\b(?:sheet tabs|tabs in the sheet)\b/i.test(query)) {
    return `Sheet tabs:\n${tabs.map(tab => `• ${tab.name}${tab.readable ? ` — ${body(tab).length} data rows` : ' — dashboard'}`).join('\n')}\nUse /tab followed by a name to browse rows.`.slice(0, 4000);
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
        .map(row => `• ${tab.name}, row ${row.rowNumber}: ${rowText(tab, row.values)}`));
    return results.length
      ? `Found “${term}” in ${results.length} rows:\n${results.slice(0, 15).join('\n')}${results.length > 15 ? `\n…${results.length - 15} more rows. Narrow your search.` : ''}`.slice(0, 4000)
      : `I couldn't find “${term}” in the Sheet.`;
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
