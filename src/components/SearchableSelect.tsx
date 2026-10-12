import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function SearchableSelect({ id, value, options, onChange, placeholder = 'Choose an option', searchPlaceholder = 'Search options...', disabled, className = '', 'aria-label': ariaLabel }: Props) {
  const generatedId = useId().replace(/:/g, '');
  const listId = `${id || generatedId}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });

  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? options.filter(option => option.label.toLocaleLowerCase().includes(needle)) : options;
  }, [options, query]);

  useEffect(() => { setActiveIndex(Math.max(0, filtered.findIndex(option => !option.disabled))); }, [query, options]);

  useEffect(() => {
    if (open) panelRef.current?.querySelectorAll('[role="option"]')[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, filtered]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const availableBelow = window.innerHeight - rect.bottom - 12;
      const availableAbove = rect.top - 12;
      const placeAbove = availableBelow < 230 && availableAbove > availableBelow;
      const maxHeight = Math.max(100, Math.min(320, placeAbove ? availableAbove : availableBelow));
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
      setPosition({
        top: placeAbove ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
      });
    };
    updatePosition();
    searchRef.current?.focus();
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const handleScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      updatePosition();
    };
    document.addEventListener('pointerdown', handlePointer);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      let index = activeIndex;
      for (let i = 0; i < filtered.length; i++) {
        index = (index + step + filtered.length) % filtered.length;
        if (!filtered[index].disabled) { setActiveIndex(index); break; }
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex]?.disabled ? filtered.find(item => !item.disabled) : filtered[activeIndex];
      if (option) choose(option);
    }
  };

  return <>
    <button
      id={id}
      ref={triggerRef}
      type="button"
      disabled={disabled}
      role="combobox"
      aria-label={ariaLabel || placeholder}
      aria-expanded={open}
      aria-controls={listId}
      aria-haspopup="listbox"
      className={`searchable-select-trigger ${className}`}
      onClick={() => {
        setQuery('');
        setActiveIndex(Math.max(0, options.findIndex(option => option.value === value && !option.disabled)));
        setOpen(current => !current);
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setQuery(''); setOpen(true); }
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <span className={selected ? '' : 'searchable-select-placeholder'}>{selected?.label || placeholder}</span>
      <ChevronDown size={17} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={panelRef} className="searchable-select-panel" style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
        <div className="searchable-select-search"><Search size={17} aria-hidden="true" /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={handleKeyDown} placeholder={searchPlaceholder} aria-label={searchPlaceholder} aria-autocomplete="list" aria-controls={listId} aria-activedescendant={filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined} /></div>
        <div id={listId} role="listbox" className="searchable-select-options" aria-label={ariaLabel || placeholder}>
          {filtered.length ? filtered.map((option, index) => <button
            id={`${listId}-${index}`}
            key={`${option.value}-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            disabled={option.disabled}
            className={`searchable-select-option ${activeIndex === index ? 'active' : ''}`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          ><span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" />}</button>) : <div className="searchable-select-empty">No matching options</div>}
        </div>
      </div>, document.body
    )}
  </>;
}
