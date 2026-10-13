export type StockPdfItem = {
  room: string;
  item: string;
  quantity: number;
  type?: string;
  hostname?: string;
  snid?: string;
};

type Page = { content: string[]; y: number };

const pageWidth = 842;
const pageHeight = 595;
const left = 32;
const right = pageWidth - left;
const tableWidths = [25, 180, 135, 175, 60, 70, 133];
const tableHeaders = ['#', 'Item name', 'Type / model', 'Hostname / serial', 'Sheet qty', 'Counted', 'Notes / difference'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function printable(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, '?');
}

function pdfString(value: string): string {
  return printable(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function short(value: string, width: number, size: number): string {
  const clean = printable(value).replace(/\s+/g, ' ').trim();
  const limit = Math.max(4, Math.floor(width / (size * 0.57)));
  return clean.length > limit ? `${clean.slice(0, limit - 3)}...` : clean;
}

function text(page: Page, value: string, x: number, y: number, size = 9, bold = false, color = '0.14 0.25 0.40'): void {
  page.content.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${pdfString(value)}) Tj ET`);
}

function rectangle(page: Page, x: number, y: number, width: number, height: number, fill: string): void {
  page.content.push(`${fill} rg ${x} ${y} ${width} ${height} re f`);
}

function line(page: Page, x1: number, y1: number, x2: number, y2: number): void {
  page.content.push(`0.81 0.87 0.93 RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
}

function makePage(monthLabel: string, snapshotLabel: string, first: boolean): Page {
  const page: Page = { content: [], y: first ? 491 : 515 };
  rectangle(page, 0, first ? 541 : 552, pageWidth, first ? 54 : 43, '0.09 0.20 0.36');
  text(page, first ? 'MONTHLY STOCK INVENTORY' : 'MONTHLY STOCK INVENTORY - CONTINUED', left, first ? 567 : 569, first ? 19 : 13, true, '1 1 1');
  text(page, monthLabel, left, first ? 550 : 557, 10, true, '1 1 1');
  text(page, `Snapshot: ${snapshotLabel}`, 625, first ? 559 : 560, 8, false, '1 1 1');
  return page;
}

function tableHeader(page: Page): void {
  const top = page.y;
  rectangle(page, left, top - 21, right - left, 21, '0.17 0.38 0.61');
  let x = left;
  tableHeaders.forEach((heading, index) => {
    text(page, heading, x + 5, top - 14, 8, true, '1 1 1');
    x += tableWidths[index];
  });
  page.y -= 21;
}

function roomHeader(page: Page, room: string, rows: number, units: number, continued = false): void {
  const top = page.y;
  rectangle(page, left, top - 24, right - left, 24, '0.90 0.95 0.99');
  text(page, short(`${room}${continued ? ' (continued)' : ''}`, 500, 10), left + 6, top - 16, 10, true);
  text(page, `${rows} rows / ${units} units`, right - 125, top - 16, 8);
  page.y -= 30;
  tableHeader(page);
}

function itemRow(page: Page, cells: string[], shaded: boolean): void {
  const top = page.y;
  if (shaded) rectangle(page, left, top - 22, right - left, 22, '0.97 0.98 0.99');
  let x = left;
  cells.forEach((cell, index) => {
    text(page, short(cell, tableWidths[index] - 10, 8), x + 5, top - 14, 8);
    x += tableWidths[index];
    line(page, x, top, x, top - 22);
  });
  line(page, left, top - 22, right, top - 22);
  page.y -= 22;
}

function encodePdf(pages: Page[]): Uint8Array {
  const objects = [''];
  const reserve = () => { objects.push(''); return objects.length - 1; };
  const catalog = reserve();
  const pageTree = reserve();
  const font = reserve();
  const boldFont = reserve();
  objects[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[boldFont] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const pageRefs: number[] = [];
  pages.forEach((page, index) => {
    text(page, 'Live Sheet snapshot - not a historical month-end balance.', left, 23, 7, false, '0.43 0.51 0.62');
    text(page, `${index + 1} / ${pages.length}`, right - 25, 23, 7, false, '0.43 0.51 0.62');
    const stream = page.content.join('\n') + '\n';
    const content = reserve();
    objects[content] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
    const pageId = reserve();
    objects[pageId] = `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${font} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${content} 0 R >>`;
    pageRefs.push(pageId);
  });
  objects[catalog] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
  objects[pageTree] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(id => `${id} 0 R`).join(' ')}] >>`;
  let output = '%PDF-1.4\n%Quick Stock\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = output.length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

export function createMonthlyStockPdf(month: string, items: StockPdfItem[], snapshotDate = new Date()): Uint8Array {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Use a month in YYYY-MM format.');
  const monthLabel = `${monthNames[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  const localDate = new Date(snapshotDate.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const snapshotLabel = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())} ${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())} ICT`;
  const groups = new Map<string, StockPdfItem[]>();
  for (const item of items) {
    const room = item.room.trim() || 'Uncategorized';
    groups.set(room, [...(groups.get(room) || []), item]);
  }
  const roomNames = [...groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const pages = [makePage(monthLabel, snapshotLabel, true)];
  let page = pages[0];
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  text(page, `${roomNames.length} rooms    ${items.length} item rows    ${totalUnits} units recorded`, left, 522, 10, true);
  text(page, 'Sheet quantity is recorded below. Write the physical count and any difference during the check.', left, 506, 8);

  for (const room of roomNames) {
    const entries = groups.get(room)!;
    const units = entries.reduce((sum, item) => sum + item.quantity, 0);
    if (page.y < 115) {
      page = makePage(monthLabel, snapshotLabel, false);
      pages.push(page);
    }
    roomHeader(page, room, entries.length, units);
    entries.forEach((entry, index) => {
      if (page.y < 70) {
        page = makePage(monthLabel, snapshotLabel, false);
        pages.push(page);
        roomHeader(page, room, entries.length, units, true);
      }
      itemRow(page, [String(index + 1), entry.item, entry.type || '', [entry.hostname, entry.snid].filter(Boolean).join(' / '), String(entry.quantity), '', ''], index % 2 === 0);
    });
    page.y -= 13;
  }
  if (page.y < 75) {
    page = makePage(monthLabel, snapshotLabel, false);
    pages.push(page);
  }
  line(page, left, page.y, right, page.y);
  text(page, 'Checked by: __________________________', left, page.y - 17, 9);
  text(page, 'Date: _______________', 315, page.y - 17, 9);
  text(page, 'Approved by: ________________________', 525, page.y - 17, 9);
  return encodePdf(pages);
}
