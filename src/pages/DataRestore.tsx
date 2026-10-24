import { useEffect, useState } from 'react';
import { captureBackup, listBackups, previewBackup, restoreBackup, saveBackup, type SheetBackup } from '../lib/backups';
import { useLanguage } from '../components/LanguageProvider';
import { useAuth } from '../components/AuthProvider';

export function DataRestore() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [backups, setBackups] = useState<SheetBackup[]>([]);
  const [selected, setSelected] = useState<SheetBackup | null>(null);
  const [preview, setPreview] = useState<{ title: string; before: number; after: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { if (!sheetId) { setMessage(t('Connect your Google Sheet in Settings first.')); return; } listBackups(sheetId).then(setBackups).catch(error => setMessage(error.message)); }, [sheetId]);
  const create = async () => {
    setBusy(true); setMessage('');
    try { await captureBackup(sheetId, 'manual'); setBackups(await listBackups(sheetId)); setMessage(t('Snapshot saved on this device.')); }
    catch (error) { setMessage(t((error as Error).message)); }
    finally { setBusy(false); }
  };
  const choose = async (backup: SheetBackup) => {
    setBusy(true); setMessage('');
    try { setPreview(await previewBackup(backup)); setSelected(backup); }
    catch (error) { setMessage(t((error as Error).message)); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!selected || role === 'viewer') return;
    setBusy(true); setMessage('');
    try { await captureBackup(sheetId, 'manual'); await restoreBackup(selected); setBackups(await listBackups(sheetId)); setSelected(null); setMessage(t('Sheet restored. A safety backup of the previous data was saved first.')); }
    catch (error) { setMessage(t((error as Error).message)); }
    finally { setBusy(false); }
  };
  const download = (backup: SheetBackup) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `quickstock-${backup.createdAt.slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as SheetBackup;
      if (data.sheetId !== sheetId || !Array.isArray(data.tabs) || !data.tabs.every(tab => typeof tab.title === 'string' && Array.isArray(tab.values))) throw new Error(t('Backup file does not match this Sheet.'));
      await saveBackup({ ...data, id: crypto.randomUUID(), kind: 'manual' });
      setBackups(await listBackups(sheetId)); setMessage(t('Backup imported. Preview it before restoring.'));
    } catch (error) { setMessage(t((error as Error).message)); }
  };
  return <main className="inventory-page space-y-5">
    <header><h1 className="text-3xl font-bold">{t('Data Backup & Restore')}</h1><p className="text-sm text-slate-600 dark:text-slate-300">{t('A daily backup is captured when an authorized user opens the app. Backups stay in this browser; download copies for safe storage.')}</p></header>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || role === 'viewer'} onClick={create} className="rounded-xl bg-sky-700 px-4 py-3 font-bold text-white disabled:opacity-50">{t('Create snapshot now')}</button><label className="cursor-pointer rounded-xl border border-sky-400 px-4 py-3 font-bold">{t('Import backup JSON')}<input className="sr-only" type="file" accept="application/json,.json" onChange={event => upload(event.target.files?.[0])} /></label></div>
    {message && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-slate-800 dark:text-sky-100">{message}</p>}
    <section className="nova-panel rounded-2xl p-4"><h2 className="text-lg font-bold">{t('Snapshots')}</h2>{backups.length === 0 && <p className="mt-2 text-sm">{t('No real backup has been captured yet.')}</p>}<ul className="mt-3 space-y-2">{backups.map(backup => <li key={backup.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 p-3 dark:border-slate-600"><div className="min-w-0 flex-1"><strong>{new Date(backup.createdAt).toLocaleString()}</strong><p className="text-xs">{t(backup.kind === 'automatic' ? 'Automatic' : 'Manual')} · {backup.tabs.length} {t('tabs')} · {backup.tabs.reduce((sum, tab) => sum + Math.max(0, tab.values.length - 1), 0)} {t('rows')}</p></div><button type="button" onClick={() => choose(backup)} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white">{t('Preview restore')}</button><button type="button" onClick={() => download(backup)} className="rounded-lg border border-slate-400 px-3 py-2 text-sm">{t('Download')}</button></li>)}</ul></section>
    {selected && <section className="nova-panel rounded-2xl p-4"><h2 className="text-lg font-bold">{t('Restore preview')} · {new Date(selected.createdAt).toLocaleString()}</h2><p className="text-sm">{t('Current rows → backup rows. This replaces data in the listed tabs.')}</p><ul className="my-3 space-y-1">{preview.map(tab => <li key={tab.title}>{tab.title}: {tab.before} → {tab.after}</li>)}</ul><div className="flex gap-2"><button type="button" onClick={restore} disabled={busy || role === 'viewer'} className="rounded-xl bg-rose-700 px-4 py-3 font-bold text-white disabled:opacity-50">{t('Restore this backup')}</button><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-400 px-4 py-3">{t('Cancel')}</button></div></section>}
  </main>;
}
