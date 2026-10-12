import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Box, CheckCircle2, ChevronRight, Folder, Layers, Package, Sparkles, Tag } from 'lucide-react';
import { getDashboardSummary, DashboardSummary } from '../lib/sheets';
import { getItemIcon } from '../lib/utils';

export function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const sheetId = localStorage.getItem('quickStock_classesSheetId');
        if (!sheetId) {
          setError('Spreadsheet ID is not configured. Please go to Settings.');
          return;
        }
        setSummary(await getDashboardSummary(sheetId));
      } catch (err: any) {
        console.error('Failed to load inventory summary', err);
        setError(err.message || 'Failed to load inventory summary');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const totalItems = summary ? summary.classes.totalItems + summary.stock.totalItems : 0;
  const checkedItems = summary ? summary.classes.checkedItems + summary.stock.checkedItems : 0;
  const verifiedPercent = totalItems ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <div className="nova-dashboard">
      <section className="nova-hero nova-panel">
        <div className="nova-hero-copy">
          <div className="nova-eyebrow"><Sparkles size={14} /> INVENTORY WORKSPACE <span className="nova-live-dot" /> LIVE OVERVIEW</div>
          <h1>QUICK<br /><span>STOCK</span></h1>
          <p className="nova-hero-subtitle">A clearer view of every asset.</p>
          <p className="nova-hero-description">Track what is in storage, what is deployed, and what needs attention across your inventory.</p>
          <div className="nova-hero-actions">
            <Link to="/on-inventory" className="nova-primary-button">START ON INVENTORY <ArrowRight size={16} /></Link>
            <Link to="/stock-room" className="nova-secondary-button">VIEW STOCK <ChevronRight size={16} /></Link>
          </div>
        </div>
        <div className="nova-hero-art" aria-hidden="true">
          <div className="nova-orbit nova-orbit-one" />
          <div className="nova-orbit nova-orbit-two" />
          <div className="nova-glass-object"><Box strokeWidth={1.05} /></div>
          <span className="nova-art-spark nova-art-spark-one">✦</span>
          <span className="nova-art-spark nova-art-spark-two">✧</span>
          <div className="nova-art-label">DESIGNED FOR CLARITY · BUILT FOR CONTROL</div>
        </div>
      </section>

      <section className="nova-stats nova-panel" aria-label="Inventory statistics">
        <div className="nova-stat"><Package size={19} /><strong>{summary ? totalItems : '—'}</strong><span>Total assets<br />tracked</span></div>
        <div className="nova-stat"><Folder size={19} /><strong>{summary?.classes.totalItems ?? '—'}</strong><span>Deployed in<br />classes</span></div>
        <div className="nova-stat"><Box size={19} /><strong>{summary?.stock.totalItems ?? '—'}</strong><span>In stock<br />rooms</span></div>
        <div className="nova-stat"><CheckCircle2 size={19} /><strong>{summary ? `${verifiedPercent}%` : '—'}</strong><span>Assets<br />verified</span></div>
        <div className="nova-stats-note">Know what you have.<br />Find what you need.<br /><span>— Quick Stock</span></div>
      </section>

      {loading ? (
        <div className="nova-panel nova-message animate-pulse">Loading inventory summary...</div>
      ) : error ? (
        <div className="nova-panel nova-message" role="alert">{error} <Link to="/settings">Open settings <ArrowRight size={14} /></Link></div>
      ) : summary && (
        <>
          <section className="nova-section nova-panel">
            <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> INVENTORY OVERVIEW</span><Link to="/items" aria-label="View all items"><ChevronRight size={18} /></Link></div>
            <div className="nova-feature-grid">
              <Link to="/stock-room" className="nova-feature-card nova-stock-card">
                <div className="nova-feature-visual"><Box size={76} strokeWidth={0.9} /><span>01</span></div>
                <div className="nova-feature-copy"><h3>Stock rooms</h3><p>See what is ready to use and where it is stored.</p><span className="nova-card-tag">{summary.stock.totalItems} assets <ArrowRight size={13} /></span></div>
              </Link>
              <Link to="/classes" className="nova-feature-card nova-class-card">
                <div className="nova-feature-visual"><Folder size={76} strokeWidth={0.9} /><span>02</span></div>
                <div className="nova-feature-copy"><h3>Classes</h3><p>Review equipment deployed across learning spaces.</p><span className="nova-card-tag">{summary.classes.totalItems} assets <ArrowRight size={13} /></span></div>
              </Link>
              <Link to="/items" className="nova-feature-card nova-item-card">
                <div className="nova-feature-visual"><Layers size={76} strokeWidth={0.9} /><span>03</span></div>
                <div className="nova-feature-copy"><h3>Item library</h3><p>Browse the names and categories behind every asset.</p><span className="nova-card-tag">{summary.items.length} unique items <ArrowRight size={13} /></span></div>
              </Link>
            </div>
          </section>

          <div className="nova-insights-grid">
            <section className="nova-panel nova-insight-card">
              <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> CATEGORY MIX</span><Tag size={17} /></div>
              <div className="nova-category-list">
                {summary.tags.length === 0 ? <p className="nova-empty">No categories found.</p> : summary.tags.slice(0, 6).map((tag, index) => (
                  <div className="nova-category" key={`${tag.name}-${index}`}>
                    <div><span>{tag.name}</span><b>{tag.quantity}</b></div>
                    <div className="nova-progress"><span style={{ width: `${totalItems ? (tag.quantity / totalItems) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
            <section className="nova-panel nova-insight-card nova-verification">
              <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> VERIFICATION</span><Activity size={17} /></div>
              <div className="nova-verification-body">
                <div className="nova-verification-ring" style={{ '--progress': `${verifiedPercent}%` } as React.CSSProperties}><div><strong>{verifiedPercent}%</strong><span>verified</span></div></div>
                <p><strong>{checkedItems} of {totalItems}</strong> assets checked across stock rooms and classes.</p>
              </div>
              <Link to="/investigate" className="nova-text-link">Investigate inventory <ArrowRight size={15} /></Link>
            </section>
            <section className="nova-panel nova-insight-card nova-latest">
              <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> TOP ITEMS</span><Link to="/items" aria-label="View item library"><ChevronRight size={18} /></Link></div>
              <div className="nova-top-items">
                {summary.items.length === 0 ? <p className="nova-empty">No items found.</p> : summary.items.slice(0, 5).map((item, index) => {
                  const ItemIcon = getItemIcon(item.name || '', item.tag || '', item.type || '');
                  return <div className="nova-top-item" key={`${item.name}-${index}`}><div className="nova-top-item-icon"><ItemIcon size={17} /></div><div><strong>{item.name}</strong><span>{item.tag || 'Uncategorized'}</span></div><b>{item.quantity}</b></div>;
                })}
              </div>
            </section>
          </div>
          <div className="nova-footer"><span>© {new Date().getFullYear()} Quick Stock</span><span>EVERY ASSET, IN VIEW. ✦</span></div>
        </>
      )}
    </div>
  );
}
