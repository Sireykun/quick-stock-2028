import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Box, Building2, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, FlaskConical, Folder, Keyboard, Laptop, LayoutGrid, ListFilter, Monitor, Package, Warehouse, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
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

type PreviewCard = { name: string; detail: string; icon: LucideIcon; to: string };

function PreviewFocusDeck({ title, label, cards }: { title: string; label: string; cards: PreviewCard[] }) {
  const [viewMode, setViewMode] = useState<'focus' | 'grid'>('focus');
  const [activeIndex, setActiveIndex] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => { setActiveIndex(0); deckRef.current?.scrollTo({ top: 0 }); }, [title, viewMode]);

  const updateActive = () => {
    const deck = deckRef.current;
    if (!deck) return;
    const center = deck.getBoundingClientRect().top + deck.clientHeight / 2;
    let closest = 0;
    let distance = Infinity;
    deck.querySelectorAll<HTMLElement>('[data-stock-focus-card]').forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const nextDistance = Math.abs(rect.top + rect.height / 2 - center);
      if (nextDistance < distance) { closest = index; distance = nextDistance; }
    });
    setActiveIndex(closest);
  };

  const focusCard = (index: number) => {
    const deck = deckRef.current;
    const card = deck?.querySelectorAll<HTMLElement>('[data-stock-focus-card]')[index];
    if (!deck || !card) return;
    const deckRect = deck.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    deck.scrollTo({ top: deck.scrollTop + cardRect.top - deckRect.top - (deck.clientHeight - cardRect.height) / 2, behavior: reduceMotion ? 'instant' : 'smooth' });
    setActiveIndex(index);
  };

  return <section className="stock-focus-section">
    <div className="stock-focus-toolbar"><div><span className="stock-focus-kicker">{label}</span><h2><CountUp value={cards.length} /> <span>{title}</span></h2><p>Scroll to bring a card into focus, then open it.</p></div><div className="stock-focus-view-switch" aria-label={`${title} view`}><button type="button" aria-pressed={viewMode === 'focus'} onClick={() => setViewMode('focus')}><ListFilter size={16} /> Focus</button><button type="button" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid size={16} /> Grid</button></div></div>
    {viewMode === 'focus' ? <div className="stock-focus-layout">
      <div className="stock-focus-rail" aria-hidden="true"><span>{String(activeIndex + 1).padStart(2, '0')}</span><div><i style={{ height: `${((activeIndex + 1) / cards.length) * 100}%` }} /></div><span>{String(cards.length).padStart(2, '0')}</span></div>
      <div ref={deckRef} className="stock-focus-deck" onScroll={updateActive} tabIndex={0} aria-label={`${title}. Scroll or use arrow keys to change focused card.`} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); focusCard(Math.max(0, Math.min(cards.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)))); } }}>
        {cards.map((card, index) => <motion.div key={card.name} data-stock-focus-card className={`stock-focus-card ${index === activeIndex ? 'is-active' : ''}`} initial={reduceMotion ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: Math.min(index, 5) * .055 }}><Link to={card.to} aria-label={`Open ${card.name}`}><div className="stock-focus-card-art"><card.icon size={42} strokeWidth={1.35} /></div><div className="stock-focus-card-copy"><span>{label} {String(index + 1).padStart(2, '0')}</span><strong>{card.name}</strong><small>{card.detail}</small></div><span className="stock-focus-card-arrow"><ChevronRight size={21} /></span></Link></motion.div>)}
      </div>
      <div className="stock-focus-controls"><button type="button" onClick={() => focusCard(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0} aria-label={`Previous ${title} card`}><ChevronUp size={20} /></button><button type="button" onClick={() => focusCard(Math.min(cards.length - 1, activeIndex + 1))} disabled={activeIndex === cards.length - 1} aria-label={`Next ${title} card`}><ChevronDown size={20} /></button></div>
    </div> : <div className="local-preview-grid mt-5">{cards.map(card => <Link key={card.name} to={card.to} className="local-preview-card" data-motion-card><card.icon size={31} /><strong>{card.name}</strong><span>{card.detail}</span><ArrowRight size={16} className="local-preview-card-arrow" /></Link>)}</div>}
  </section>;
}

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
    <PreviewFocusDeck title="areas" label="EXPLORE WORKSPACE" cards={[{ to: '/stock-room', name: 'Stock rooms', detail: 'Browse storage locations', icon: Warehouse }, { to: '/classes', name: 'Classes', detail: 'See deployed equipment', icon: Folder }, { to: '/rooms', name: 'Rooms', detail: 'Explore office and other spaces', icon: Building2 }, { to: '/items', name: 'Items', detail: 'Review your item library', icon: Package }]} />
  </div>;
}

function PreviewCards({ kind }: { kind: 'classes' | 'rooms' | 'items' }) {
  const data = kind === 'classes'
    ? [{ name: 'Class A1', detail: '8 assets', icon: Folder }, { name: 'Class A2', detail: '7 assets', icon: Folder }, { name: 'Computer Lab', detail: '6 assets', icon: Monitor }]
    : kind === 'rooms'
      ? [{ name: 'Office', detail: '12 assets', icon: Building2 }, { name: 'Library', detail: '5 assets', icon: Folder }, { name: 'Meeting Room', detail: '4 assets', icon: Monitor }]
      : sampleItems.map(item => ({ name: item.name, detail: `${item.quantity} assets · ${item.type}`, icon: item.icon }));
  return <div className="space-y-5"><section className="nova-panel p-6 sm:p-8"><span className="local-preview-eyebrow">SAMPLE INVENTORY</span><h1 className="mt-2 text-3xl font-bold capitalize text-slate-900 dark:text-white">{kind}</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Scroll, focus, and open sample cards.</p></section><PreviewFocusDeck title={kind} label={`EXPLORE ${kind.toUpperCase()}`} cards={data.map(item => ({ ...item, to: `/${kind}/${encodeURIComponent(item.name)}` }))} /></div>;
}

function PreviewDetail({ kind }: { kind: 'classes' | 'rooms' | 'items' }) {
  const { name } = useParams();
  return <div className="space-y-5"><Link to={`/${kind}`} className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2.5 text-sm font-bold text-sky-800 shadow-sm"><ArrowLeft size={17} /> Back to {kind}</Link><section className="nova-panel p-6 sm:p-8"><span className="local-preview-eyebrow">SAMPLE {kind.toUpperCase()}</span><h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{name}</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This is sample data for testing the interface. No live inventory is connected.</p></section></div>;
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
    <PreviewFocusDeck title="item types" label="EXPLORE THIS ROOM" cards={sampleItems.map(item => ({ name: item.name, detail: `${item.quantity} assets · ${item.type}`, icon: item.icon, to: `/items/${encodeURIComponent(item.name)}` }))} />
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
          <Route path="/classes/:name" element={<PreviewDetail kind="classes" />} />
          <Route path="/rooms" element={<PreviewCards kind="rooms" />} />
          <Route path="/rooms/:name" element={<PreviewDetail kind="rooms" />} />
          <Route path="/items" element={<PreviewCards kind="items" />} />
          <Route path="/items/:name" element={<PreviewDetail kind="items" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </BrowserRouter>;
}
