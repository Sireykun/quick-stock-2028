import React, { useState, useEffect } from 'react';
import { SearchableSelect } from '../components/SearchableSelect';
import { 
  History, Search, Filter, Download, Trash2, Shield, RefreshCw, 
  CheckCircle2, AlertTriangle, Info, Lock, Package, ArrowRight
} from 'lucide-react';

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  category: 'Inventory' | 'Security' | 'System' | 'Restore' | 'Admin';
  level: 'info' | 'warning' | 'security' | 'success';
  details: string;
}

const DEFAULT_LOGS: LogEntry[] = [
  {
    id: 'log-101',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleString(),
    user: 'Administrator',
    action: 'System Security Audit',
    category: 'Security',
    level: 'security',
    details: 'Verified Google OAuth token scope and local session encryption.'
  },
  {
    id: 'log-102',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleString(),
    user: 'Administrator',
    action: 'Inventory Sync',
    category: 'Inventory',
    level: 'success',
    details: 'Synchronized Stock Room & Room 101 spreadsheets with local cache.'
  },
  {
    id: 'log-103',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toLocaleString(),
    user: 'Administrator',
    action: 'Data Snapshot Created',
    category: 'Restore',
    level: 'info',
    details: 'Created automatic restore snapshot (4 sheets, 185 items total).'
  },
  {
    id: 'log-104',
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toLocaleString(),
    user: 'Administrator',
    action: 'Asset Investigation Triggered',
    category: 'Admin',
    level: 'warning',
    details: 'Flagged 2 items with missing SNIDs in Stock Room Storage B.'
  },
  {
    id: 'log-105',
    timestamp: new Date(Date.now() - 1000 * 60 * 1440).toLocaleString(),
    user: 'System',
    action: 'Admin Login',
    category: 'Security',
    level: 'info',
    details: 'Admin user authenticated successfully.'
  }
];

export function ActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('quickStock_activityLogs');
    return saved ? JSON.parse(saved) : DEFAULT_LOGS;
  });

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');

  useEffect(() => {
    localStorage.setItem('quickStock_activityLogs', JSON.stringify(logs));
  }, [logs]);

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear all activity logs?')) {
      setLogs([]);
    }
  };

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quickstock_activity_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || log.category === selectedCategory;
    const matchesLevel = selectedLevel === 'All' || log.level === selectedLevel;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'security':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
            <Lock className="w-3 h-3" /> Security
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Success
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Activity Logs</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Audit trail of system events, security checks, and inventory modifications.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportLogs}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Logs
          </button>
          <button
            onClick={handleClearLogs}
            className="px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[24px] border border-white/60 dark:border-white/10 shadow-sm p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs by action, user, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category:</span>
            <SearchableSelect
              aria-label="Log category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
              options={[{ value: 'All', label: 'All Categories' }, ...['Inventory', 'Security', 'System', 'Restore', 'Admin'].map(value => ({ value, label: value }))]}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Level:</span>
            <SearchableSelect
              aria-label="Log level"
              value={selectedLevel}
              onChange={setSelectedLevel}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
              options={[{ value: 'All', label: 'All Levels' }, { value: 'info', label: 'Info' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'security', label: 'Security' }]}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="py-3.5 px-6 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">User</th>
                <th className="py-3.5 px-6 font-semibold">Action</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold">Level</th>
                <th className="py-3.5 px-6 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    No activity logs match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-xs font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {log.user}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {log.action}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {getLevelBadge(log.level)}
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-300 text-xs">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
