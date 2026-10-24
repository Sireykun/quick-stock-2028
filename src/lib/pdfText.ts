import type { jsPDF } from 'jspdf';

let loaded: Promise<void> | null = null;
export async function loadKhmerPdfFont(): Promise<void> {
  if (!loaded) loaded = (async () => {
    const font = new FontFace('QuickStockKhmer', 'url(/fonts/Khmer.ttf)');
    await font.load(); document.fonts.add(font);
  })();
  return loaded;
}

export function pdfText(doc: jsPDF, value: string, x: number, y: number, width: number, size = 8, color = '#233b4f'): void {
  if (!/[\u1780-\u17ff]/.test(value)) { doc.text(doc.splitTextToSize(value || '—', width)[0] || '—', x, y); return; }
  const scale = 5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale)); canvas.height = Math.ceil(size * scale * 1.25);
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = color; ctx.font = `${size * scale * 0.62}px QuickStockKhmer`; ctx.textBaseline = 'middle';
  ctx.fillText(value, 0, canvas.height / 2, canvas.width);
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y - size * 0.55, width, size * 1.25);
}
