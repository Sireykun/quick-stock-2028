import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, Box, Building2, CheckCircle2, ChevronRight, Folder, Layers, Package, Sparkles, Tag } from 'lucide-react';
import { getDashboardSummary, DashboardSummary } from '../lib/sheets';
import { getItemIcon } from '../lib/utils';
import { HomeClock } from '../components/HomeClockSchedule';
import { InventoryBot } from '../components/InventoryBot';
import { useLanguage } from '../components/LanguageProvider';

export function Home() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setIsMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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

  const totalItems = summary ? summary.classes.totalItems + summary.stock.totalItems + summary.office.totalItems + summary.otherRooms.totalItems : 0;
  const checkedItems = summary ? summary.classes.checkedItems + summary.stock.checkedItems + summary.office.checkedItems + summary.otherRooms.checkedItems : 0;
  const verifiedPercent = totalItems ? Math.round((checkedItems / totalItems) * 100) : 0;
  const missingAlerts = summary?.missingTemplateAlerts || [];
  const heroMessages = summary?.templateAlertsError
    ? [{ label: 'INVENTORY UPDATE', text: 'Room alerts could not be checked. Refresh to try again.', href: '/classes', alert: false }]
    : missingAlerts.length
      ? missingAlerts.slice(0, 5).map(alert => ({
          label: `${alert.template === 'lab' ? 'LAB' : 'CLASS'} ALERT · ${alert.room}`,
          text: `${alert.missingItems.length} ${alert.missingItems.length === 1 ? 'default item is' : 'default items are'} missing: ${alert.missingItems.slice(0, 2).join(', ')}${alert.missingItems.length > 2 ? '…' : ''}`,
          href: `/classes/${encodeURIComponent(alert.room)}`,
          alert: true,
        }))
      : summary
        ? [{ label: 'INVENTORY UPDATE', text: 'No rooms are missing default items.', href: '/classes', alert: false }]
        : [{ label: 'INVENTORY UPDATE', text: loading ? 'Checking your inventory…' : 'Connect a sheet to see live alerts.', href: '/settings', alert: false }];

  const heroMessage = heroMessages[0];
  const renderMissingAlerts = (alerts = missingAlerts, duplicate = false) => alerts.map(alert => (
    <Link
      key={alert.room}
      to={`/classes/${encodeURIComponent(alert.room)}`}
      className="nova-alert-item"
      tabIndex={duplicate ? -1 : undefined}
      aria-label={`${alert.room}: missing ${alert.missingItems.join(', ')}`}
    >
      <AlertTriangle size={16} aria-hidden="true" />
      <strong>{alert.room}</strong>
      <span className="nova-alert-kind">{alert.template === 'lab' ? 'Lab defaults' : 'Class defaults'}</span>
      <span className="nova-alert-detail">Missing {alert.missingItems.join(', ')}</span>
      <ChevronRight size={15} aria-hidden="true" />
    </Link>
  ));

  return (
    <div className="nova-dashboard">
      <section className="nova-hero nova-panel">
        <div className="nova-hero-copy">
          <div className="nova-eyebrow"><Sparkles size={14} /> {t('INVENTORY WORKSPACE')} <span className="nova-live-dot" /> {t('LIVE OVERVIEW')}</div>
          <HomeClock />
          <p className="nova-hero-subtitle">{t('Your day, in clear view.')}</p>
          <p className="nova-hero-description">{t('Track what is in storage, what is deployed, and what needs attention across your inventory.')}</p>
          <div className="nova-hero-actions">
            <Link to="/on-inventory" className="nova-primary-button">{t('START ON INVENTORY')} <ArrowRight size={16} /></Link>
            <Link to="/stock-room" className="nova-secondary-button">{t('VIEW STOCK')} <ChevronRight size={16} /></Link>
          </div>
        </div>
        <div className="nova-hero-art nova-status-art">
          <div className="nova-status-top"><div className="nova-status-overview"><Package size={30} strokeWidth={1.5} /><span>{t('INVENTORY STATUS')}</span><strong>{summary ? totalItems : '—'}</strong><span>{t('assets tracked')}</span></div><InventoryBot summary={summary} /></div>
          <Link to={heroMessage.href} className={`nova-hero-alert ${heroMessage.alert ? 'nova-hero-alert-warning' : ''}`}>
            <span className="nova-hero-alert-icon">{heroMessage.alert ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}</span>
            <span className="nova-hero-alert-copy"><strong>{heroMessage.label}</strong><span>{heroMessage.text}</span></span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {summary && (
        <section className="nova-alerts nova-panel" aria-label="Rooms missing default items">
          <div className="nova-alerts-heading"><AlertTriangle size={16} /><strong>ROOM ALERTS</strong><span>{summary.templateAlertsError ? 'Could not check all defaults' : `${missingAlerts.length} ${missingAlerts.length === 1 ? 'room' : 'rooms'} need attention`}</span></div>
          {missingAlerts.length > 0 && !isMobile ? (
            <div className="nova-alert-window">
              <div className="nova-alert-track" style={{ animationDuration: `${Math.max(18, missingAlerts.length * 6)}s` }}>
                <div className="nova-alert-group">{renderMissingAlerts()}</div>
                <div className="nova-alert-group" aria-hidden="true">{renderMissingAlerts(missingAlerts, true)}</div>
              </div>
            </div>
          ) : missingAlerts.length === 0 ? <p className="nova-alert-clear">{summary.templateAlertsError ? 'Refresh the page to check room defaults again.' : 'No missing default items found in classes or labs.'}</p> : null}
          {missingAlerts.length > 0 && isMobile && <div className="nova-alert-mobile">
            <div id="mobile-room-alerts" className="nova-alert-mobile-list">{renderMissingAlerts(showAllAlerts ? missingAlerts : missingAlerts.slice(0, 3))}</div>
            {missingAlerts.length > 3 && <button type="button" aria-controls="mobile-room-alerts" aria-expanded={showAllAlerts} onClick={() => setShowAllAlerts(value => !value)} className="nova-alert-mobile-toggle">{showAllAlerts ? t('Show fewer') : `${t('Show all')} ${missingAlerts.length} ${t('room alerts')}`}</button>}
          </div>}
        </section>
      )}

      <section className="nova-stats nova-panel" aria-label="Inventory statistics">
        <div className="nova-stat"><Package size={19} /><strong>{summary ? totalItems : '—'}</strong><span>{t('Total assets')}</span></div>
        <div className="nova-stat"><Folder size={19} /><strong>{summary?.classes.totalItems ?? '—'}</strong><span>{t('Deployed in classes')}</span></div>
        <div className="nova-stat"><Box size={19} /><strong>{summary?.stock.totalItems ?? '—'}</strong><span>{t('In stock rooms')}</span></div>
        <div className="nova-stat"><CheckCircle2 size={19} /><strong>{summary ? `${verifiedPercent}%` : '—'}</strong><span>{t('Assets verified')}</span></div>
        <div className="nova-stats-note">Know what you have.<br />Find what you need.<br /><span>— Quick Stock</span></div>
      </section>

      {loading ? (
        <div className="nova-panel nova-message animate-pulse">Loading inventory summary...</div>
      ) : error ? (
        <div className="nova-panel nova-message" role="alert">{error} <Link to="/settings">Open settings <ArrowRight size={14} /></Link></div>
      ) : summary && (
        <>
          <section className="nova-section nova-panel">
            <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> {t('INVENTORY OVERVIEW')}</span><Link to="/rooms" aria-label="View all rooms"><ChevronRight size={18} /></Link></div>
            <div className="nova-feature-grid">
              <Link to="/stock-room" className="nova-feature-card nova-stock-card">
                <div className="nova-feature-visual"><Box size={76} strokeWidth={0.9} /><span>01</span></div>
                <div className="nova-feature-copy"><h3>{t('Stock rooms')}</h3><p>See what is ready to use and where it is stored.</p><span className="nova-card-tag">{summary.stock.totalItems} assets <ArrowRight size={13} /></span></div>
              </Link>
              <Link to="/classes" className="nova-feature-card nova-class-card">
                <div className="nova-feature-visual"><Folder size={76} strokeWidth={0.9} /><span>02</span></div>
                <div className="nova-feature-copy"><h3>{t('Classes')}</h3><p>Review equipment deployed across learning spaces.</p><span className="nova-card-tag">{summary.classes.totalItems} assets <ArrowRight size={13} /></span></div>
              </Link>
              <Link to="/rooms/Office" className="nova-feature-card nova-office-card">
                <div className="nova-feature-visual"><Building2 size={76} strokeWidth={0.9} /><span>03</span></div>
                <div className="nova-feature-copy"><h3>{t('Office')}</h3><p>Review assets in general Office and departments.</p><span className="nova-card-tag">{summary.office.totalItems} assets <ArrowRight size={13} /></span></div>
              </Link>
              <Link to="/rooms" className="nova-feature-card nova-room-card">
                <div className="nova-feature-visual"><Layers size={76} strokeWidth={0.9} /><span>04</span></div>
                <div className="nova-feature-copy"><h3>{t('Other rooms')}</h3><p>Explore equipment in your added rooms.</p><span className="nova-card-tag">{summary.otherRooms.totalItems} assets <ArrowRight size={13} /></span></div>
              </Link>
            </div>
          </section>

          <div className="nova-insights-grid">
            <section className="nova-panel nova-insight-card">
              <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> {t('CATEGORY MIX')}</span><Tag size={17} /></div>
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
              <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> {t('VERIFICATION')}</span><Activity size={17} /></div>
              <div className="nova-verification-body">
                <div className="nova-verification-ring" style={{ '--progress': `${verifiedPercent}%` } as React.CSSProperties}><div><strong>{verifiedPercent}%</strong><span>verified</span></div></div>
                <p><strong>{checkedItems} of {totalItems}</strong> assets checked across all rooms.</p>
              </div>
              <Link to="/investigate" className="nova-text-link">{t('Investigate inventory')} <ArrowRight size={15} /></Link>
            </section>
            <section className="nova-panel nova-insight-card nova-latest">
              <div className="nova-section-heading"><span><span className="nova-heading-mark">✦</span> {t('TOP ITEMS')}</span><Link to="/items" aria-label="View item library"><ChevronRight size={18} /></Link></div>
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
