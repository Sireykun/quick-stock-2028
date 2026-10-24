import type { SheetRow } from './sheets';
import { translate } from '../components/LanguageProvider';
import { loadKhmerPdfFont, pdfText } from './pdfText';

export interface AuditPdfRow extends SheetRow {
  sourceLocation: string;
  isMissingSNID: boolean;
  isMissingHostname: boolean;
  isUnchecked: boolean;
  isZeroQty: boolean;
  duplicateFields: string[];
}

export async function buildAuditPdf(rows: AuditPdfRow[], filter: string, generatedAt = new Date()) {
  const { jsPDF } = await import('jspdf');
  const khmer = typeof localStorage !== 'undefined' && localStorage.getItem('quickStock_language') === 'km';
  if (khmer) await loadKhmerPdfFont();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const columns = [11, 20, 54, 100, 138, 176, 190, 232, 250, 286];
  const headers = khmer ? ['#', 'ទីតាំង', 'ទំនិញ / ម៉ូដែល', 'SNID', 'ឈ្មោះម៉ាស៊ីន', 'ចំនួន', 'បញ្ហា', 'ពិនិត្យ', 'កំណត់ចំណាំ'] : ['#', 'LOCATION', 'ITEM / MODEL', 'SNID', 'HOSTNAME', 'QTY', 'AUDIT ALERTS', 'CHECK', 'NOTES'];
  const text = (value: string, x: number, y: number, width: number) => {
    pdfText(doc, value, x + 2, y, width - 3, 7);
  };

  for (let page = 0; page < pageCount; page++) {
    if (page) doc.addPage();
    const chunk = rows.slice(page * 10, page * 10 + 10);
    doc.setFillColor(22, 54, 81);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    if (khmer) pdfText(doc, 'បញ្ជីត្រួតពិនិត្យទំនិញ', 11, 15, 120, 13, '#ffffff'); else doc.text('ASSET AUDIT CHECKLIST', 11, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('QUICK STOCK  /  INVESTIGATE', pageWidth - 11, 11, { align: 'right' });
    doc.text(`Page ${page + 1} of ${pageCount}`, pageWidth - 11, 17, { align: 'right' });

    doc.setTextColor(47, 78, 103);
    doc.setFontSize(8);
    pdfText(doc, khmer ? `បង្កើត៖ ${generatedAt.toLocaleString()}    តម្រង៖ ${translate(filter)}    ទំនិញ៖ ${rows.length}` : `Generated: ${generatedAt.toLocaleString()}    Filter: ${filter.toUpperCase()}    Items: ${rows.length}`, 11, 32, 210, 8);
    doc.setFillColor(224, 240, 250);
    doc.roundedRect(11, 37, 275, 10, 1.5, 1.5, 'F');
    doc.setTextColor(37, 91, 128);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    headers.forEach((header, index) => text(header, columns[index], 43.3, columns[index + 1] - columns[index]));

    chunk.forEach((item, index) => {
      const y = 47 + index * 13.5;
      doc.setFillColor(index % 2 ? 247 : 255, index % 2 ? 250 : 255, index % 2 ? 253 : 255);
      doc.rect(11, y, 275, 13.5, 'F');
      doc.setDrawColor(213, 227, 237);
      doc.line(11, y + 13.5, 286, y + 13.5);
      doc.setTextColor(35, 59, 79);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      text(String(page * 10 + index + 1), columns[0], y + 5.2, 9);
      text(item.item, columns[2], y + 5.2, 46);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      text(item.sourceLocation, columns[1], y + 5.2, 34);
      text([item.tag, item.type].filter(Boolean).join(' / '), columns[2], y + 10, 46);
      text(item.snid || (item.isMissingSNID ? 'MISSING' : '—'), columns[3], y + 7.2, 38);
      text(item.hostname || (item.isMissingHostname ? 'MISSING' : '—'), columns[4], y + 7.2, 38);
      text(item.quantity || '0', columns[5], y + 7.2, 14);
      const alerts = [item.isMissingSNID && 'SNID', item.isMissingHostname && 'HOST', item.isUnchecked && 'UNCHECKED', item.isZeroQty && 'ZERO', ...item.duplicateFields.map(field => `DUP ${field}`)].filter(Boolean).join(', ');
      text(alerts || 'None', columns[6], y + 7.2, 42);
      doc.setDrawColor(68, 117, 154);
      doc.rect(columns[7] + 6, y + 4, 5, 5);
      doc.setDrawColor(169, 188, 204);
      doc.line(columns[8] + 3, y + 10, columns[9] - 3, y + 10);
    });

    doc.setDrawColor(149, 180, 203);
    doc.line(11, 186, 286, 186);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(63, 91, 112);
    pdfText(doc, khmer ? 'ពិនិត្យដោយ៖ ______________________' : 'Checked by: ______________________________', 11, 194, 100, 8);
    pdfText(doc, khmer ? 'កាលបរិច្ឆេទ៖ ____________' : 'Date: ____________________', 119, 194, 55, 8);
    pdfText(doc, khmer ? 'តាមដាន / អនុម័ត៖ __________________' : 'Follow-up / approval: ______________________________', 179, 194, 105, 8);
    doc.setFontSize(7);
    doc.setTextColor(109, 129, 145);
    pdfText(doc, khmer ? 'គូសសញ្ញាបន្ទាប់ពីពិនិត្យទំនិញផ្ទាល់។ កត់ត្រាការកែតម្រូវក្នុងកំណត់ចំណាំ។' : 'Mark the box after physically checking each item. Notes can record corrections or follow-up.', 11, 204, 240, 7);
    doc.text(`${page * 10 + 1}-${page * 10 + chunk.length} of ${rows.length}`, 286, 204, { align: 'right' });
  }
  return doc;
}

export async function downloadAuditPdf(rows: AuditPdfRow[], filter: string) {
  const doc = await buildAuditPdf(rows, filter);
  doc.save(`quick-stock-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
}
