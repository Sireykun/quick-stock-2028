import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Box, Building2, CheckCheck, ChevronRight, Folder, Layers, Plus, QrCode, RefreshCw, Search, X } from 'lucide-react';
import { addClassToInventory, getClasses } from '../lib/sheets';
import { CUSTOM_ROOM_PREFIX, OFFICE_DEPARTMENT_PREFIX, isOfficeDepartment, roomLabel } from '../lib/rooms';
import { useLanguage } from '../components/LanguageProvider';

const roomPath = (name: string) => `/rooms/${encodeURIComponent(name)}`;
const InventoryList = lazy(() => import('../components/InventoryList').then(module => ({ default: module.InventoryList })));
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner').then(module => ({ default: module.BarcodeScanner })));

export function Rooms() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [rooms, setRooms] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(Boolean(sheetId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const lastRoom = localStorage.getItem(`quickstock_last_room_${sheetId}`) || '';
  const roomChoices = [{ name: 'Stock', path: '/stock-room', icon: Box }, { name: 'Classes', path: '/classes', icon: Folder }, { name: 'Office', path: roomPath('Office'), icon: Building2 }, ...rooms.filter(name => name.toLocaleLowerCase() !== 'office').map(name => ({ name: roomLabel(name), path: roomPath(name), icon: Building2 }))];
  const shownRooms = roomChoices.filter(room => room.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (!sheetId) return;
    getClasses(sheetId, 'Classes').then(rows => {
      setRooms(rows.map(row => row.title).filter(name => name.toLocaleLowerCase() === 'office' || name.startsWith(CUSTOM_ROOM_PREFIX)));
    }).catch(err => setError(err.message || 'Could not load rooms.')).finally(() => setLoading(false));
  }, [sheetId]);

  const addRoom = async (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!sheetId || !name || saving) return;
    if (/[/\\]/.test(name) || name.includes(':')) { setError('Use a room name without slashes or colons.'); return; }
    const sheetName = `${CUSTOM_ROOM_PREFIX}${name}`;
    if (rooms.some(room => room.toLocaleLowerCase() === sheetName.toLocaleLowerCase()) || ['office', 'stock', 'classes'].includes(name.toLocaleLowerCase())) { setError('That room name is already used.'); return; }
    setSaving(true);
    setError('');
    try {
      await addClassToInventory(sheetId, 'Classes', sheetName, false);
      window.dispatchEvent(new Event('quickstock:rooms-updated'));
      navigate(roomPath(sheetName));
    } catch (err: any) {
      setError(err.message || 'Could not add room.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="inventory-page space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('Rooms')}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('Choose where the items are kept or used.')}</p></div>
    <div className="flex gap-2"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Find a room...')} aria-label={t('Find a room')} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white/80 pl-10 pr-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" /></label><button type="button" onClick={() => setScanning(true)} aria-label={t('Scan asset QR label')} className="flex min-h-12 items-center gap-2 rounded-xl bg-sky-700 px-4 font-semibold text-white"><QrCode size={20} /><span className="hidden sm:inline">{t('Scan asset')}</span></button></div>
    {lastRoom && <Link to={lastRoom} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300">{t('Continue last room')} <ChevronRight size={16} /></Link>}
    <form onSubmit={addRoom} className="nova-panel rounded-2xl p-5">
      <label htmlFor="new-room-name" className="block text-sm font-bold text-slate-800 dark:text-white">{t('Add another room')}</label>
      <div className="mt-3 flex flex-wrap gap-2"><input id="new-room-name" value={newName} onChange={event => setNewName(event.target.value)} maxLength={80} placeholder="e.g. Meeting room" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" /><button type="submit" disabled={!sheetId || !newName.trim() || saving} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />{saving ? 'Adding…' : t('Add room')}</button></div>
      {!sheetId && <p className="mt-2 text-sm text-amber-700">Connect a spreadsheet in <Link to="/settings" className="underline">Settings</Link> to add rooms.</p>}
      {loading && <p className="mt-2 text-xs text-slate-500">Loading rooms…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownRooms.map(room => <Link key={room.path} to={room.path} onClick={() => localStorage.setItem(`quickstock_last_room_${sheetId}`, room.path)} className="nova-panel flex min-h-14 items-center gap-4 rounded-2xl p-4 text-slate-800 dark:text-white"><room.icon className="text-sky-600" /><strong>{t(room.name)}</strong></Link>)}</div>
    {shownRooms.length === 0 && <p className="text-sm text-slate-500">{t('No rooms match your search.')}</p>}
    {scanning && <Suspense fallback={null}><BarcodeScanner title="Scan asset QR" description="Take a photo of a Quick Stock asset label to open it." onClose={() => setScanning(false)} onResult={result => { try { const url = new URL(result); if (url.origin !== window.location.origin || url.pathname !== '/asset') throw new Error(); setScanning(false); navigate(`${url.pathname}${url.search}`); } catch { setScanning(false); setError('This is not a Quick Stock asset QR label.'); } }} /></Suspense>}
  </div>;
}

export function RoomDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roomName } = useParams();
  const name = roomName || '';
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [exists, setExists] = useState<boolean | null>(null);
  const [departments, setDepartments] = useState<{ title: string; isChecked: boolean }[]>([]);
  const [departmentName, setDepartmentName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRoom = async () => {
    setExists(null);
    if (!sheetId || !name) return;
    try {
      const rows = await getClasses(sheetId, 'Classes');
      setExists(rows.some(row => row.title.toLocaleLowerCase() === name.toLocaleLowerCase()));
      if (name === 'Office') setDepartments(rows.filter(row => isOfficeDepartment(row.title)));
      setError('');
    } catch (err: any) {
      setExists(false);
      setError(err.message || 'Could not load room.');
    }
  };

  useEffect(() => {
    loadRoom();
  }, [sheetId, name]);
  useEffect(() => { if (name && sheetId) localStorage.setItem(`quickstock_last_room_${sheetId}`, roomPath(name)); }, [name, sheetId]);

  const createOffice = async () => {
    if (!sheetId || name !== 'Office' || saving) return;
    setSaving(true);
    setError('');
    try {
      await addClassToInventory(sheetId, 'Classes', 'Office', false);
      setExists(true);
      window.dispatchEvent(new Event('quickstock:rooms-updated'));
    } catch (err: any) {
      setError(err.message || 'Could not create Office.');
    } finally {
      setSaving(false);
    }
  };

  const addDepartment = async (event: FormEvent) => {
    event.preventDefault();
    const label = departmentName.trim();
    if (!sheetId || name !== 'Office' || !label || saving) return;
    if (/[/\\:]/.test(label)) { setError('Use a department name without slashes or colons.'); return; }
    const sheetName = `${OFFICE_DEPARTMENT_PREFIX}${label}`;
    if (departments.some(department => department.title.toLocaleLowerCase() === sheetName.toLocaleLowerCase())) { setError('That department already exists.'); return; }
    setSaving(true);
    setError('');
    try {
      await addClassToInventory(sheetId, 'Classes', sheetName, false);
      setDepartments(current => [...current, { title: sheetName, isChecked: false }]);
      setDepartmentName('');
      setIsAdding(false);
      window.dispatchEvent(new Event('quickstock:rooms-updated'));
    } catch (err: any) {
      setError(err.message || 'Could not add department.');
    } finally {
      setSaving(false);
    }
  };

  const filteredDepartments = departments.filter(department => roomLabel(department.title).toLocaleLowerCase().includes(searchQuery.toLocaleLowerCase()));
  const sortedDepartments = sortOrder === 'default' ? filteredDepartments : [...filteredDepartments].sort((a, b) => sortOrder === 'asc' ? roomLabel(a.title).localeCompare(roomLabel(b.title)) : roomLabel(b.title).localeCompare(roomLabel(a.title)));
  const showOfficeInventory = name === 'Office' && searchParams.get('view') === 'inventory';

  return <div className={name === 'Office' && !showOfficeInventory ? 'office-page fixed-workspace' : 'room-inventory-page fixed-workspace'}>
    <button type="button" onClick={() => navigate(showOfficeInventory ? '/rooms/Office' : '/rooms')} className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300"><ArrowLeft size={16} />{showOfficeInventory ? 'Back to Office' : 'All rooms'}</button>
    {!sheetId ? <p className="nova-panel rounded-xl p-5 text-sm">Connect a spreadsheet in <Link to="/settings" className="underline">Settings</Link> to use rooms.</p>
      : exists === null ? <p className="text-sm text-slate-500">Loading room…</p>
      : showOfficeInventory ? exists ? <InventoryList tabName="Classes" sheetId={sheetId} className="Office" title="General Office" subtitle="Manage inventory for" type="class" /> : <div className="nova-panel rounded-2xl p-5"><p className="text-sm text-slate-500">No general Office inventory yet.</p><button type="button" onClick={createOffice} disabled={saving} className="mt-3 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create general Office inventory'}</button></div>
      : name === 'Office' ? <>
        <div className="classes-page-head flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div><span className="classes-page-eyebrow"><span className="classes-page-live" /> 2027 WORKSPACE / {departments.length} DEPARTMENTS</span><h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Office</h1><p className="mt-1 font-medium text-slate-500 dark:text-slate-400">Select a department to manage its inventory.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setIsAdding(true)} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:from-blue-600 hover:to-cyan-500"><Plus className="h-4 w-4" />Add Department</button>
            <button type="button" onClick={() => setSortOrder(current => current === 'default' ? 'asc' : current === 'asc' ? 'desc' : 'default')} title="Sort A-Z / Z-A" aria-label="Sort departments" className="rounded-full border border-white/40 bg-white/60 p-2.5 text-slate-400 shadow-sm hover:text-indigo-600 dark:border-white/10 dark:bg-slate-800/60">{sortOrder === 'default' ? <ArrowUpDown className="h-5 w-5" /> : sortOrder === 'asc' ? <ArrowDownAZ className="h-5 w-5" /> : <ArrowUpAZ className="h-5 w-5" />}</button>
            <button type="button" onClick={loadRoom} title="Refresh" aria-label="Refresh departments" className="rounded-full border border-white/40 bg-white/60 p-2.5 text-slate-400 shadow-sm hover:text-indigo-600 dark:border-white/10 dark:bg-slate-800/60"><RefreshCw className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="classes-page-search relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search departments..." aria-label="Search departments" className="w-full rounded-xl border border-white/40 bg-white/60 py-3 pl-12 pr-4 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-sky-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-white" /></div>
        {departments.length === 0 && !exists ? <div className="rounded-[32px] border border-dashed border-white/60 bg-white/70 py-12 text-center text-slate-500 dark:border-white/10 dark:bg-slate-900/70">No departments yet. Select Add Department to create one.</div> : <div className="office-page-scroll classes-page-scroll grid gap-4 sm:grid-cols-2">
          {exists && 'general office'.includes(searchQuery.toLocaleLowerCase()) && <Link to="/rooms/Office?view=inventory" className="classes-card group flex items-center justify-between rounded-2xl border border-white/40 bg-white/60 p-5 shadow-sm backdrop-blur-md hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-slate-800/60"><div className="flex min-w-0 items-center gap-4"><div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-900/20"><Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /></div><h3 className="truncate font-bold text-slate-800 dark:text-slate-100">General Office</h3></div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400" /></Link>}
          {sortedDepartments.map(department => department.isChecked ? <Link key={department.title} to={roomPath(department.title)} aria-label={`${roomLabel(department.title)}, done`} className="classes-card group flex items-center justify-between rounded-2xl border border-sky-300 bg-sky-50 p-5 shadow-sm hover:shadow-md dark:border-sky-700 dark:bg-sky-950/40"><div className="flex min-w-0 items-center gap-4"><div className="rounded-xl bg-sky-100 p-3 dark:bg-sky-900/50"><CheckCheck className="h-6 w-6 text-sky-700 dark:text-sky-300" /></div><h3 className="truncate font-bold text-sky-950 dark:text-sky-100">{roomLabel(department.title)}</h3></div><div className="flex shrink-0 items-center gap-3 pl-2"><span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">Done</span><ChevronRight className="h-5 w-5 text-sky-700 dark:text-sky-300" /></div></Link> : <Link key={department.title} to={roomPath(department.title)} className="classes-card group flex items-center justify-between rounded-2xl border border-white/40 bg-white/60 p-5 shadow-sm backdrop-blur-md hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-slate-800/60"><div className="flex min-w-0 items-center gap-4"><div className="rounded-xl bg-indigo-50 p-3 group-hover:bg-indigo-100 dark:bg-indigo-900/20"><Layers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /></div><h3 className="truncate font-bold text-slate-800 dark:text-slate-100">{roomLabel(department.title)}</h3></div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400" /></Link>)}
        </div>}
        {departments.length > 0 && filteredDepartments.length === 0 && (!exists || !'general office'.includes(searchQuery.toLocaleLowerCase())) && <p className="text-center text-sm text-slate-500">No departments match your search.</p>}
        {!exists && <Link to="/rooms/Office?view=inventory" className="text-sm font-semibold text-sky-700 dark:text-sky-300">Create general Office inventory</Link>}
        {isAdding && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Department</h2><button type="button" onClick={() => setIsAdding(false)} aria-label="Close" className="rounded-lg p-1 text-slate-500"><X className="h-5 w-5" /></button></div><form onSubmit={addDepartment} className="mt-5 space-y-4"><label htmlFor="office-department-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Department name</label><input id="office-department-name" autoFocus value={departmentName} onChange={event => setDepartmentName(event.target.value)} maxLength={80} placeholder="e.g. Finance" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" required />{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => setIsAdding(false)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Cancel</button><button type="submit" disabled={!departmentName.trim() || saving} className="flex-1 rounded-xl bg-sky-600 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add Department'}</button></div></form></div></div>}
      </>
      : exists ? <InventoryList tabName="Classes" sheetId={sheetId} className={name} title={roomLabel(name)} subtitle="Manage inventory for" type="class" />
      : <div className="nova-panel rounded-2xl p-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{roomLabel(name)}</h1><p className="mt-2 text-sm text-slate-500">This room has not been added to the spreadsheet yet.</p></div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
