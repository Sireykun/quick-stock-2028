import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../components/LanguageProvider';
import { getAllClassesAndItems, type SheetRow } from '../lib/sheets';
import { loadAssetLifecycle, saveAssetLifecycle, type AssetLifeState, type AssetLifeEvent } from '../lib/assetLifecycle';
import { useAuth } from '../components/AuthProvider';

type Asset = SheetRow & { tab: string; location: string };
const key = (asset: Asset) => `${asset.tab}:${asset.row}`;
const linkTo = (asset: Asset, sheetId: string) => `${location.origin}/asset?${new URLSearchParams({ sheet: sheetId, tab: asset.tab, row: String(asset.row), item: asset.item, room: asset.location, snid: asset.snid || '', hostname: asset.hostname || '' })}`;

export function AssetLabels() {
  const { t } = useLanguage(); const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [assets, setAssets] = useState<Asset[]>([]); const [selected, setSelected] = useState<string[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({}); const [search, setSearch] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (!sheetId) { setError('Connect your Google Sheet in Settings first.'); return; } Promise.all(['Classes', 'Stock Room'].map(async tab => {
    const groups = await getAllClassesAndItems(sheetId, tab);
    return Object.entries(groups).flatMap(([room, rows]) => rows.map(row => ({ ...row, tab, location: room })));
  })).then(parts => setAssets(parts.flat())).catch(err => setError(err.message)); }, [sheetId]);
  const visible = useMemo(() => assets.filter(asset => `${asset.item} ${asset.location} ${asset.type} ${asset.snid} ${asset.hostname}`.toLowerCase().includes(search.toLowerCase())).slice(0, 200), [assets, search]);
  const print = async () => {
    const picked = assets.filter(asset => selected.includes(key(asset)));
    const images = await Promise.all(picked.map(asset => QRCode.toDataURL(linkTo(asset, sheetId), { margin: 1, width: 210, errorCorrectionLevel: 'M' })));
    setQr(Object.fromEntries(picked.map((asset, index) => [key(asset), images[index]])));
    setTimeout(() => window.print(), 200);
  };
  return <main className="inventory-page space-y-4"><header className="print:hidden"><h1 className="text-3xl font-bold">{t('Asset QR labels')}</h1><p className="text-sm">{t('Select rows and print labels. The QR opens the matching asset in Quick Stock.')}</p><p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{t('Add SNID or hostname before printing labels for identical items. Reprint a label if its Sheet row moves.')}</p></header>
    <div className="print:hidden"><input aria-label={t('Search assets')} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search assets')} className="w-full rounded-xl border border-slate-400 bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-white" />{error && <p role="alert" className="text-rose-700">{error}</p>}<p className="my-2 text-sm">{selected.length} {t('selected')}</p><div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-300 dark:border-slate-700">{visible.map(asset => <label key={key(asset)} className="flex min-h-11 items-center gap-3 border-b border-slate-200 p-2 dark:border-slate-700"><input type="checkbox" checked={selected.includes(key(asset))} onChange={event => setSelected(current => event.target.checked ? [...current, key(asset)] : current.filter(value => value !== key(asset)))} /><span className="flex-1">{asset.item} · {asset.location} · {asset.type || '—'} · {asset.snid || asset.hostname || `Row ${asset.row}`}</span></label>)}</div><button type="button" onClick={print} disabled={!selected.length} className="mt-3 rounded-xl bg-sky-700 px-5 py-3 font-bold text-white disabled:opacity-50">{t('Print selected labels')}</button></div>
    <div className="hidden print:grid print:grid-cols-3 print:gap-2">{assets.filter(asset => selected.includes(key(asset))).map(asset => <div key={key(asset)} className="break-inside-avoid border border-black p-3 text-center text-black"><strong>{asset.item}</strong><p>{asset.location} · {asset.type}</p>{qr[key(asset)] && <img src={qr[key(asset)]} alt="" className="mx-auto h-32 w-32" />}<small>{asset.snid || asset.hostname || `Row ${asset.row}`}</small></div>)}</div>
  </main>;
}

export function AssetDetail() {
  const { t } = useLanguage(); const { role } = useAuth(); const [params] = useSearchParams(); const [asset, setAsset] = useState<Asset | null>(null); const [error, setError] = useState('');
  const [life, setLife] = useState<AssetLifeState | null>(null); const [events, setEvents] = useState<AssetLifeEvent[]>([]);
  const [person, setPerson] = useState(''); const [due, setDue] = useState(''); const [maintenance, setMaintenance] = useState('working'); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const sheetId = params.get('sheet') || '';
  const tab = params.get('tab') || '';
  const row = Number(params.get('row'));
  useEffect(() => {
    if (sheetId !== localStorage.getItem('quickStock_classesSheetId')) { setError(t('This asset belongs to another workspace.')); return; }
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(sheetId) || !['Classes', 'Stock Room'].includes(tab) || !Number.isInteger(row)) { setError(t('Invalid asset link.')); return; }
    getAllClassesAndItems(sheetId, tab).then(groups => {
      const match = Object.entries(groups).flatMap(([room, rows]) => rows.map(item => ({ ...item, tab, location: room }))).find(item => item.row === row && item.item === params.get('item') && item.location === params.get('room') && (!params.get('snid') || item.snid === params.get('snid')) && (!params.get('hostname') || item.hostname === params.get('hostname')));
      if (match) { setAsset(match); loadAssetLifecycle(sheetId, `${tab}:${row}`).then(data => { setLife(data.state); setEvents(data.events); setMaintenance(data.state?.maintenance_status || 'working'); setNote(data.state?.maintenance_note || ''); }).catch(err => setError(err.message)); } else setError(t('Asset was moved or no longer matches this label.'));
    }).catch(err => setError(err.message));
  }, [sheetId, tab, row]);
  const act = async (action: 'checkout' | 'return' | 'maintenance') => {
    setBusy(true); setError('');
    try { await saveAssetLifecycle(sheetId, `${tab}:${row}`, { action, person, dueAt: due, maintenanceStatus: maintenance, note }); const data = await loadAssetLifecycle(sheetId, `${tab}:${row}`); setLife(data.state); setEvents(data.events); setPerson(''); }
    catch (err) { setError(t((err as Error).message)); }
    finally { setBusy(false); }
  };
  return <main className="inventory-page space-y-4"><h1 className="text-3xl font-bold">{t('Asset')}</h1>{error && <p role="alert" className="text-rose-700">{error}</p>}{asset && <><section className="nova-panel rounded-2xl p-5"><h2 className="text-2xl font-bold">{asset.item}</h2><dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries({ Location: asset.location, 'Type/Model': asset.type, Quantity: asset.quantity, Hostname: asset.hostname, SNID: asset.snid, Status: asset.status }).map(([label, value]) => <div key={label}><dt className="text-xs font-bold text-slate-500">{t(label)}</dt><dd>{value || '—'}</dd></div>)}</dl></section><section className="nova-panel space-y-3 rounded-2xl p-5"><h2 className="text-lg font-bold">{t('Checkout and maintenance')}</h2><p>{t('Custodian')}: {life?.custodian || t('Available')} {life?.due_at && `· ${t('Due')}: ${new Date(life.due_at).toLocaleDateString()}`}</p><p>{t('Maintenance')}: {t(life?.maintenance_status || 'working')}</p>{role !== 'viewer' && <><div className="grid gap-2 sm:grid-cols-2"><input aria-label={t('Person receiving equipment')} placeholder={t('Person receiving equipment')} value={person} onChange={event => setPerson(event.target.value)} className="min-h-11 rounded-lg border border-slate-400 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" /><input aria-label={t('Due date')} type="date" value={due} onChange={event => setDue(event.target.value)} className="min-h-11 rounded-lg border border-slate-400 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" /></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || Boolean(life?.custodian) || !person.trim()} onClick={() => act('checkout')} className="rounded-lg bg-sky-700 px-4 py-2 text-white disabled:opacity-50">{t('Check out')}</button><button type="button" disabled={busy || !life?.custodian} onClick={() => act('return')} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{t('Return')}</button></div><label className="block">{t('Maintenance status')}<select value={maintenance} onChange={event => setMaintenance(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-400 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white">{['working','needs_repair','in_repair','retired'].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label><textarea aria-label={t('Maintenance note')} value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-lg border border-slate-400 bg-white p-2 text-slate-900 dark:bg-slate-900 dark:text-white" /><button type="button" disabled={busy} onClick={() => act('maintenance')} className="rounded-lg bg-sky-700 px-4 py-2 text-white disabled:opacity-50">{t('Save maintenance')}</button></>}</section><section className="nova-panel rounded-2xl p-5"><h2 className="font-bold">{t('History')}</h2><ul className="mt-2 space-y-2 text-sm">{events.map((event, index) => <li key={index}>{new Date(event.created_at).toLocaleString()} · {t(event.action)} · {event.actor}{event.person && ` · ${event.person}`}{event.note && ` · ${event.note}`}</li>)}</ul></section></>}</main>;
}
