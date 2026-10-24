import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SearchableSelect } from '../components/SearchableSelect';
import { getAccessToken } from '../lib/auth';

interface ActivityLog {
  id: string;
  created_at: string;
  actor_name: string;
  actor_email: string;
  action: string;
  target: string;
}

export function ActivityLogs() {
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    const token = getAccessToken();
    if (!sheetId || !token || token === 'dummy_token_for_email_login') {
      setError('Connect your Google account and spreadsheet in Settings to view activity logs.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/activity-logs?spreadsheet=${encodeURIComponent(sheetId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Could not load activity logs.');
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err: any) {
      setError(err.message || 'Could not load activity logs.');
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const users = useMemo(() => [...new Map<string, string>(logs.map(log => [log.actor_email, log.actor_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [logs]);
  const query = search.trim().toLocaleLowerCase();
  const filteredLogs = logs.filter(log => (selectedEmail === 'All' || log.actor_email === selectedEmail) &&
    [log.actor_name, log.actor_email, log.action, log.target].some(value => value.toLocaleLowerCase().includes(query)));

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quick-stock-activity-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"><History className="h-5 w-5" /></span><h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Activity Logs</h1></div><p className="mt-1 font-medium text-slate-500 dark:text-slate-400">Spreadsheet changes by Google account.</p></div>
      <div className="flex gap-2"><button type="button" onClick={loadLogs} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button><button type="button" onClick={exportLogs} disabled={filteredLogs.length === 0} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Download className="h-4 w-4" />Export Logs</button></div>
    </div>
    <div className="flex flex-col gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70 md:flex-row">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, Gmail, action, or sheet..." aria-label="Search activity logs" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
      <SearchableSelect aria-label="Filter by Google account" value={selectedEmail} onChange={setSelectedEmail} className="min-w-[200px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" options={[{ value: 'All', label: 'All Google accounts' }, ...users.map(([email, name]) => ({ value: email, label: `${name} · ${email}` }))]} />
    </div>
    {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{error} {error.includes('Settings') && <Link to="/settings" className="font-bold underline">Open Settings</Link>}</p>}
    <div className="overflow-hidden rounded-[24px] border border-white/60 bg-white/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400"><th className="px-5 py-3.5 font-semibold">When</th><th className="px-5 py-3.5 font-semibold">Google account</th><th className="px-5 py-3.5 font-semibold">Action</th><th className="px-5 py-3.5 font-semibold">Sheet</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">{filteredLogs.map(log => <tr key={log.id} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/30"><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{new Date(log.created_at).toLocaleString()}</td><td className="px-5 py-4"><strong className="block text-slate-900 dark:text-white">{log.actor_name}</strong><span className="text-xs text-slate-500 dark:text-slate-400">{log.actor_email}</span></td><td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{log.action}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{log.target}</td></tr>)}</tbody></table></div>
      {!loading && !error && filteredLogs.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{logs.length ? 'No changes match your filters.' : 'No recorded changes yet. New spreadsheet edits will appear here.'}</p>}
      {loading && <p className="p-8 text-center text-sm text-slate-500">Loading activity…</p>}
    </div>
  </div>;
}
