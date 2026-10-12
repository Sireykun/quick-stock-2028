import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FolderPlus, Plus, Tag, Trash2 } from 'lucide-react';
import { getMergedCustomDropdowns, updateMergedAllDropdowns, type CustomDropdowns } from '../lib/dropdowns';
import { FluidSpinner } from '../components/FluidSpinner';

const DEFAULT_CATEGORIES = ['Computer', 'Peripheral', 'Accessory', 'Cable', 'TV', 'Interactive', 'Other'];

export function ModelsList() {
  const [dropdowns, setDropdowns] = useState<CustomDropdowns>({ tags: [], typesByTag: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Computer');
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newType, setNewType] = useState('');
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';

  useEffect(() => {
    if (!sheetId) {
      setLoading(false);
      setError('Connect your spreadsheet in Settings to manage categories and types.');
      return;
    }
    getMergedCustomDropdowns()
      .then(setDropdowns)
      .catch((err: any) => setError(err.message || 'Could not load types.'))
      .finally(() => setLoading(false));
  }, [sheetId]);

  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...dropdowns.tags])).sort((a, b) => a.localeCompare(b));
  const types = dropdowns.typesByTag[selectedCategory] || [];
  const totalTypes = Object.values(dropdowns.typesByTag).reduce<number>((count, list) => count + (Array.isArray(list) ? list.length : 0), 0);

  const save = async (next: CustomDropdowns, message: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateMergedAllDropdowns(next);
      setDropdowns(next);
      setNotice(message);
      return true;
    } catch (err: any) {
      setError(err.message || 'Could not save your changes. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some(category => category.toLowerCase() === name.toLowerCase())) {
      setError(`Category “${name}” already exists.`);
      return;
    }
    const next = { tags: [...dropdowns.tags, name], typesByTag: { ...dropdowns.typesByTag } };
    if (await save(next, `Category “${name}” added.`)) {
      setSelectedCategory(name);
      setNewCategory('');
      setShowCategoryForm(false);
    }
  };

  const addType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newType.trim();
    if (!name) return;
    if (types.some(type => type.toLowerCase() === name.toLowerCase())) {
      setError(`“${name}” is already listed under ${selectedCategory}.`);
      return;
    }
    const next = { ...dropdowns, typesByTag: { ...dropdowns.typesByTag, [selectedCategory]: [...types, name] } };
    if (await save(next, `“${name}” added to ${selectedCategory}.`)) setNewType('');
  };

  const removeType = async (name: string) => {
    if (!window.confirm(`Remove “${name}” from ${selectedCategory} choices?`)) return;
    const next = { ...dropdowns, typesByTag: { ...dropdowns.typesByTag, [selectedCategory]: types.filter(type => type !== name) } };
    await save(next, `“${name}” removed.`);
  };

  const removeCategory = async () => {
    if (!window.confirm(`Remove “${selectedCategory}” and its ${types.length} type choices?`)) return;
    const next = { tags: dropdowns.tags.filter(tag => tag !== selectedCategory), typesByTag: { ...dropdowns.typesByTag } };
    delete next.typesByTag[selectedCategory];
    if (await save(next, `Category “${selectedCategory}” removed.`)) setSelectedCategory('Computer');
  };

  if (loading) return <div className="flex flex-col items-center justify-center p-12"><FluidSpinner size="md" /><p className="text-slate-500">Loading types...</p></div>;

  return (
    <div className="inventory-setup-page">
      <header className="inventory-setup-hero nova-panel">
        <Link to="/" aria-label="Back to dashboard" className="inventory-setup-back"><ArrowLeft size={18} /></Link>
        <span className="inventory-setup-kicker">INVENTORY OPTIONS</span>
        <h1>Categories & types</h1>
        <p>Organize equipment choices for inventory forms. Choose a category, then add the types or models that belong to it.</p>
        <div className="inventory-setup-example"><span>EXAMPLE</span><strong>Peripheral</strong><span>→</span><strong>Keyboard</strong></div>
      </header>

      {error && <div className="inventory-setup-alert" role="alert"><AlertCircle size={18} />{error}{!sheetId && <Link to="/settings">Open Settings</Link>}</div>}
      {notice && <div className="inventory-setup-success" role="status">{notice}</div>}
      {saving && <div className="inventory-setup-saving" role="status"><FluidSpinner size="sm" /> Saving changes...</div>}

      <section className="nova-panel inventory-setup-card">
        <div className="inventory-setup-section-head"><div><span>STEP 1</span><h2>Choose a category</h2><p>Types below will appear under this category.</p></div><b>{categories.length} categories</b></div>
        <div className="inventory-category-grid" role="group" aria-label="Categories">
          {categories.map(category => <button key={category} type="button" className={selectedCategory === category ? 'active' : ''} aria-pressed={selectedCategory === category} onClick={() => { setSelectedCategory(category); setError(null); setNotice(null); }}><Tag size={16} />{category}<span>{dropdowns.typesByTag[category]?.length || 0}</span></button>)}
        </div>
        {!showCategoryForm ? <button type="button" className="inventory-setup-outline" onClick={() => setShowCategoryForm(true)} disabled={saving || !sheetId}><FolderPlus size={17} /> Add category</button> :
          <form className="inventory-setup-inline-form" onSubmit={addCategory}><label htmlFor="new-category">New category name</label><div><input id="new-category" value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="e.g. Audio" autoFocus maxLength={80} /><button type="button" onClick={() => { setShowCategoryForm(false); setNewCategory(''); }} disabled={saving}>Cancel</button><button type="submit" disabled={saving || !newCategory.trim()}>Add</button></div></form>}
      </section>

      <section className="nova-panel inventory-setup-card">
        <div className="inventory-setup-section-head"><div><span>STEP 2</span><h2>Types for {selectedCategory}</h2><p>Add names people can select when filling an item.</p></div><b>{types.length} in this category</b></div>
        <form className="inventory-setup-inline-form" onSubmit={addType}><label htmlFor="new-type">New type or model name</label><div><input id="new-type" value={newType} onChange={event => setNewType(event.target.value)} placeholder={selectedCategory === 'Peripheral' ? 'e.g. Keyboard' : 'e.g. Laptop'} maxLength={100} /><button type="submit" disabled={saving || !sheetId || !newType.trim()}><Plus size={17} /> Add type</button></div></form>
        {types.length === 0 ? <div className="inventory-setup-empty">No types in {selectedCategory} yet. Add the first one above.</div> :
          <div className="inventory-type-grid">{types.map(type => <div key={type}><span>{type}</span><button type="button" aria-label={`Remove ${type}`} title={`Remove ${type}`} disabled={saving} onClick={() => removeType(type)}><Trash2 size={17} /></button></div>)}</div>}
        {!DEFAULT_CATEGORIES.includes(selectedCategory) && <button type="button" className="inventory-setup-delete" onClick={removeCategory} disabled={saving}><Trash2 size={16} /> Remove {selectedCategory} category</button>}
      </section>
      <p className="inventory-setup-footnote">{totalTypes} custom type choices available across all categories.</p>
    </div>
  );
}
