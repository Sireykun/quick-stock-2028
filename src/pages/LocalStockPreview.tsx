import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Warehouse } from 'lucide-react';
import { StockRoomList } from './StockRoomList';

const previewRooms = [
  { title: 'Sample Stock 1F', isChecked: true },
  { title: 'Sample Stock 2F', isChecked: false },
  { title: 'Sample Back Store', isChecked: true },
  { title: 'Sample IT Office', isChecked: false },
  { title: 'Sample Repair Bench', isChecked: false },
  { title: 'Sample Lobby', isChecked: true },
  { title: 'Sample Archive', isChecked: false },
  { title: 'Sample Spare Parts', isChecked: false },
];

function PreviewRoom() {
  const { locationName } = useParams();
  const room = previewRooms.find(item => item.title === locationName);
  return <div className="space-y-5">
    <Link to="/stock-room" className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2.5 text-sm font-bold text-sky-800 shadow-sm"><ArrowLeft size={17} /> Back to Stock Room</Link>
    <section className="nova-panel p-6 sm:p-8">
      <Warehouse className="mb-4 text-sky-600" size={38} />
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{room?.title || 'Sample room'}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This local preview uses sample rooms. No Google Sheet is connected.</p>
    </section>
  </div>;
}

export function LocalStockPreview() {
  return <BrowserRouter>
    <div className="quickstock-shell min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <header className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/80 px-5 py-3 shadow-sm dark:border-sky-900 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 text-sky-800 dark:text-sky-200"><FlaskConical size={21} /><strong>Quick Stock · local UI test</strong></div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Sample data · no Gmail · no live writes</span>
      </header>
      <main className="mx-auto max-w-5xl">
        <Routes>
          <Route path="/" element={<Navigate to="/stock-room" replace />} />
          <Route path="/stock-room" element={<StockRoomList previewLocations={previewRooms} />} />
          <Route path="/stock-room/:locationName" element={<PreviewRoom />} />
          <Route path="*" element={<Navigate to="/stock-room" replace />} />
        </Routes>
      </main>
    </div>
  </BrowserRouter>;
}
