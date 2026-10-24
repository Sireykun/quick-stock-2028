import type { SheetRow } from './sheets';
import { loadKhmerPdfFont, pdfText } from './pdfText';

export interface MonthlyInventoryRoom {
  name: string;
  items: SheetRow[];
}

const count = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function downloadMonthlyInventoryPdf(month: string, rooms: MonthlyInventoryRoom[], snapshotDate = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month.');
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const khmer = typeof localStorage !== 'undefined' && localStorage.getItem('quickStock_language') === 'km';
  if (khmer) await loadKhmerPdfFont();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
  const snapshotLabel = snapshotDate.toLocaleString();
  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const itemRows = sortedRooms.reduce((total, room) => total + room.items.length, 0);
  const units = sortedRooms.reduce((total, room) => total + room.items.reduce((sum, item) => sum + count(item.quantity), 0), 0);

  doc.setFillColor(23, 51, 95);
  doc.rect(0, 0, pageWidth, 41, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  if (khmer) pdfText(doc, 'បញ្ជីស្តុកប្រចាំខែ', margin, 19, 135, 17, '#ffffff'); else doc.text('MONTHLY INVENTORY', margin, 19);
  doc.setFontSize(12);
  doc.text(monthLabel, margin, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('QUICK STOCK  /  STOCK LOCATIONS', pageWidth - margin, 18, { align: 'right' });
  doc.text(`Snapshot: ${snapshotLabel}`, pageWidth - margin, 27, { align: 'right' });
  doc.setTextColor(30, 52, 83);
  doc.setFontSize(10);
  pdfText(doc, khmer ? `${sortedRooms.length} បន្ទប់    ${itemRows} ជួរទំនិញ    ${units} គ្រឿង` : `${sortedRooms.length} rooms    ${itemRows} item rows    ${units} units recorded`, margin, 49, 210, 10);
  doc.setFontSize(8);
  doc.setTextColor(94, 111, 133);
  pdfText(doc, khmer ? 'ចំនួនយកពីសន្លឹកបច្ចុប្បន្ន។ បំពេញចំនួនរាប់បាន និងកំណត់ចំណាំពេលពិនិត្យប្រចាំខែ។' : 'Quantities come from the current Sheet. Fill in Counted and Notes during the monthly check.', margin, 55, 250, 8);
  let nextY = 64;

  for (const room of sortedRooms) {
    if (nextY > pageHeight - 49) {
      doc.addPage();
      nextY = 19;
    }
    const activeItems = room.items.filter(item => !item._isDeleted && item.item.trim());
    const roomUnits = activeItems.reduce((sum, item) => sum + count(item.quantity), 0);
    doc.setFillColor(232, 242, 252);
    doc.roundedRect(margin, nextY - 5, pageWidth - margin * 2, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 66, 120);
    pdfText(doc, room.name, margin + 3, nextY + 1.5, 150, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${activeItems.length} rows  /  ${roomUnits} units`, pageWidth - margin - 3, nextY + 1.5, { align: 'right' });
    nextY += 8;

    autoTable(doc, {
      startY: nextY,
      margin: { left: margin, right: margin, top: 18, bottom: 18 },
      theme: 'grid',
      head: [khmer ? ['#', 'ឈ្មោះទំនិញ', 'ប្រភេទ / ម៉ូដែល', 'ឈ្មោះ / លេខសម្គាល់', 'ចំនួនសន្លឹក', 'រាប់បាន', 'កំណត់ចំណាំ'] : ['#', 'Item name', 'Type / model', 'Hostname / serial', 'Sheet qty', 'Counted', 'Notes / difference']],
      body: activeItems.length
        ? activeItems.map((item, index) => [
            String(index + 1), item.item, item.type || item.tag || '',
            [item.hostname, item.snid].filter(Boolean).join(' / '), item.quantity || '0', '', '',
          ])
        : [['', 'No items recorded', '', '', '', '', '']],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, minCellHeight: 8, textColor: [38, 58, 84], lineColor: [213, 226, 240], lineWidth: 0.15 },
      headStyles: { fillColor: [42, 94, 156], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 250, 253] },
      columnStyles: {
        0: { cellWidth: 9 }, 1: { cellWidth: 52 }, 2: { cellWidth: 47 },
        3: { cellWidth: 50 }, 4: { cellWidth: 21, halign: 'right' },
        5: { cellWidth: 21 }, 6: { cellWidth: 69 },
      },
      rowPageBreak: 'avoid',
      didParseCell: hook => { if (typeof hook.cell.raw === 'string' && /[\u1780-\u17ff]/.test(hook.cell.raw)) hook.cell.text = ['']; },
      didDrawCell: hook => { if (typeof hook.cell.raw === 'string' && /[\u1780-\u17ff]/.test(hook.cell.raw)) pdfText(doc, hook.cell.raw, hook.cell.x + 2, hook.cell.y + hook.cell.height / 2 + 2, hook.cell.width - 4, 7, hook.section === 'head' ? '#ffffff' : '#233b4f'); },
      didDrawPage: ({ pageNumber }) => {
        if (pageNumber > 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(25, 66, 120);
          doc.text(`${room.name} (continued)`, margin, 13);
        }
      },
    });
    const tableEnd = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY;
    nextY = tableEnd + 9;
  }

  if (nextY > pageHeight - 43) {
    doc.addPage();
    nextY = 22;
  }
  doc.setDrawColor(181, 200, 221);
  doc.line(margin, nextY, pageWidth - margin, nextY);
  doc.setFontSize(9);
  doc.setTextColor(47, 72, 104);
  pdfText(doc, khmer ? 'ពិនិត្យដោយ៖ ______________________' : 'Checked by: ____________________________________', margin, nextY + 9, 96, 9);
  pdfText(doc, khmer ? 'កាលបរិច្ឆេទ៖ ____________' : 'Date: ____________________', margin + 103, nextY + 9, 58, 9);
  pdfText(doc, khmer ? 'អនុម័តដោយ៖ ____________________' : 'Approved by: ______________________________', margin + 168, nextY + 9, 100, 9);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(105, 121, 141);
    pdfText(doc, khmer ? 'ទិន្នន័យស្តុកបច្ចុប្បន្ន។ PDF នេះមិនមានសមតុល្យចុងខែពីមុនទេ។' : 'Live stock snapshot. This PDF does not contain historical month-end balances.', margin, pageHeight - 8, 240, 7);
    doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
  doc.save(`quick-stock-monthly-inventory-${month}.pdf`);
}
