import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useLanguage } from '../components/LanguageProvider';
import { importCsvRows, parseCsv, validateImport, type ImportRow } from '../lib/csvImport';

export function CsvImport() {
  const { role } = useAuth(); const { t } = useLanguage();
  const [rows, setRows] = useState<ImportRow[]>([]); const [tab, setTab] = useState('Classes');
  const [fileName, setFileName] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const read = async (file?: File) => {
    if (!file) return; setFileName(file.name);
    try { setRows(validateImport(parseCsv(await file.text()))); setMessage(''); }
    catch (error) { setRows([]); setMessage(t((error as Error).message)); }
  };
  const save = async () => {
    setBusy(true); setMessage('');
    try { const sheetId = localStorage.getItem('quickStock_classesSheetId'); if (!sheetId) throw new Error('Connect your Google Sheet in Settings first.'); await importCsvRows(sheetId, tab, rows); setMessage(t('Import completed. Refresh inventory to see the new rows.')); setRows([]); }
    catch (error) { setMessage(t((error as Error).message)); }
    finally { setBusy(false); }
  };
  return <main className="inventory-page space-y-5"><header><h1 className="text-3xl font-bold">{t('Import CSV')}</h1><p className="text-sm">{t('Preview and validate every row before one batch write to Google Sheets.')}</p></header>
    <div className="nova-panel space-y-3 rounded-2xl p-4"><label className="block font-bold">{t('Destination tab')}<select value={tab} onChange={event => setTab(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-400 bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-white"><option>Classes</option><option>Stock Room</option></select></label><label className="block font-bold">{t('CSV file')}<input type="file" accept=".csv,text/csv" onChange={event => read(event.target.files?.[0])} className="mt-1 block w-full rounded-lg border border-slate-400 p-3" /></label><p className="text-xs">{t('Columns: Location, Item Name, Quantity, Category, Type/Model, Hostname, SNID. Headers may be in any order.')}</p></div>
    {message && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sky-900 dark:bg-slate-800 dark:text-white">{message}</p>}
    {rows.length > 0 && <section className="nova-panel rounded-2xl p-4"><h2 className="font-bold">{t('Preview')} · {fileName} · {rows.length} {t('rows')}</h2><p className="text-sm">{rows.filter(row => row.error).length} {t('invalid rows')}</p><div className="mt-3 max-h-[60vh] overflow-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr>{['Location','Item Name','Quantity','Category','Type/Model','Hostname','SNID','Validation'].map(label => <th key={label} className="p-2">{t(label)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className={row.error ? 'bg-rose-100 text-rose-900' : 'border-t border-slate-300 dark:border-slate-700'}><td className="p-2">{row.location}</td><td className="p-2">{row.item}</td><td className="p-2">{row.quantity}</td><td className="p-2">{row.category}</td><td className="p-2">{row.type}</td><td className="p-2">{row.hostname}</td><td className="p-2">{row.snid}</td><td className="p-2">{row.error || t('Ready')}</td></tr>)}</tbody></table></div><button type="button" onClick={save} disabled={busy || role === 'viewer' || rows.some(row => row.error)} className="mt-4 rounded-xl bg-sky-700 px-5 py-3 font-bold text-white disabled:opacity-50">{t('Import valid rows')}</button></section>}
  </main>;
}
