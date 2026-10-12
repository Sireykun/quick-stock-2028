import { FluidSpinner } from "../components/FluidSpinner";
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, Plus, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { fetchWithRetry, getSpreadsheetMetadata, deleteRows, ensureClassTemplateSheetExists } from '../lib/sheets';
import { cn, getItemIcon } from '../lib/utils';
import { TagInput, TypeInput } from '../components/InventoryList';
import { getCustomDropdowns, addCustomTag, addCustomType, CustomDropdowns, getMergedCustomDropdowns, addMergedCustomTag, addMergedCustomType } from '../lib/dropdowns';

export function DefaultItems() {
  const { user } = useAuth();
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('quickStock_classesSheetId');
    setSpreadsheetId(savedId);
  }, []);

  const [items, setItems] = useState<Array<{row: number, name: string, tag: string, type: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());
  const [templateSheetId, setTemplateSheetId] = useState<number | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [newlyAddedRow, setNewlyAddedRow] = useState<number | null>(null);
  const [customDropdowns, setCustomDropdowns] = useState<CustomDropdowns>({ tags: [], typesByTag: {} });

  const loadTemplate = async () => {
    if (!spreadsheetId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await ensureClassTemplateSheetExists(spreadsheetId);
      const meta = await getSpreadsheetMetadata(spreadsheetId);
      const sheet = meta.sheets.find(s => s.properties.title === 'Class_Template');
      try {
        const cd = await getMergedCustomDropdowns();
        setCustomDropdowns(cd);
      } catch (e) {}
      if (sheet) {
        setTemplateSheetId(sheet.properties.sheetId);
      }

      const range = `'Class_Template'!A2:C`;
      const encodedRange = encodeURIComponent(range);
      let data;
      try {
        data = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
      } catch (err: any) {
        if (err.status === 400 && err.message?.includes('Unable to parse range')) {
          data = { values: [
            ['USB Mouse', 'Peripheral', ''],
            ['HDMI Cable (2m)', 'Cable', '2m'],
            ['Standard Keyboard', 'Peripheral', ''],
            ['DisplayPort Adaptor', 'Accessory', '']
          ]};
        } else {
          throw err;
        }
      }
      
      if (data.values) {
        setItems(data.values.map((row: any[], index: number) => ({
          row: index + 2,
          name: row[0] || '',
          tag: row[1] || '',
          type: row[2] || '',
        })));
      } else {
        setItems([]);
      }
    } catch (err: any) {
      console.error('Failed to load template:', err);
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, [spreadsheetId]);

  const handleAddCustomTag = async (tag: string) => {
    if (!spreadsheetId) return;
    try {
      await addMergedCustomTag(tag);
      setCustomDropdowns((prev) => ({
        ...prev,
        tags: [...new Set([...prev.tags, tag])],
      }));
    } catch (e) {
      console.error("Failed to add custom tag", e);
    }
  };

  const handleAddCustomType = async (tag: string, type: string) => {
    if (!spreadsheetId) return;
    try {
      await addMergedCustomType(tag, type);
      setCustomDropdowns((prev) => {
        const existingTypes = prev.typesByTag[tag] || [];
        return {
          ...prev,
          typesByTag: {
            ...prev.typesByTag,
            [tag]: [...new Set([...existingTypes, type])],
          },
        };
      });
    } catch (e) {
      console.error("Failed to add custom type", e);
    }
  };

  const existingTags = React.useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      if (item.tag) tags.add(item.tag);
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const existingTypesByTag = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    items.forEach(item => {
      if (item.tag && item.type) {
        if (!map[item.tag]) map[item.tag] = new Set();
        map[item.tag].add(item.type);
      }
    });
    const result: Record<string, string[]> = {};
    for (const tag in map) {
      result[tag] = Array.from(map[tag]).sort((a, b) => a.localeCompare(b));
    }
    return result;
  }, [items]);

  const handleNameChange = (rowIndex: number, val: string) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === rowIndex) {
        setModifiedRows(prevMod => new Set(prevMod).add(item.row));
        return { ...item, name: val };
      }
      return item;
    }));
  };

  const handleTagChange = (rowIndex: number, val: string) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === rowIndex) {
        setModifiedRows(prevMod => new Set(prevMod).add(item.row));
        return { ...item, tag: val };
      }
      return item;
    }));
  };

  const handleTypeChange = (rowIndex: number, val: string) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === rowIndex) {
        setModifiedRows(prevMod => new Set(prevMod).add(item.row));
        return { ...item, type: val };
      }
      return item;
    }));
  };

  const handleAddNew = () => {
    const newRow = items.length > 0 ? Math.max(...items.map(i => i.row)) + 1 : 2;
    setItems(prev => [...prev, { row: newRow, name: 'New Default Item', tag: 'Peripheral', type: '' }]);
    setModifiedRows(prevMod => new Set(prevMod).add(newRow));
    setNewlyAddedRow(newRow);
  };

  useEffect(() => {
    if (newlyAddedRow === null) return;
    const input = document.querySelector<HTMLInputElement>(`[data-template-row="${newlyAddedRow}"]`);
    input?.focus();
    input?.select();
    setNewlyAddedRow(null);
  }, [newlyAddedRow, items]);

  const handleDelete = (rowIndex: number) => {
    setItemToDelete(rowIndex);
  };

  const confirmDelete = () => {
    if (itemToDelete === null) return;
    setItems(prev => prev.map((item, idx) => {
      if (idx === itemToDelete) {
        setModifiedRows(prevMod => new Set(prevMod).add(item.row));
        return { ...item, name: '', tag: '', type: '' }; // Will be filtered out on save
      }
      return item;
    }));
    setItemToDelete(null);
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  const handleSave = async () => {
    if (!spreadsheetId || modifiedRows.size === 0) return;
    setSaving(true);
    try {
      const allUpdates = items.filter(i => modifiedRows.has(i.row));
      const deletes = allUpdates.filter(i => i.name === '');
      const updates = allUpdates.filter(i => i.name !== '');

      if (updates.length > 0) {
        const data = updates.map(update => ({
          range: `'Class_Template'!A${update.row}:C${update.row}`,
          values: [[update.name, update.tag, update.type]]
        }));
        await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data
          })
        });
      }

      if (deletes.length > 0 && templateSheetId !== null) {
        await deleteRows(spreadsheetId, templateSheetId, 'Class_Template', deletes.map(d => d.row));
      }

      setModifiedRows(new Set());
      if (deletes.length > 0) {
        await loadTemplate();
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <FluidSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[calc(100vh-10rem)] sm:h-auto max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Class Default Items</h2>
        </div>
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl flex items-center justify-between shadow-sm border border-red-100">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-lg">Error</span>
            <span className="text-sm opacity-80">{error}</span>
          </div>
          <Link to="/settings" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm">
            Check Settings
          </Link>
        </div>
      </div>
    );
  }

  if (!spreadsheetId) {
    return (
      <div className="flex flex-col h-[calc(100vh-10rem)] sm:h-auto max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Default Items</h2>
        </div>
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl flex items-center justify-between shadow-sm border border-red-100">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-lg">Not Configured</span>
            <span className="text-sm opacity-80">Classes Spreadsheet ID is missing.</span>
          </div>
          <Link to="/settings" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm">
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-setup-page inventory-template-page">
      <header className="inventory-setup-hero nova-panel">
        <Link to="/" aria-label="Back to dashboard" className="inventory-setup-back"><ChevronLeft size={18} /></Link>
        <span className="inventory-setup-kicker">CLASS TEMPLATE</span>
        <h1>Default items</h1>
        <p>These items are added automatically when you create a regular class. Set each item’s name, category, and type here.</p>
        <div className="inventory-setup-example"><span>WHEN USED</span><strong>Create a class</strong><span>→</span><strong>These items appear</strong></div>
      </header>
      <div className="inventory-template-actions nova-panel">
        <div><strong>{items.filter(item => item.name).length} default items</strong><span>{modifiedRows.size ? `${modifiedRows.size} unsaved change${modifiedRows.size === 1 ? '' : 's'}` : 'All changes saved'}</span></div>
        <div className="inventory-template-buttons">
          <button
            onClick={handleAddNew}
            className="inventory-setup-outline"
          >
            <Plus className="w-4 h-4" />
            Add item
          </button>
          <button
            onClick={handleSave}
            disabled={saving || modifiedRows.size === 0}
            className="inventory-setup-primary"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="inventory-template-list nova-panel">
        {items.filter(i => i.name).length === 0 ? (
          <div className="inventory-setup-empty">No default items yet. Tap “Add item” to build your class template.</div>
        ) : (
          items.map((item, idx) => {
            if (!item.name) return null;
            const ItemIcon = getItemIcon(item.name || "", item.tag || "", item.type || "");
            return (
            <div key={`${item.row}-${idx}`} className="inventory-template-item">
              <div className="flex items-start">
                <div className="flex items-center justify-center p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 shrink-0 mr-2">
                  <ItemIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  data-template-row={item.row}
                  aria-label={`Item name ${idx + 1}`}
                  value={item.name}
                  onChange={(e) => handleNameChange(idx, e.target.value)}
                  placeholder="Item Name"
                  className={cn(
                    "flex-1 text-base font-semibold text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-indigo-500 rounded px-1 -ml-1 min-w-0",
                    modifiedRows.has(item.row) && "text-indigo-900 dark:text-indigo-300"
                  )}
                />
                <button
                  onClick={() => handleDelete(idx)}
                  className="inventory-template-remove"
                  title="Remove default item"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="inventory-template-fields">
                <label><span>Category</span><TagInput
                  value={item.tag} 
                  onChange={(val) => handleTagChange(idx, val)} 
                  isActive={modifiedRows.has(item.row)}
                  existingTags={existingTags}
                  customTags={customDropdowns.tags}
                  onAddCustom={handleAddCustomTag}
                /></label>
                <label><span>Type / model</span><TypeInput
                  value={item.type} 
                  tagValue={(item.tag || "Other").trim()} 
                  onChange={(val) => handleTypeChange(idx, val)} 
                  isActive={modifiedRows.has(item.row)}
                  existingTypes={existingTypesByTag[(item.tag || "Other").trim()] || []}
                  customTypes={customDropdowns.typesByTag[(item.tag || "Other").trim()] || []}
                  onAddCustom={handleAddCustomType}
                /></label>
              </div>
            </div>
          )})
        )}
      </div>

      {itemToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 mb-2">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Remove Default Item</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-6 mt-2">
                Are you sure you want to remove <span className="font-semibold text-slate-900 dark:text-white">{items[itemToDelete]?.name}</span>? You must click 'Save Changes' to finalize this change.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
