import React, { useState, useEffect } from 'react';
import { Plus, X, ArrowLeft, Package, Search, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMasterItems, addMasterItem, removeMasterItem, ensureItemMasterSheetExists } from '../lib/sheets';
import { FluidSpinner } from '../components/FluidSpinner';

export function ItemsList() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const classesSheetId = localStorage.getItem('quickStock_classesSheetId') || '';

  useEffect(() => {
    loadData();
  }, [classesSheetId]);
  
  const loadData = async () => {
    if (!classesSheetId) {
      setError('Spreadsheet ID is not configured. Open Settings to connect your inventory.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureItemMasterSheetExists(classesSheetId);
      const masterItems = await getMasterItems(classesSheetId, 'Item Master');
      setItems(Array.from(new Set(masterItems.filter(i => i && i.toLowerCase() !== 'item name'))).sort((a,b) => a.localeCompare(b)));
    } catch(e: any) {
      console.error(e);
      setError(e.message || 'Could not load item names.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !classesSheetId) return;
    
    const trimmed = newItemName.trim();
    if (items.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already in the item library.`);
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      await addMasterItem(classesSheetId, trimmed);
      setItems(prev => [...prev, trimmed].sort((a,b) => a.localeCompare(b)));
      setNewItemName('');
    } catch (e: any) {
      console.error("Failed to add item", e);
      setError(e.message || 'Could not add the item.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (itemToRemove: string) => {
    if (!classesSheetId) return;
    if (!window.confirm(`Remove "${itemToRemove}" from the item name library?`)) return;
    setSaving(true);
    setError(null);
    try {
      await removeMasterItem(classesSheetId, itemToRemove);
      setItems(prev => prev.filter(i => i !== itemToRemove));
    } catch (e: any) {
      console.error("Failed to remove item", e);
      setError(e.message || 'Could not remove the item.');
    } finally {
      setSaving(false);
    }
  };
  const filteredItems = items.filter(item => item.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <FluidSpinner size="md" />
        <p className="text-slate-500 font-medium">Loading items...</p>
      </div>
    );
  }

  return (
    <div className="inventory-setup-page inventory-page">
      <header className="inventory-setup-hero nova-panel">
        <Link to="/" aria-label="Back to dashboard" className="inventory-setup-back"><ArrowLeft size={18} /></Link>
        <span className="inventory-setup-kicker">ITEM LIBRARY</span>
        <h1>Item names</h1>
        <p>Save names you use often, such as “Wireless Mouse” or “HDMI Cable.” These names become choices when you fill inventory.</p>
        <div className="inventory-setup-example"><span>NAME ONLY</span><strong>Wireless Mouse</strong><span>→</span><span>Add quantity and location in inventory</span></div>
      </header>
      {saving && <div className="inventory-setup-saving" role="status"><FluidSpinner size="sm"/> Saving item name...</div>}

      <div className="nova-panel inventory-setup-card">
        {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
        <div className="inventory-setup-section-head"><div><span>ADD A NAME</span><h2>What is the item called?</h2><p>Use a short, consistent name so it is easy to find later.</p></div></div>
        <form onSubmit={handleAdd} className="inventory-setup-inline-form">
          <label htmlFor="new-item-name">Item name</label>
          <div>
            <input
              id="new-item-name"
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              maxLength={100}
              placeholder="e.g. HDMI Cable (2m)"
            />
            <button
              type="submit"
              disabled={!newItemName.trim() || saving}
            >
              <Plus className="w-5 h-5" />
              Add name
            </button>
          </div>
        </form>

        <div className="inventory-setup-list-section">
          <div className="inventory-setup-section-head"><div><span>YOUR LIBRARY</span><h2>Saved names</h2></div><b>{items.length} names</b></div>
          <div className="inventory-setup-search-row">
            {items.length > 0 && <label className="relative block w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <span className="sr-only">Search item names</span>
              <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search items..." className="w-full rounded-xl border border-sky-100 bg-white/70 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>}
          </div>
          
          {items.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No items found.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No items match “{searchQuery}”.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredItems.map((item, index) => (
                <div key={`${item}-${index}`} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700/30 group hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">{item}</span>
                  <button
                    onClick={() => handleRemove(item)}
                    disabled={saving}
                    className="text-slate-400 hover:text-red-500 opacity-100 sm:opacity-50 sm:group-hover:opacity-100 focus:opacity-100 transition-all disabled:opacity-50 shrink-0 p-1"
                    title={`Remove ${item}`}
                    aria-label={`Remove ${item}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
