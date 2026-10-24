import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import type { DashboardSummary } from '../lib/sheets';

type Message = { from: 'bot' | 'user'; text: string };

function answer(question: string, summary: DashboardSummary | null): string {
  if (!summary) return 'I am waiting for the inventory sheet. Connect Google Sheets in Settings or refresh this page, then ask me again.';
  const q = question.toLowerCase();
  const total = summary.classes.totalItems + summary.stock.totalItems + summary.office.totalItems + summary.otherRooms.totalItems;
  const checked = summary.classes.checkedItems + summary.stock.checkedItems + summary.office.checkedItems + summary.otherRooms.checkedItems;
  const alerts = summary.missingTemplateAlerts;
  if (/missing|alert|default|attention/.test(q)) {
    if (summary.templateAlertsError) return 'I could not check every room’s default items. Refresh the page to retry.';
    if (!alerts.length) return 'No rooms are currently missing default items.';
    const top = alerts.slice(0, 3).map(a => `${a.room}: ${a.missingItems.join(', ')}`).join(' · ');
    return `${alerts.length} rooms need attention. ${top}${alerts.length > 3 ? ' · Open Room Alerts below to see the rest.' : ''}`;
  }
  if (/verif|check|audit|percent/.test(q)) return `${checked} of ${total} assets are verified (${total ? Math.round(checked / total * 100) : 0}%). Open Investigate for the items still needing a check.`;
  if (/stock|stor/.test(q)) return `${summary.stock.totalItems} assets are in stock rooms.`;
  if (/class|deploy/.test(q)) return `${summary.classes.totalItems} assets are deployed in classes.`;
  if (/office|department/.test(q)) return `${summary.office.totalItems} assets are in Office and its departments.`;
  if (/room/.test(q)) return `${summary.stock.totalItems} in stock rooms, ${summary.classes.totalItems} in classes, ${summary.office.totalItems} in Office, and ${summary.otherRooms.totalItems} in other rooms.`;
  if (/top|popular|most|item/.test(q)) {
    const top = [...summary.items].sort((a, b) => b.quantity - a.quantity).slice(0, 3);
    return top.length ? `Top tracked items: ${top.map(i => `${i.name} (${i.quantity})`).join(', ')}.` : 'I cannot find any item counts in the connected sheet yet.';
  }
  if (/total|how many|asset|status|inventory/.test(q)) return `${total} assets are tracked: ${summary.classes.totalItems} in classes, ${summary.stock.totalItems} in stock rooms, ${summary.office.totalItems} in Office, and ${summary.otherRooms.totalItems} in other rooms.`;
  return 'I can help with totals, stock, classes, Office, missing defaults, verification, and top items. Try “What needs attention?”';
}

function Robot() {
  return <svg className="inventory-bot-art" viewBox="0 0 104 112" role="img" aria-label="Blue pixel robot assistant" shapeRendering="crispEdges">
    <ellipse cx="52" cy="106" rx="20" ry="4" fill="#071c2b" opacity=".65" />
    <path d="M18 30h-7v7H6v21h6v9h9v9h13v5h36v-5h13v-9h9v-9h6V37h-6v-7h-8v-9H72v-7H33v7H20z" fill="#10152d" />
    <path d="M19 30h-7v8H7v19h6v9h9v8h12V22h-9v8zm66 0h7v8h5v19h-6v9h-9v8H70V22h9v8z" fill="#4778df" />
    <path d="M25 22h9v-7h37v7h10v8h10v8h4v19h-5v9h-9v8H23v-8h-9v-9H9V38h6v-8h10z" fill="#6494f4" stroke="#243568" strokeWidth="2" />
    <path d="M28 73h48v9h7v9h-8v10H64v-8H40v8H29V91h-8v-9h7z" fill="#457ae4" stroke="#18254e" strokeWidth="3" />
    <path d="M35 78h34v13H35z" fill="#5689f0" />
    <path d="M29 42h46v29H29z" fill="#101a33" stroke="#253766" strokeWidth="4" />
    <path className="inventory-bot-eye" d="m42 51 6 6-6 6m20-5h7" fill="none" stroke="#9cf7ff" strokeWidth="4" strokeLinecap="square" />
    <path d="M47 81h4v3h-4zm7 0h4v3h-4z" fill="#d3fbff" />
    <path d="M23 85h-9v8h8zm59 0h9v8h-8z" fill="#5284e9" stroke="#16254d" strokeWidth="2" />
  </svg>;
}

export function InventoryBot({ summary }: { summary: DashboardSummary | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', text: 'Hi! Ask me about your inventory, missing items, or verified assets.' }]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, open]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const ask = (value: string) => {
    const question = value.trim();
    if (!question) return;
    setMessages(current => [...current, { from: 'user', text: question }, { from: 'bot', text: answer(question, summary) }]);
    setDraft('');
  };
  return <>
    <button type="button" className="inventory-bot-trigger" onClick={() => setOpen(true)} aria-label="Ask the inventory assistant" title="Ask the inventory assistant">
      <Robot />
      <span className="inventory-bot-hint"><MessageCircle size={13} /> Ask me</span>
    </button>
    {open && createPortal(<div className="inventory-bot-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="inventory-bot-dialog" role="dialog" aria-modal="true" aria-label="Inventory assistant">
        <header className="inventory-bot-header"><span><Robot /><span><strong>Inventory assistant</strong><small>Answers from your current sheet</small></span></span><button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={20} /></button></header>
        <div className="inventory-bot-messages" role="log" aria-live="polite">{messages.map((message, index) => <p key={index} className={`inventory-bot-message inventory-bot-message-${message.from}`}>{message.text}</p>)}<div ref={endRef} /></div>
        <div className="inventory-bot-suggestions">{['How many assets?', 'What needs attention?', 'How many verified?'].map(prompt => <button type="button" key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}</div>
        <form className="inventory-bot-form" onSubmit={event => { event.preventDefault(); ask(draft); }}><input ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask about your inventory…" aria-label="Ask about your inventory" maxLength={200} /><button type="submit" disabled={!draft.trim()} aria-label="Send question"><Send size={18} /></button></form>
      </section>
    </div>, document.body)}
  </>;
}
