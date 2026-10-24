import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Box, Camera, Check, CheckCircle2, ChevronRight, Folder, Plus, RefreshCw, Save, SkipForward, X } from 'lucide-react';
import { addClassToInventory, addItemToClass, appendInventoryItem, getClassInventory, getClassLastRow, getClasses, getSpreadsheetMetadata, SheetRow, updateClassInventory } from '../lib/sheets';
import { findDuplicateMatches, loadLocatedAssets } from '../lib/duplicateAssets';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { FluidSpinner } from '../components/FluidSpinner';
import { SearchableSelect } from '../components/SearchableSelect';
import { pendingChecks, queueCheck, syncChecks } from '../lib/offlineChecks';
import { useLanguage } from '../components/LanguageProvider';
import { useAuth } from '../components/AuthProvider';

type Area = 'stock' | 'class';
const isChecked = (row: SheetRow) => ['checked', 'ok', 'yes'].includes((row.status || '').trim().toLowerCase());
const emptyItem = (location: string): SheetRow => ({ row: 0, item: '', quantity: '1', tag: '', type: '', hostname: '', snid: '', status: '', location });

export function OnInventory() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const [area, setArea] = useState<Area>(() => localStorage.getItem(`quickstock_last_area_${sheetId}`) === 'class' ? 'class' : 'stock');
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
  const [queuedCount, setQueuedCount] = useState(() => pendingChecks().length);
  const [queueLimit, setQueueLimit] = useState(30);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => { const refresh = () => setQueuedCount(pendingChecks().length); window.addEventListener('quickstock:pending-checks', refresh); return () => window.removeEventListener('quickstock:pending-checks', refresh); }, []);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;
    setLoadingLocations(true);
    setLocation('');
    setRows([]);
    setQueueLimit(30);
    setDraft(null);
    setAdding(false);
    setError(null);
    setNotice(null);
    (async () => {
      try {
        if (!navigator.onLine) {
          const cached = JSON.parse(localStorage.getItem(`quickstock_locations_${sheetId}_${area}`) || 'null') as { name: string; id: number; locations: string[] } | null;
          if (!cached) throw new Error('Open this inventory once while online before recording checks offline.');
          setTabName(cached.name); setSheetNumericId(cached.id); setLocations(cached.locations);
          const remembered = localStorage.getItem(`quickstock_last_check_location_${sheetId}_${area}`);
          if (remembered && cached.locations.includes(remembered)) setLocation(remembered);
          return;
        }
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
        const remembered = localStorage.getItem(`quickstock_last_check_location_${sheetId}_${area}`);
        if (remembered && found.some(item => item.title === remembered)) setLocation(remembered);
        localStorage.setItem(`quickstock_locations_${sheetId}_${area}`, JSON.stringify({ name, id: target.properties.sheetId, locations: found.map(item => item.title) }));
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
    (navigator.onLine ? getClassInventory(sheetId, tabName, location) : Promise.resolve(JSON.parse(localStorage.getItem(`quickstock_rows_${sheetId}_${tabName}_${location}`) || '[]') as SheetRow[]))
      .then(data => {
        if (cancelled) return;
        const ordered = [...data].sort((a, b) => a.row - b.row);
        setRows(ordered);
        if (navigator.onLine) localStorage.setItem(`quickstock_rows_${sheetId}_${tabName}_${location}`, JSON.stringify(ordered));
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
  const confirmDuplicateIds = async (candidate: SheetRow): Promise<boolean> => {
    if (!candidate.snid?.trim() && !candidate.hostname?.trim()) return true;
    try {
      const assets = await loadLocatedAssets(sheetId);
      const sourceLocation = `${area === 'class' ? 'Class' : 'Stock'}: ${location}`;
      const matches = findDuplicateMatches({ ...candidate, sourceLocation }, assets);
      if (!matches.length) return true;
      return window.confirm(`This asset ID is already used:\n\n${matches.map(match =>
        `${match.field} ${match.value}: ${match.matches.map(other => `${other.item} in ${other.sourceLocation}`).join(', ')}`
      ).join('\n')}\n\nSave anyway?`);
    } catch (err) {
      console.warn('Could not check duplicate asset IDs', err);
      return window.confirm('Could not check other locations for duplicate asset IDs. Save anyway?');
    }
  };
  const skip = () => {
    if (!draft || visibleRows.length < 2) return;
    const next = nextRow(visibleRows.filter(row => row.row !== draft.row), draft.row);
    if (next) focusRow(next);
  };

  const save = async () => {
    if (role === 'viewer') { setError(t('Editor access required.')); return; }
    if (!draft || !sheetId || !tabName) return;
    const name = draft.item.trim();
    const qty = draft.quantity.trim();
    if (!name) { setError(t('Enter an item name.')); return; }
    if (!/^\d+$/.test(qty)) { setError(t('Quantity must be a whole number, 0 or greater.')); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated: SheetRow = { ...draft, item: name, quantity: qty, tag: draft.tag?.trim(), type: draft.type?.trim(), hostname: draft.hostname?.trim(), snid: draft.snid?.trim(), location };
      if (!navigator.onLine) {
        queueCheck({ sheetId, tab: tabName, location, row: updated, original: rows.find(row => row.row === updated.row) });
        const nextRows = rows.map(row => row.row === updated.row ? updated : row);
        setRows(nextRows);
        localStorage.setItem(`quickstock_rows_${sheetId}_${tabName}_${location}`, JSON.stringify(nextRows));
        setNotice(`${name}: ${t('Saved on this device. Sync pending checks when online.')}`);
        return;
      }
      if (!(await confirmDuplicateIds(updated))) return;
      await updateClassInventory(sheetId, tabName, [updated]);
      const nextRows = rows.map(row => row.row === updated.row ? updated : row);
      setRows(nextRows);
      const candidates = showChecked ? nextRows : nextRows.filter(row => !isChecked(row));
      const next = nextRow(candidates.filter(row => row.row !== updated.row), updated.row) || (candidates.some(row => row.row === updated.row) ? updated : undefined);
      setDraft(next ? { ...next, status: 'Checked' } : null);
      setNotice(`${name}: ${t('Saved.')}`);
    } catch (err: any) {
      setError(err.message || t('Could not save this item. Your edits are still here.'));
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (role === 'viewer') { setError(t('Editor access required.')); return; }
    if (!location || !sheetId || !tabName) return;
    if (!newItem.item.trim()) { setError(t('Enter an item name.')); return; }
    if (!/^\d+$/.test(newItem.quantity.trim())) { setError(t('Quantity must be a whole number, 0 or greater.')); return; }
    setSaving(true);
    setError(null);
    try {
      if (!(await confirmDuplicateIds({ ...newItem, location }))) return;
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
      setNotice(t('Item added. Fill or check it now.'));
    } catch (err: any) {
      setError(err.message || t('Could not add the item.'));
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
      localStorage.setItem(`quickstock_last_check_location_${sheetId}_${area}`, name);
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
      {sheetId && <div role="status" className={`mb-3 rounded-xl border px-3 py-2 text-sm font-semibold ${!online || queuedCount ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100' : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100'}`}>
        {saving ? t('Saving to Google Sheets…') : syncing ? t('Syncing checks…') : !online ? `${t('Offline')} · ${queuedCount} ${t('checks waiting to sync')}` : queuedCount ? `${queuedCount} ${t('checks need sync')}` : error ? t('Needs attention · review the message below') : t('Online · checks saved to Google Sheets')}
        {queuedCount > 0 && <button type="button" disabled={!online || saving || syncing} onClick={async () => { setSyncing(true); const result = await syncChecks(); setSyncing(false); setNotice(result.error || `${result.synced} ${t('checks synced to Google Sheets.')}`); }} className="ml-3 rounded-lg bg-amber-800 px-3 py-2 font-bold text-white disabled:opacity-50">{t('Sync now')}</button>}
      </div>}
      <header className="on-inventory-header nova-panel">
        <div className="on-inventory-kicker"><CheckCircle2 size={15} /> {t('PHONE ENTRY MODE')}</div>
        <h1>{t('ON Inventory')}</h1>
        <p>{t('One item at a time. Fill the details, check it, save, and move on.')}</p>
      </header>

      {!sheetId ? <div className="nova-panel on-inventory-message" role="alert"><AlertCircle size={18} /> Connect a spreadsheet in <Link to="/settings">Settings <ArrowRight size={15} /></Link> to start.</div> : <>
        <section className="nova-panel on-inventory-setup" aria-label="Choose inventory area and location">
          <div className="on-inventory-segment" role="group" aria-label="Inventory area">
            <button type="button" className={area === 'stock' ? 'active' : ''} disabled={creatingLocation} onClick={() => { setArea('stock'); localStorage.setItem(`quickstock_last_area_${sheetId}`, 'stock'); setIsCreatingLocation(false); setNewLocationName(''); }}><Box size={18} /> {t('Stock Room')}</button>
            <button type="button" className={area === 'class' ? 'active' : ''} disabled={creatingLocation} onClick={() => { setArea('class'); localStorage.setItem(`quickstock_last_area_${sheetId}`, 'class'); setIsCreatingLocation(false); setNewLocationName(''); }}><Folder size={18} /> {t('Classes')}</button>
          </div>
          <label className="on-inventory-label" htmlFor="on-inventory-location">{t('Location')}</label>
          <div className="on-inventory-location-row">
            <SearchableSelect id="on-inventory-location" aria-label={t('Location')} value={location} disabled={loadingLocations || creatingLocation} placeholder={t(loadingLocations ? 'Loading locations...' : 'Choose a location')} searchPlaceholder={t('Search locations...')} options={locations.map(name => ({ value: name, label: name }))} onChange={value => { setLocation(value); localStorage.setItem(`quickstock_last_check_location_${sheetId}_${area}`, value); setAdding(false); setNewItem(emptyItem(value)); setNotice(null); }} />
            <button type="button" title="Refresh locations" aria-label="Refresh locations" onClick={() => setReloadKey(key => key + 1)} disabled={loadingLocations}><RefreshCw size={19} /></button>
          </div>
          {!isCreatingLocation ? <button type="button" className="on-inventory-create-link" onClick={() => { setIsCreatingLocation(true); setError(null); }} disabled={loadingLocations || !tabName}><Plus size={17} /> Add {area === 'class' ? 'class' : 'stock room'}</button> :
            <form className="on-inventory-create-form" onSubmit={createLocation}>
              <label htmlFor="on-inventory-new-location">{area === 'class' ? 'New class / room name' : 'New stock room name'}</label>
              <input id="on-inventory-new-location" value={newLocationName} onChange={event => setNewLocationName(event.target.value)} placeholder={area === 'class' ? 'e.g. Lab 102' : 'e.g. Storage A'} autoComplete="off" autoFocus disabled={creatingLocation} maxLength={100} required />
              <div><button type="button" onClick={() => { setIsCreatingLocation(false); setNewLocationName(''); setError(null); }} disabled={creatingLocation}>{t('Cancel')}</button><button type="submit" disabled={creatingLocation || !newLocationName.trim()}><Plus size={17} /> {t(creatingLocation ? 'Adding...' : `Add ${area === 'class' ? 'class' : 'stock room'}`)}</button></div>
            </form>}
          {!loadingLocations && locations.length === 0 && !error && !isCreatingLocation && <p className="on-inventory-hint">{t('No locations yet. Add one here to get started.')}</p>}
        </section>

        {error && <div className="on-inventory-alert" role="alert"><AlertCircle size={18} />{error}</div>}
        {notice && <div className="on-inventory-notice" role="status"><Check size={18} />{notice}</div>}

        {location && (loadingRows ? <div className="nova-panel on-inventory-message"><FluidSpinner size="md" /> {t('Loading items...')}</div> : <>
          <section className="nova-panel on-inventory-progress">
            <div><span>{t('PROGRESS IN')} {location.toUpperCase()}</span><strong>{completed} / {rows.length} {t('checked')}</strong></div>
            <div className="on-inventory-progress-track" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={rows.length} aria-label="Items checked"><span style={{ width: `${progress}%` }} /></div>
            <div className="on-inventory-progress-foot"><span>{pending.length} {t('remaining')}</span><button type="button" onClick={() => { setShowChecked(value => { const next = !value; const first = (next ? rows : pending)[0]; setDraft(first ? { ...first, status: 'Checked' } : null); return next; }); }} aria-pressed={showChecked}>{t(showChecked ? 'Show remaining' : 'Review all items')}</button></div>
          </section>

          {!adding && <div className="on-inventory-toolbar">
            <button type="button" className="on-inventory-add-button" disabled={role === 'viewer'} onClick={() => { setAdding(true); setNewItem(emptyItem(location)); setError(null); setNotice(null); }}><Plus size={18} /> {t('Add item')}</button>
            <Link to={area === 'stock' ? `/stock-room/${encodeURIComponent(location)}` : `/classes/${encodeURIComponent(location)}`}>{t('Open full list')} <ChevronRight size={16} /></Link>
          </div>}

          {!adding && rows.length === 0 ? <div className="nova-panel on-inventory-empty"><Box size={34} /><h2>{t('No items here yet')}</h2><p>{t('Tap “Add item” to start filling this location.')}</p></div> :
          !adding && !showChecked && pending.length === 0 ? <div className="nova-panel on-inventory-empty"><CheckCircle2 size={40} /><h2>{t('All items checked')}</h2><p>{location}: {t('complete. You can review the items or add another one.')}</p></div> :
          !adding && !draft ? <div className="nova-panel on-inventory-empty"><p>{t('Choose an item below to continue.')}</p></div> : null}

          {activeDraft && (adding || (showChecked || pending.length > 0)) && <section className="nova-panel on-inventory-form">
            <div className="on-inventory-form-head"><div><span>{adding ? t('NEW ITEM') : `${t('ITEM')} ${Math.max(1, visibleRows.findIndex(row => row.row === draft?.row) + 1)} ${t('OF')} ${visibleRows.length}`}</span><h2>{adding ? t('Add to inventory') : draft?.item}</h2></div>{adding && <button type="button" title={t('Cancel adding')} aria-label={t('Cancel adding')} onClick={() => setAdding(false)}><X size={20} /></button>}</div>
            <div className="on-inventory-fields">
              <label>{t('Item name')}<input value={activeDraft.item} onChange={event => change('item', event.target.value)} autoComplete="off" placeholder={t('e.g. Wireless Mouse')} /></label>
              <label>{t('Quantity')}<input type="number" min="0" step="1" inputMode="numeric" value={activeDraft.quantity} onChange={event => change('quantity', event.target.value)} /></label>
              <label>{t('Category / tag')}<input list="on-inventory-tags" value={activeDraft.tag || ''} onChange={event => change('tag', event.target.value)} placeholder={t('e.g. Peripheral')} /></label>
              <label>{t('Type / model')}<input list="on-inventory-types" value={activeDraft.type || ''} onChange={event => change('type', event.target.value)} placeholder={t('e.g. Logitech')} /></label>
              <label>{t('Hostname')}<input value={activeDraft.hostname || ''} onChange={event => change('hostname', event.target.value)} placeholder={t('Optional')} autoCapitalize="none" /></label>
              <label>{t('SNID / serial')}<div className="on-inventory-scan-field"><input value={activeDraft.snid || ''} onChange={event => change('snid', event.target.value)} placeholder={t('Scan or type')} autoCapitalize="characters" /><button type="button" title={t('Scan barcode photo')} aria-label={t('Scan barcode photo')} onClick={() => setScanner(true)}><Camera size={20} /></button></div></label>
              <datalist id="on-inventory-tags">{tags.map(tag => <option key={tag} value={tag} />)}</datalist>
              <datalist id="on-inventory-types">{types.map(type => <option key={type} value={type} />)}</datalist>
            </div>
            {!adding && <button type="button" className={`on-inventory-check ${activeDraft.status === 'Checked' ? 'active' : ''}`} onClick={() => change('status', activeDraft.status === 'Checked' ? '' : 'Checked')} aria-pressed={activeDraft.status === 'Checked'}><CheckCircle2 size={21} /><span>{t(activeDraft.status === 'Checked' ? 'Mark as checked on save' : 'Leave unchecked on save')}</span></button>}
            <div className="on-inventory-actions">
              {!adding && <button type="button" className="on-inventory-skip" onClick={skip} disabled={visibleRows.length < 2 || saving}><SkipForward size={18} /> {t('Skip')}</button>}
              {adding ? <button type="button" className="on-inventory-save" onClick={add} disabled={saving || role === 'viewer'}><Plus size={18} />{t(saving ? 'Adding...' : 'Add item')}</button> : <button type="button" className="on-inventory-save" onClick={save} disabled={saving || role === 'viewer'}><Save size={18} />{t(saving ? 'Saving...' : 'Save & next')}</button>}
            </div>
          </section>}

          {!adding && visibleRows.length > 1 && <section className="nova-panel on-inventory-queue"><h3>{t(showChecked ? 'All items' : 'Up next')}</h3><div>{visibleRows.slice(0, queueLimit).map(row => <button type="button" key={row.row} className={draft?.row === row.row ? 'active' : ''} onClick={() => focusRow(row)}><span>{row.item}</span>{isChecked(row) && <Check size={15} />}</button>)}</div>{visibleRows.length > queueLimit && <button type="button" className="mt-3 w-full justify-center" onClick={() => setQueueLimit(limit => limit + 30)}>{t('Show more items')} ({visibleRows.length - queueLimit} {t('left')})</button>}</section>}
        </>)}
      </>}
      {location && activeDraft && (adding || showChecked || pending.length > 0) && <div className="on-inventory-mobile-save"><span>{adding ? t('NEW ITEM') : activeDraft.item}</span><button type="button" onClick={adding ? add : save} disabled={saving || role === 'viewer'}>{saving ? t('Saving...') : t(adding ? 'Add item' : 'Save & next')}</button></div>}
      {scanner && <BarcodeScanner onResult={result => { change('snid', result); setScanner(false); }} onClose={() => setScanner(false)} />}
    </div>
  );
}
