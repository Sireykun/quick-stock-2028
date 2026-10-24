import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SearchableSelect } from '../components/SearchableSelect';
import { 
  Search, ShieldAlert, CheckCircle2, AlertTriangle, FileText, 
  Package, MapPin, RefreshCw, Filter, Download, ArrowRight, HelpCircle
} from 'lucide-react';
import { getAllClassesAndItems, getInventory, SheetRow } from '../lib/sheets';
import { getDuplicateAssets } from '../lib/duplicateAssets';
import { auditFieldFlags, matchingAuditRule, readAuditRules } from '../lib/auditRules';
import { downloadAuditPdf } from '../lib/auditPdf';

export interface AuditItem extends SheetRow {
  sourceLocation: string; // Class Name or Stock Room Name
  isMissingSNID: boolean;
  isMissingHostname: boolean;
  isUnchecked: boolean;
  isZeroQty: boolean;
}

export function Investigate() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'snid' | 'hostname' | 'unchecked' | 'zero' | 'duplicate'>('all');
  const [resolvedStatus, setResolvedStatus] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const classesSheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const auditRules = useMemo(() => readAuditRules(classesSheetId), [classesSheetId]);

  const loadAuditData = async () => {
    if (!classesSheetId) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const allAuditItems: AuditItem[] = [];

      // 1. Fetch Class Inventory
      try {
        const classMap = await getAllClassesAndItems(classesSheetId, 'Classes');
        Object.entries(classMap).forEach(([className, classRows]) => {
          classRows.forEach(row => {
            allAuditItems.push({
              ...row,
              sourceLocation: `Class: ${className}`,
              ...auditFieldFlags(row, auditRules),
              isUnchecked: row.status !== 'Checked',
              isZeroQty: parseInt(row.quantity || '0') <= 0
            });
          });
        });
      } catch (err) {
        console.warn('Could not fetch Classes sheet:', err);
      }

      // 2. Fetch Stock Room Inventory
      try {
        const stockRows = await getInventory(classesSheetId, 'Stock Room');
        stockRows.forEach(row => {
          allAuditItems.push({
            ...row,
            sourceLocation: `Stock: ${row.location || 'Stock Room'}`,
            ...auditFieldFlags(row, auditRules),
            isUnchecked: row.status !== 'Checked',
            isZeroQty: parseInt(row.quantity || '0') <= 0
          });
        });
      } catch (err) {
        console.warn('Could not fetch Stock Room sheet:', err);
      }

      setItems(allAuditItems);
    } catch (err) {
      console.error('Audit load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [classesSheetId]);

  const handleStatusChange = (itemId: string, newStatus: string) => {
    setResolvedStatus(prev => ({ ...prev, [itemId]: newStatus }));
  };

  const handleExportReport = async () => {
    setExporting(true);
    try {
      await downloadAuditPdf(filteredItems.map(item => ({
        ...item,
        duplicateFields: (duplicates.get(item) || []).map(match => match.field),
      })), selectedFilter);
    } catch (error) {
      console.error('Could not export audit PDF', error);
    } finally {
      setExporting(false);
    }
  };

  const duplicates = useMemo(() => getDuplicateAssets(items.filter(item => matchingAuditRule(item, auditRules)?.checkDuplicate)), [items, auditRules]);
  const filteredItems = items.filter(item => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      item.item.toLowerCase().includes(query) ||
      (item.snid && item.snid.toLowerCase().includes(query)) ||
      (item.hostname && item.hostname.toLowerCase().includes(query)) ||
      item.sourceLocation.toLowerCase().includes(query) ||
      (item.tag && item.tag.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (selectedFilter === 'snid') return item.isMissingSNID;
    if (selectedFilter === 'hostname') return item.isMissingHostname;
    if (selectedFilter === 'unchecked') return item.isUnchecked;
    if (selectedFilter === 'zero') return item.isZeroQty;
    if (selectedFilter === 'duplicate') return duplicates.has(item);

    return true;
  });

  const totalMissingSNID = items.filter(i => i.isMissingSNID).length;
  const totalMissingHostname = items.filter(i => i.isMissingHostname).length;
  const totalUnchecked = items.filter(i => i.isUnchecked).length;
  const totalZeroQty = items.filter(i => i.isZeroQty).length;
  const totalDuplicates = duplicates.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Asset Investigation & Audit</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Trace serial numbers, find duplicate IDs and missing details, and audit inventory discrepancies.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAuditData}
            disabled={loading}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Scan Inventory
          </button>
          <button
            onClick={handleExportReport}
            disabled={exporting || loading || filteredItems.length === 0}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Preparing PDF…' : 'Export Audit PDF'}
          </button>
        </div>
      </div>

      {/* Discrepancy Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setSelectedFilter(selectedFilter === 'duplicate' ? 'all' : 'duplicate')}
          className={`p-5 rounded-[24px] border text-left transition-all ${
            selectedFilter === 'duplicate'
              ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-white/70 dark:bg-slate-900/70 border-white/60 dark:border-white/10 hover:shadow-md'
          }`}
        >
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Duplicate IDs</p>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-2">{totalDuplicates}</p>
          <p className="text-[11px] text-slate-400 mt-1">Tracked devices sharing IDs</p>
        </button>
        <button
          onClick={() => setSelectedFilter(selectedFilter === 'snid' ? 'all' : 'snid')}
          className={`p-5 rounded-[24px] border text-left transition-all ${
            selectedFilter === 'snid'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white/70 dark:bg-slate-900/70 border-white/60 dark:border-white/10 hover:shadow-md'
          }`}
        >
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Missing SNID</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{totalMissingSNID}</p>
          <p className="text-[11px] text-slate-400 mt-1">SNID required by audit rules</p>
        </button>

        <button
          onClick={() => setSelectedFilter(selectedFilter === 'hostname' ? 'all' : 'hostname')}
          className={`p-5 rounded-[24px] border text-left transition-all ${
            selectedFilter === 'hostname'
              ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30'
              : 'bg-white/70 dark:bg-slate-900/70 border-white/60 dark:border-white/10 hover:shadow-md'
          }`}
        >
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Missing Hostname</p>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{totalMissingHostname}</p>
          <p className="text-[11px] text-slate-400 mt-1">Hostname required by audit rules</p>
        </button>

        <button
          onClick={() => setSelectedFilter(selectedFilter === 'unchecked' ? 'all' : 'unchecked')}
          className={`p-5 rounded-[24px] border text-left transition-all ${
            selectedFilter === 'unchecked'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-white/70 dark:bg-slate-900/70 border-white/60 dark:border-white/10 hover:shadow-md'
          }`}
        >
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Unchecked Items</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{totalUnchecked}</p>
          <p className="text-[11px] text-slate-400 mt-1">Pending physical check</p>
        </button>

        <button
          onClick={() => setSelectedFilter(selectedFilter === 'zero' ? 'all' : 'zero')}
          className={`p-5 rounded-[24px] border text-left transition-all ${
            selectedFilter === 'zero'
              ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
              : 'bg-white/70 dark:bg-slate-900/70 border-white/60 dark:border-white/10 hover:shadow-md'
          }`}
        >
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Zero Quantity</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{totalZeroQty}</p>
          <p className="text-[11px] text-slate-400 mt-1">Out of stock items</p>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[24px] border border-white/60 dark:border-white/10 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SNID, Hostname, Item Name, Class, or Category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all"
          />
        </div>
      </div>

      {/* Audit Items List */}
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="py-3.5 px-6 font-semibold">Location</th>
                <th className="py-3.5 px-6 font-semibold">Item Name</th>
                <th className="py-3.5 px-4 font-semibold">Hostname</th>
                <th className="py-3.5 px-4 font-semibold">SNID</th>
                <th className="py-3.5 px-4 font-semibold">Qty</th>
                <th className="py-3.5 px-4 font-semibold">Audit Alerts</th>
                <th className="py-3.5 px-6 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    No items or discrepancies found for the active filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const itemKey = `${item.sourceLocation}-${item.row}-${idx}`;
                  const currentStatus = resolvedStatus[itemKey] || item.status || 'Unchecked';
                  const duplicateMatches = duplicates.get(item) || [];
                  const locationName = item.sourceLocation.replace(/^(Class|Stock): /, '');
                  const detailLink = item.sourceLocation.startsWith('Class: ')
                    ? `/classes/${encodeURIComponent(locationName)}`
                    : `/stock-room/${encodeURIComponent(locationName)}`;

                  return (
                    <tr key={itemKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">
                        <Link to={detailLink} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:underline">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.sourceLocation}
                        </Link>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white">{item.item}</div>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{item.tag || 'No Category'} • {item.type || 'Standard'}</div>
                      </td>

                      <td className="py-4 px-4 font-mono text-xs">
                        {item.hostname ? (
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.hostname}</span>
                        ) : item.isMissingHostname ? (
                          <span className="text-purple-500 font-bold italic">Missing Hostname</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="py-4 px-4 font-mono text-xs">
                        {item.snid ? (
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.snid}</span>
                        ) : item.isMissingSNID ? (
                          <span className="text-amber-500 font-bold italic">Missing SNID</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                        {item.quantity}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.isMissingSNID && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                              Missing SNID
                            </span>
                          )}
                          {item.isMissingHostname && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">
                              No Hostname
                            </span>
                          )}
                          {item.isUnchecked && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                              Unchecked
                            </span>
                          )}
                          {item.isZeroQty && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                              Zero Stock
                            </span>
                          )}
                          {duplicateMatches.map(match => (
                            <span key={match.field} className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400">
                              Duplicate {match.field}: {match.matches.map(other => other.sourceLocation).join(', ')}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <SearchableSelect
                          aria-label="Item status"
                          value={currentStatus}
                          onChange={(nextValue) => handleStatusChange(itemKey, nextValue)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none"
                          options={[{ value: 'Unchecked', label: 'Unchecked' }, { value: 'Checked', label: 'Checked (Verified)' }, { value: 'Under Review', label: 'Under Review' }, { value: 'Missing', label: 'Flagged Missing' }]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
