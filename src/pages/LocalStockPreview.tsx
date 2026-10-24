import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Box, Building2, CheckCircle2, FlaskConical, Folder, Keyboard, Laptop, Monitor, Package, Warehouse } from 'lucide-react';
import { StockRoomList } from './StockRoomList';
import { CountUp } from '../components/CountUp';
import { MotionReveals } from '../components/MotionReveals';

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

const sampleItems = [
  { name: 'Television', type: '55 inch display', quantity: 12, icon: Monitor },
  { name: 'Keyboard', type: 'USB and wireless', quantity: 24, icon: Keyboard },
  { name: 'Laptop', type: 'Student and office', quantity: 18, icon: Laptop },
  { name: 'Storage box', type: 'Spare parts', quantity: 9, icon: Box },
];

function PreviewHome() {
  return <div className="space-y-6">
    <section className="nova-panel local-preview-hero">
      <div><span className="local-preview-eyebrow">✦ INVENTORY WORKSPACE</span><h1>Everything in view.</h1><p>Explore the new motion style with sample inventory. Your real stock stays untouched.</p><Link to="/stock-room" className="nova-primary-button">EXPLORE STOCK <ArrowRight size={16} /></Link></div>
      <div className="local-preview-hero-number"><Package size={31} /><strong><CountUp value={63} /></strong><span>sample assets</span></div>
    </section>
    <section className="nova-panel local-preview-stats" aria-label="Sample inventory statistics">
      <div><Package size={20} /><strong><CountUp value={63} /></strong><span>Total assets</span></div>
      <div><Folder size={20} /><strong><CountUp value={21} /></strong><span>In classes</span></div>
      <div><Box size={20} /><strong><CountUp value={42} /></strong><span>In stock</span></div>
      <div><CheckCircle2 size={20} /><strong><CountUp value={76} suffix="%" /></strong><span>Verified</span></div>
    </section>
    <section className="nova-panel p-5 sm:p-7"><h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Explore your workspace</h2><div className="local-preview-grid">
      {[{ to: '/stock-room', title: 'Stock rooms', text: 'Browse storage locations', icon: Warehouse }, { to: '/classes', title: 'Classes', text: 'See deployed equipment', icon: Folder }, { to: '/rooms', title: 'Rooms', text: 'Explore office and other spaces', icon: Building2 }, { to: '/items', title: 'Items', text: 'Review your item library', icon: Package }].map(card => <Link key={card.to} to={card.to} className="local-preview-card" data-motion-card><card.icon size={29} /><strong>{card.title}</strong><span>{card.text}</span><ArrowRight size={16} className="local-preview-card-arrow" /></Link>)}
    </div></section>
  </div>;
}

function PreviewCards({ kind }: { kind: 'classes' | 'rooms' | 'items' }) {
  const data = kind === 'classes'
    ? [{ name: 'Class A1', detail: '8 assets', icon: Folder }, { name: 'Class A2', detail: '7 assets', icon: Folder }, { name: 'Computer Lab', detail: '6 assets', icon: Monitor }]
    : kind === 'rooms'
      ? [{ name: 'Office', detail: '12 assets', icon: Building2 }, { name: 'Library', detail: '5 assets', icon: Folder }, { name: 'Meeting Room', detail: '4 assets', icon: Monitor }]
      : sampleItems.map(item => ({ name: item.name, detail: `${item.quantity} assets · ${item.type}`, icon: item.icon }));
  return <div className="space-y-5"><section className="nova-panel p-6 sm:p-8"><span className="local-preview-eyebrow">SAMPLE INVENTORY</span><h1 className="mt-2 text-3xl font-bold capitalize text-slate-900 dark:text-white">{kind}</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Preview the motion and card layout with sample data.</p></section><div className="local-preview-grid">{data.map(item => <div key={item.name} className="local-preview-card" data-motion-card><item.icon size={31} /><strong>{item.name}</strong><span>{item.detail}</span></div>)}</div></div>;
}

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
      <nav className="local-preview-nav mx-auto mb-5 flex max-w-5xl flex-wrap gap-2" aria-label="Sample pages">
        {[{ to: '/', label: 'Home' }, { to: '/stock-room', label: 'Stock Room' }, { to: '/classes', label: 'Classes' }, { to: '/rooms', label: 'Rooms' }, { to: '/items', label: 'Items' }].map(item => <NavLink key={item.to} to={item.to} end className={({ isActive }) => `local-preview-nav-link ${isActive ? 'is-active' : ''}`}>{item.label}</NavLink>)}
      </nav>
      <main className="local-motion-main mx-auto max-w-5xl">
        <MotionReveals />
        <Routes>
          <Route path="/" element={<PreviewHome />} />
          <Route path="/stock-room" element={<StockRoomList previewLocations={previewRooms} />} />
          <Route path="/stock-room/:locationName" element={<PreviewRoom />} />
          <Route path="/classes" element={<PreviewCards kind="classes" />} />
          <Route path="/rooms" element={<PreviewCards kind="rooms" />} />
          <Route path="/items" element={<PreviewCards kind="items" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </BrowserRouter>;
}
