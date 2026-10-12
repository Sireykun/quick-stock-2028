import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Box, Camera, Check, CheckCircle2, ChevronRight, Folder, Plus, RefreshCw, Save, SkipForward, X } from 'lucide-react';
import { addClassToInventory, addItemToClass, appendInventoryItem, getClassInventory, getClassLastRow, getClasses, getSpreadsheetMetadata, SheetRow, updateClassInventory } from '../lib/sheets';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { FluidSpinner } from '../components/FluidSpinner';

type Area = 'stock' | 'class';
const isChecked = (row: SheetRow) => ['checked', 'ok', 'yes'].includes((row.status || '').trim().toLowerCase());
const emptyItem = (location: string): SheetRow => ({ row: 0, item: '', quantity: '1', tag: '', type: '', hostname: '', snid: '', status: '', location });

export function OnInventory() {
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [area, setArea] = useState<Area>('stock');
  const [tabName, setTabName] = useState('');
  const [sheetNumericId, setSheetNumericId] = useState<number | null>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [draft, setDraft] = useState<SheetRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState<SheetRow>(emptyItem(''));
  const [showChecked, setShowChecked] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;
    setLoadingLocations(true);
    setLocation('');
    setRows([]);
    setDraft(null);
    setAdding(false);
    setError(null);
    setNotice(null);
    (async () => {
      try {
        const meta = await getSpreadsheetMetadata(sheetId);
        const target = area === 'stock'
          ? meta.sheets.find(sheet => sheet.properties.title.toLowerCase().includes('stock'))
          : meta.sheets.find(sheet => ['class', 'classes'].includes(sheet.properties.title.toLowerCase()));
        if (!target) throw new Error(`${area === 'stock' ? 'Stock Room' : 'Classes'} sheet was not found. Check Settings.`);
        const name = target.properties.title;
        const found = await getClasses(sheetId, name);
        if (cancelled) return;
        setTabName(name);
        setSheetNumericId(target.properties.sheetId);
        setLocations(found.map(item => item.title).sort((a, b) => a.localeCompare(b)));
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load locations.');
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sheetId, area, reloadKey]);

  useEffect(() => {
    if (!location || !tabName || !sheetId) return;
    let cancelled = false;
    setLoadingRows(true);
    setRows([]);
    setDraft(null);
    setError(null);
    getClassInventory(sheetId, tabName, location)
      .then(data => {
        if (cancelled) return;
        const ordered = [...data].sort((a, b) => a.row - b.row);
        setRows(ordered);
        const first = ordered.find(row => !isChecked(row)) || ordered[0];
        setDraft(first ? { ...first, status: 'Checked' } : null);
      })
      .catch((err: any) => { if (!cancelled) setError(err.message || 'Could not load inventory.'); })
      .finally(() => { if (!cancelled) setLoadingRows(false); });
    return () => { cancelled = true; };
  }, [sheetId, tabName, location]);

  const pending = useMemo(() => rows.filter(row => !isChecked(row)), [rows]);
  const visibleRows = showChecked ? rows : pending;
  const completed = rows.length - pending.length;
  const progress = rows.length ? Math.round(completed / rows.length * 100) : 0;
  const tags = useMemo(() => Array.from(new Set(rows.map(row => row.tag).filter(Boolean))) as string[], [rows]);
  const types = useMemo(() => Array.from(new Set(rows.map(row => row.type).filter(Boolean))) as string[], [rows]);

  const focusRow = (row: SheetRow) => {
    setDraft({ ...row, status: 'Checked' });
    setError(null);
    setNotice(null);
  };

  const nextRow = (list: SheetRow[], currentRow: number) => list.find(row => row.row > currentRow) || list[0];
  const skip = () => {
    if (!draft || visibleRows.length < 2) return;
    const next = nextRow(visibleRows.filter(row => row.row !== draft.row), draft.row);
    if (next) focusRow(next);
  };

  const save = async () => {
    if (!draft || !sheetId || !tabName) return;
    const name = draft.item.trim();
    const qty = draft.quantity.trim();
    if (!name) { setError('Enter an item name.'); return; }
    if (!/^\d+$/.test(qty)) { setError('Quantity must be a whole number, 0 or greater.'); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated: SheetRow = { ...draft, item: name, quantity: qty, tag: draft.tag?.trim(), type: draft.type?.trim(), hostname: draft.hostname?.trim(), snid: draft.snid?.trim(), location };
      await updateClassInventory(sheetId, tabName, [updated]);
      const nextRows = rows.map(row => row.row === updated.row ? updated : row);
      setRows(nextRows);
      const candidates = showChecked ? nextRows : nextRows.filter(row => !isChecked(row));
      const next = nextRow(candidates.filter(row => row.row !== updated.row), updated.row) || (candidates.some(row => row.row === updated.row) ? updated : undefined);
      setDraft(next ? { ...next, status: 'Checked' } : null);
      setNotice(`${name} saved.`);
    } catch (err: any) {
      setError(err.message || 'Could not save this item. Your edits are still here.');
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!location || !sheetId || !tabName) return;
    if (!newItem.item.trim()) { setError('Enter an item name.'); return; }
    if (!/^\d+$/.test(newItem.quantity.trim())) { setError('Quantity must be a whole number, 0 or greater.'); return; }
    setSaving(true);
    setError(null);
    try {
      let lastRow = sheetNumericId === null ? null : await getClassLastRow(sheetId, tabName, location);
      if (lastRow === null && sheetNumericId !== null) {
        await addClassToInventory(sheetId, tabName, location);
        lastRow = await getClassLastRow(sheetId, tabName, location);
      }
      if (lastRow !== null && sheetNumericId !== null) {
        await addItemToClass(sheetId, sheetNumericId, tabName, location, newItem.item.trim(), lastRow, newItem.quantity.trim(), newItem.tag || '', newItem.type || '', newItem.hostname || '', newItem.snid || '');
      } else {
        await appendInventoryItem(sheetId, tabName, newItem.item.trim(), newItem.quantity.trim(), newItem.tag || '', newItem.type || '', '', newItem.hostname || '', newItem.snid || '', location);
      }
      const refreshed = await getClassInventory(sheetId, tabName, location);
      const ordered = [...refreshed].sort((a, b) => a.row - b.row);
      setRows(ordered);
      const latest = [...ordered].reverse().find(row => row.item.trim().toLowerCase() === newItem.item.trim().toLowerCase());
      if (latest) focusRow(latest);
      setAdding(false);
      setNewItem(emptyItem(location));
      setNotice('Item added. Fill or check it now.');
    } catch (err: any) {
      setError(err.message || 'Could not add the item.');
    } finally {
      setSaving(false);
    }
  };

  const activeDraft = adding ? newItem : draft;
  const change = (key: keyof SheetRow, value: string) => {
    if (adding) setNewItem(current => ({ ...current, [key]: value }));
    else setDraft(current => current ? { ...current, [key]: value } : current);
  };

  const createLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newLocationName.trim();
    if (!name || !sheetId || !tabName) return;
    if (locations.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      setError(`${area === 'class' ? 'Class' : 'Stock room'} “${name}” already exists.`);
      return;
    }
    setCreatingLocation(true);
    setError(null);
    setNotice(null);
    try {
      await addClassToInventory(sheetId, tabName, name);
      setLocations(current => [...current, name].sort((a, b) => a.localeCompare(b)));
      setLocation(name);
      setNewItem(emptyItem(name));
      setShowChecked(false);
      setIsCreatingLocation(false);
      setNewLocationName('');
      setNotice(`${area === 'class' ? 'Class' : 'Stock room'} “${name}” added. You can fill its items now.`);
    } catch (err: any) {
      setError(err.message || 'Could not create this location.');
    } finally {
      setCreatingLocation(false);
    }
  };

  return (
    <div className="on-inventory-page">
      <header className="on-inventory-header nova-panel">
        <div className="on-inventory-kicker"><CheckCircle2 size={15} /> PHONE ENTRY MODE</div>
        <h1>ON Inventory</h1>
        <p>One item at a time. Fill the details, check it, save, and move on.</p>
      </header>

      {!sheetId ? <div className="nova-panel on-inventory-message" role="alert"><AlertCircle size={18} /> Connect a spreadsheet in <Link to="/settings">Settings <ArrowRight size={15} /></Link> to start.</div> : <>
        <section className="nova-panel on-inventory-setup" aria-label="Choose inventory area and location">
          <div className="on-inventory-segment" role="group" aria-label="Inventory area">
            <button type="button" className={area === 'stock' ? 'active' : ''} disabled={creatingLocation} onClick={() => { setArea('stock'); setIsCreatingLocation(false); setNewLocationName(''); }}><Box size={18} /> Stock Room</button>
            <button type="button" className={area === 'class' ? 'active' : ''} disabled={creatingLocation} onClick={() => { setArea('class'); setIsCreatingLocation(false); setNewLocationName(''); }}><Folder size={18} /> Classes</button>
          </div>
          <label className="on-inventory-label" htmlFor="on-inventory-location">Location</label>
          <div className="on-inventory-location-row">
            <select id="on-inventory-location" value={location} disabled={loadingLocations || creatingLocation} onChange={event => { setLocation(event.target.value); setAdding(false); setNewItem(emptyItem(event.target.value)); setNotice(null); }}>
              <option value="">{loadingLocations ? 'Loading locations...' : 'Choose a location'}</option>
              {locations.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <button type="button" title="Refresh locations" aria-label="Refresh locations" onClick={() => setReloadKey(key => key + 1)} disabled={loadingLocations}><RefreshCw size={19} /></button>
          </div>
          {!isCreatingLocation ? <button type="button" className="on-inventory-create-link" onClick={() => { setIsCreatingLocation(true); setError(null); }} disabled={loadingLocations || !tabName}><Plus size={17} /> Add {area === 'class' ? 'class' : 'stock room'}</button> :
            <form className="on-inventory-create-form" onSubmit={createLocation}>
              <label htmlFor="on-inventory-new-location">{area === 'class' ? 'New class / room name' : 'New stock room name'}</label>
              <input id="on-inventory-new-location" value={newLocationName} onChange={event => setNewLocationName(event.target.value)} placeholder={area === 'class' ? 'e.g. Lab 102' : 'e.g. Storage A'} autoComplete="off" autoFocus disabled={creatingLocation} maxLength={100} required />
              <div><button type="button" onClick={() => { setIsCreatingLocation(false); setNewLocationName(''); setError(null); }} disabled={creatingLocation}>Cancel</button><button type="submit" disabled={creatingLocation || !newLocationName.trim()}><Plus size={17} /> {creatingLocation ? 'Adding...' : `Add ${area === 'class' ? 'class' : 'stock room'}`}</button></div>
            </form>}
          {!loadingLocations && locations.length === 0 && !error && !isCreatingLocation && <p className="on-inventory-hint">No locations yet. Add one here to get started.</p>}
        </section>

        {error && <div className="on-inventory-alert" role="alert"><AlertCircle size={18} />{error}</div>}
        {notice && <div className="on-inventory-notice" role="status"><Check size={18} />{notice}</div>}

        {location && (loadingRows ? <div className="nova-panel on-inventory-message"><FluidSpinner size="md" /> Loading items...</div> : <>
          <section className="nova-panel on-inventory-progress">
            <div><span>PROGRESS IN {location.toUpperCase()}</span><strong>{completed} / {rows.length} checked</strong></div>
            <div className="on-inventory-progress-track" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={rows.length} aria-label="Items checked"><span style={{ width: `${progress}%` }} /></div>
            <div className="on-inventory-progress-foot"><span>{pending.length} remaining</span><button type="button" onClick={() => { setShowChecked(value => { const next = !value; const first = (next ? rows : pending)[0]; setDraft(first ? { ...first, status: 'Checked' } : null); return next; }); }} aria-pressed={showChecked}>{showChecked ? 'Show remaining' : 'Review all items'}</button></div>
          </section>

          {!adding && <div className="on-inventory-toolbar">
            <button type="button" className="on-inventory-add-button" onClick={() => { setAdding(true); setNewItem(emptyItem(location)); setError(null); setNotice(null); }}><Plus size={18} /> Add item</button>
            <Link to={area === 'stock' ? `/stock-room/${encodeURIComponent(location)}` : `/classes/${encodeURIComponent(location)}`}>Open full list <ChevronRight size={16} /></Link>
          </div>}

          {!adding && rows.length === 0 ? <div className="nova-panel on-inventory-empty"><Box size={34} /><h2>No items here yet</h2><p>Tap “Add item” to start filling this location.</p></div> :
          !adding && !showChecked && pending.length === 0 ? <div className="nova-panel on-inventory-empty"><CheckCircle2 size={40} /><h2>All items checked</h2><p>{location} is complete. You can review the items or add another one.</p></div> :
          !adding && !draft ? <div className="nova-panel on-inventory-empty"><p>Choose an item below to continue.</p></div> : null}

          {activeDraft && (adding || (showChecked || pending.length > 0)) && <section className="nova-panel on-inventory-form">
            <div className="on-inventory-form-head"><div><span>{adding ? 'NEW ITEM' : `ITEM ${Math.max(1, visibleRows.findIndex(row => row.row === draft?.row) + 1)} OF ${visibleRows.length}`}</span><h2>{adding ? 'Add to inventory' : draft?.item}</h2></div>{adding && <button type="button" title="Cancel adding" onClick={() => setAdding(false)}><X size={20} /></button>}</div>
            <div className="on-inventory-fields">
              <label>Item name<input value={activeDraft.item} onChange={event => change('item', event.target.value)} autoComplete="off" placeholder="e.g. Wireless Mouse" /></label>
              <label>Quantity<input type="number" min="0" step="1" inputMode="numeric" value={activeDraft.quantity} onChange={event => change('quantity', event.target.value)} /></label>
              <label>Category / tag<input list="on-inventory-tags" value={activeDraft.tag || ''} onChange={event => change('tag', event.target.value)} placeholder="e.g. Peripheral" /></label>
              <label>Type / model<input list="on-inventory-types" value={activeDraft.type || ''} onChange={event => change('type', event.target.value)} placeholder="e.g. Logitech" /></label>
              <label>Hostname<input value={activeDraft.hostname || ''} onChange={event => change('hostname', event.target.value)} placeholder="Optional" autoCapitalize="none" /></label>
              <label>SNID / serial<div className="on-inventory-scan-field"><input value={activeDraft.snid || ''} onChange={event => change('snid', event.target.value)} placeholder="Scan or type" autoCapitalize="characters" /><button type="button" title="Scan barcode photo" aria-label="Scan barcode photo" onClick={() => setScanner(true)}><Camera size={20} /></button></div></label>
              <datalist id="on-inventory-tags">{tags.map(tag => <option key={tag} value={tag} />)}</datalist>
              <datalist id="on-inventory-types">{types.map(type => <option key={type} value={type} />)}</datalist>
            </div>
            {!adding && <button type="button" className={`on-inventory-check ${activeDraft.status === 'Checked' ? 'active' : ''}`} onClick={() => change('status', activeDraft.status === 'Checked' ? '' : 'Checked')} aria-pressed={activeDraft.status === 'Checked'}><CheckCircle2 size={21} /><span>{activeDraft.status === 'Checked' ? 'Mark as checked on save' : 'Leave unchecked on save'}</span></button>}
            <div className="on-inventory-actions">
              {!adding && <button type="button" className="on-inventory-skip" onClick={skip} disabled={visibleRows.length < 2 || saving}><SkipForward size={18} /> Skip</button>}
              {adding ? <button type="button" className="on-inventory-save" onClick={add} disabled={saving}><Plus size={18} />{saving ? 'Adding...' : 'Add item'}</button> : <button type="button" className="on-inventory-save" onClick={save} disabled={saving}><Save size={18} />{saving ? 'Saving...' : 'Save & next'}</button>}
            </div>
          </section>}

          {!adding && visibleRows.length > 1 && <section className="nova-panel on-inventory-queue"><h3>{showChecked ? 'All items' : 'Up next'}</h3><div>{visibleRows.map(row => <button type="button" key={row.row} className={draft?.row === row.row ? 'active' : ''} onClick={() => focusRow(row)}><span>{row.item}</span>{isChecked(row) && <Check size={15} />}</button>)}</div></section>}
        </>)}
      </>}
      {scanner && <BarcodeScanner onResult={result => { change('snid', result); setScanner(false); }} onClose={() => setScanner(false)} />}
    </div>
  );
}
