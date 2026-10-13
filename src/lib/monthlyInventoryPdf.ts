import type { SheetRow } from './sheets';

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
  doc.text('MONTHLY INVENTORY', margin, 19);
  doc.setFontSize(12);
  doc.text(monthLabel, margin, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('QUICK STOCK  /  STOCK LOCATIONS', pageWidth - margin, 18, { align: 'right' });
  doc.text(`Snapshot: ${snapshotLabel}`, pageWidth - margin, 27, { align: 'right' });
  doc.setTextColor(30, 52, 83);
  doc.setFontSize(10);
  doc.text(`${sortedRooms.length} rooms    ${itemRows} item rows    ${units} units recorded`, margin, 49);
  doc.setFontSize(8);
  doc.setTextColor(94, 111, 133);
  doc.text('Quantities come from the current Sheet. Fill in Counted and Notes during the monthly check.', margin, 55);
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
    doc.text(room.name, margin + 3, nextY + 1.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${activeItems.length} rows  /  ${roomUnits} units`, pageWidth - margin - 3, nextY + 1.5, { align: 'right' });
    nextY += 8;

    autoTable(doc, {
      startY: nextY,
      margin: { left: margin, right: margin, top: 18, bottom: 18 },
      theme: 'grid',
      head: [['#', 'Item name', 'Type / model', 'Hostname / serial', 'Sheet qty', 'Counted', 'Notes / difference']],
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
  doc.text('Checked by: ____________________________________', margin, nextY + 9);
  doc.text('Date: ____________________', margin + 103, nextY + 9);
  doc.text('Approved by: ______________________________', margin + 168, nextY + 9);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(105, 121, 141);
    doc.text('Live stock snapshot. This PDF does not contain historical month-end balances.', margin, pageHeight - 8);
    doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
  doc.save(`quick-stock-monthly-inventory-${month}.pdf`);
}
