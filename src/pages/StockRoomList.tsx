import { FluidSpinner } from "../components/FluidSpinner";
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSpreadsheetMetadata, getLocations, formatStockColors, SheetRow, getInventory, getAllClassesAndItems as getAllLocationsAndItems, addClassToInventory } from '../lib/sheets';
import { RefreshCw, AlertCircle, Layers, ChevronRight, Plus, X, CheckCheck, Search, Palette, ArrowDownAZ, ArrowUpAZ, ArrowUpDown, FileText, Printer, Copy } from 'lucide-react';

export function StockRoomList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ title: string, isChecked: boolean }[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [addingStatus, setAddingStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [mainTabName, setMainTabName] = useState('Sheet1');
  const [actualSheetNumericalId, setActualSheetNumericalId] = useState<number | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  
  const [showDraftReport, setShowDraftReport] = useState(false);
  const [draftReportData, setDraftReportData] = useState<Record<string, SheetRow[]> | null>(null);
  const [draftReportLoading, setDraftReportLoading] = useState(false);
  const [draftReportItemQuery, setDraftReportItemQuery] = useState('');
  const [draftReportTypeQuery, setDraftReportTypeQuery] = useState('');
  
  const [showTextReport, setShowTextReport] = useState(false);
  const [textReportContent, setTextReportContent] = useState('');

  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';

  const loadLocations = async (showLoading = true) => {
    if (!sheetId) {
      setError('Locations Spreadsheet ID is not configured. Please go to Settings.');
      setLoading(false);
      return;
    }

    if (showLoading || locations.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const meta = await getSpreadsheetMetadata(sheetId);
      const stockSheet = meta.sheets.find(s => s.properties?.title?.toLowerCase() === 'stock room' || s.properties?.title?.toLowerCase() === 'stockroom' || s.properties?.title?.toLowerCase().includes('stock')) || meta.sheets[0];
      const tabName = stockSheet?.properties?.title || 'Stock Room';
      setMainTabName(tabName);
      setActualSheetNumericalId(stockSheet?.properties?.sheetId ?? null);
      
      const locationData = await getLocations(sheetId, tabName);
      setLocations(locationData);
    } catch (err: any) {
      setError(err.message || 'Failed to load locations.');
    } finally {
      if (showLoading || locations.length === 0) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !sheetId) return;

    if (locations.some(c => c.title.toLowerCase() === newLocationName.trim().toLowerCase())) {
      window.alert(`Location "${newLocationName.trim()}" already exists.`);
      return;
    }

    setAddingStatus('saving');
    setError(null);

    try {
      await addClassToInventory(sheetId, mainTabName, newLocationName.trim());

      if (actualSheetNumericalId !== null) {
        await formatStockColors(sheetId, actualSheetNumericalId, mainTabName).catch(() => {});
      }

      await loadLocations();
      setIsAdding(false);
      setNewLocationName('');
      setAddingStatus('idle');
    } catch (err: any) {
      window.alert(err.message || 'Failed to add new location.');
      setAddingStatus('error');
    }
  };

  const handleFormatColors = async () => {
    if (!sheetId || actualSheetNumericalId === null) return;
    setIsFormatting(true);
    try {
      await formatStockColors(sheetId, actualSheetNumericalId, mainTabName);
    } catch (err: any) {
      window.alert('Failed to format colors: ' + err.message);
    } finally {
      setIsFormatting(false);
    }
  };

  const handleOpenDraftReport = async () => {
    setShowDraftReport(true);
    setDraftReportLoading(true);
    try {
      const data = await getAllLocationsAndItems(sheetId, mainTabName);
      
      try {
        const meta = await getSpreadsheetMetadata(sheetId);
        const stockSheet = meta.sheets.find(s => s.properties?.title?.toLowerCase() === 'stock room');
        if (stockSheet) {
          const stockData = await getInventory(sheetId, stockSheet.properties.title);
          if (stockData.length > 0) {
            data['Global Stock Room'] = stockData;
          }
        }
      } catch (e) {
        console.warn('Failed to load stock data for report', e);
      }

      setDraftReportData(data);
    } catch (err: any) {
      window.alert('Failed to load draft report: ' + err.message);
      setShowDraftReport(false);
    } finally {
      setDraftReportLoading(false);
    }
  };

  const filteredLocations = locations.filter(cls => 
    cls.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedLocations = [...filteredLocations].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.title.localeCompare(b.title);
    } else if (sortOrder === 'desc') {
      return b.title.localeCompare(a.title);
    }
    return 0;
  });

  if (loading && locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <FluidSpinner size="md" />
        <p>Loading locations...</p>
      </div>
    );
  }

  return (
    <div className="inventory-page space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Stock Room Locations</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Select a room to manage its inventory.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheetId && (
            <>
              <button 
                onClick={handleFormatColors}
                disabled={isFormatting}
                className="px-4 py-2.5 rounded-full text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm text-sm flex items-center gap-2"
                title="Assign random colors to each class block in Google Sheets"
              >
                <Palette className={`w-4 h-4 ${isFormatting ? 'animate-pulse text-indigo-500' : ''}`} />
                <span className="hidden sm:inline">Format Colors</span>
              </button>
              <button 
                onClick={() => setIsAdding(true)}
                className="px-4 py-2.5 rounded-full text-white bg-gradient-to-r from-blue-500 to-cyan-400 font-bold hover:from-blue-600 hover:to-cyan-500 transition-colors shadow-sm text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Location
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (sortOrder === 'default') setSortOrder('asc');
              else if (sortOrder === 'asc') setSortOrder('desc');
              else setSortOrder('default');
            }}
            className="p-2.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm"
            title="Sort A-Z / Z-A"
          >
            {sortOrder === 'default' && <ArrowUpDown className="w-5 h-5" />}
            {sortOrder === 'asc' && <ArrowDownAZ className="w-5 h-5" />}
            {sortOrder === 'desc' && <ArrowUpAZ className="w-5 h-5" />}
          </button>
          <button 
            onClick={loadLocations}
            className="p-2.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {locations.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
          />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-500/20 flex gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add New Location</h3>
              <button 
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                disabled={addingStatus === 'saving'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLocation} className="p-6 space-y-4">
              <div>
                <label htmlFor="locationName" className="block text-sm font-medium text-slate-700 mb-1">
                  Location Name
                </label>
                <input
                  type="text"
                  id="locationName"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="e.g. Stock 1F"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-colors"
                  disabled={addingStatus === 'saving'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStatus === 'saving' || !newLocationName.trim()}
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addingStatus === 'saving' ? (
                    <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Add Location'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {locations.length === 0 && !error && !loading ? (
        <div className="text-center py-12 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-dashed">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-700 dark:text-slate-300 font-medium">No locations found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Click "Add Location" to create your first stock location.</p>
        </div>
      ) : filteredLocations.length === 0 && locations.length > 0 ? (
        <div className="text-center py-12 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-dashed">
          <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-700 dark:text-slate-300 font-medium">No locations match your search</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedLocations.map((cls) => (
            cls.isChecked ? (
              <Link
                key={cls.title}
                to={`/stock-room/${encodeURIComponent(cls.title)}`}
                className="group p-5 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm hover:shadow-md flex items-center justify-between"
                aria-label={`${cls.title}, done`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                    <CheckCheck className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <h3 className="font-bold text-emerald-950 dark:text-emerald-100 truncate">{cls.title}</h3>
                </div>
                <div className="flex items-center gap-3 shrink-0 pl-2">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-full">Done</span>
                  <ChevronRight className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                </div>
              </Link>
            ) : (
              <Link 
                key={cls.title}
                to={`/stock-room/${encodeURIComponent(cls.title)}`}
                className="group p-5 rounded-2xl border shadow-sm transition-all flex items-center justify-between bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-white/10 backdrop-blur-md hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl transition-colors bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40">
                    <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{cls.title}</h3>
                </div>
                <ChevronRight className="w-5 h-5 transition-colors text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </Link>
            )
          ))}
        </div>
      )}

      {showDraftReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700 print:shadow-none print:border-none print:h-auto print:max-h-none">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">All Locations Report</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Draft version</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!draftReportData) return;
                    let totalItems = 0;
                    const filteredData = Object.entries(draftReportData).map(([locationName, items]) => {
                      const typedItems = items as SheetRow[];
                      const activeItems = typedItems.filter(i => {
                        if (i._isDeleted) return false;
                        let matchesItem = true;
                        let matchesType = true;
                        if (draftReportItemQuery.trim()) {
                          const query = draftReportItemQuery.toLowerCase();
                          matchesItem = (i.item || '').toLowerCase().includes(query) || (i.hostname || '').toLowerCase().includes(query) || (i.snid || '').toLowerCase().includes(query);
                        }
                        if (draftReportTypeQuery.trim()) {
                          const query = draftReportTypeQuery.toLowerCase();
                          matchesType = (i.type || '').toLowerCase().includes(query) || (i.tag || '').toLowerCase().includes(query);
                        }
                        return matchesItem && matchesType;
                      });
                      
                      activeItems.forEach(item => {
                        totalItems += parseInt(item.quantity) || 0;
                      });
                      
                      return { locationName, activeItems };
                    }).filter(group => group.activeItems.length > 0);

                    const itemNameFilter = draftReportItemQuery ? draftReportItemQuery : 'items';
                    let message = `Hi [Boss's Name],\n\nI just reviewed the latest classroom equipment inventory. We currently have a total of ${totalItems} ${itemNameFilter} deployed across the campus.\n\nHere is the breakdown by room:\n\n`;

                    filteredData.forEach(group => {
                      message += `${group.locationName}:\n`;
                      group.activeItems.forEach(item => {
                        const typeTag = item.type || item.tag || "";
                        let itemDetail = `- ${item.quantity} ${typeTag ? typeTag + ' ' : ''}${item.item}`;
                        
                        const extras = [];
                        if (item.snid) extras.push(`SN: ${item.snid}`);
                        if (item.hostname) extras.push(`Hostname: ${item.hostname}`);
                        
                        if (extras.length > 0) {
                          itemDetail += ` (${extras.join(' and ')})`;
                        }
                        message += `${itemDetail}\n`;
                      });
                      message += "\n";
                    });
                    
                    message += "Please let me know if you need the full stock report for the rest of the IT equipment.\n\nBest regards,\n\n[Your Name]\nIT Support";
                    setTextReportContent(message);
                    setShowTextReport(true);
                  }}
                  disabled={draftReportLoading || !draftReportData}
                  className="p-2 sm:px-4 sm:py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold transition-colors border border-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:hover:bg-blue-500/10 rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="hidden sm:inline">Draft Message report</span>
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={draftReportLoading || !draftReportData}
                  className="p-2 sm:px-4 sm:py-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold transition-colors bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={() => setShowDraftReport(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/20 print:bg-white print:p-0 print:overflow-visible">
              {draftReportLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                  <FluidSpinner size="md" />
                  <p>Loading report data...</p>
                </div>
              ) : draftReportData ? (
                <div className="max-w-3xl mx-auto bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-6 sm:p-10 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] shadow-sm border border-slate-100 dark:border-slate-700 print:shadow-none print:border-none print:p-0">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">All Locations Report</h1>
                    <p className="text-slate-500 dark:text-slate-400">Inventory Status</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Generated on {new Date().toLocaleDateString()}</p>
                  </div>
                  
                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 relative print:hidden">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        placeholder="Filter by item, SN, hostname..."
                        value={draftReportItemQuery}
                        onChange={(e) => setDraftReportItemQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                      />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        placeholder="Filter by type/tag..."
                        value={draftReportTypeQuery}
                        onChange={(e) => setDraftReportTypeQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    {Object.entries(draftReportData).map(([locationName, items]) => {
                      const typedItems = items as SheetRow[];
                      const activeItems = typedItems.filter(i => {
                        if (i._isDeleted) return false;
                        let matchesItem = true;
                        let matchesType = true;
                        if (draftReportItemQuery.trim()) {
                          const query = draftReportItemQuery.toLowerCase();
                          matchesItem = (i.item || '').toLowerCase().includes(query) || (i.hostname || '').toLowerCase().includes(query) || (i.snid || '').toLowerCase().includes(query);
                        }
                        if (draftReportTypeQuery.trim()) {
                          const query = draftReportTypeQuery.toLowerCase();
                          matchesType = (i.type || '').toLowerCase().includes(query) || (i.tag || '').toLowerCase().includes(query);
                        }
                        return matchesItem && matchesType;
                      });
                      if (activeItems.length === 0) return null;
                      return (
                        <div key={locationName} className="break-inside-avoid">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 flex items-center justify-between">
                            {locationName}
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 print:bg-transparent px-3 py-1 rounded-full">
                              {activeItems.length} items
                            </span>
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
                                  <th className="py-3 px-2 font-semibold w-1/2">Item</th>
                                  <th className="py-3 px-2 font-semibold">Type/Tag</th>
                                  <th className="py-3 px-2 font-semibold text-right">Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {activeItems.map((item, idx) => (
                                  <tr key={`${item.row}-${idx}`}>
                                    <td className="py-3 px-2 align-top">
                                      <div className="font-medium text-slate-900 dark:text-slate-100">{item.item}</div>
                                      {(item.hostname || item.snid) && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                          {item.hostname && <span>{item.hostname}</span>}
                                          {item.hostname && item.snid && <span className="mx-1">•</span>}
                                          {item.snid && <span>SN: {item.snid}</span>}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-2 align-top text-slate-600 dark:text-slate-300">
                                      {item.type || item.tag || "-"}
                                    </td>
                                    <td className="py-3 px-2 align-top text-right font-semibold text-slate-900 dark:text-slate-100">
                                      {item.quantity}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showTextReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Message Report</h3>
              <button
                onClick={() => setShowTextReport(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/20">
              <textarea
                value={textReportContent}
                readOnly
                className="w-full h-[60vh] p-4 font-mono text-sm bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
              />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(textReportContent);
                  window.alert("Copied to clipboard!");
                }}
                className="px-4 py-2 text-white bg-indigo-600 font-bold hover:bg-indigo-700 transition-colors rounded-xl shadow-sm flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
