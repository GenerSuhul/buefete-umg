import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '../ui';

export type LookupOption = { value: string; label: string };

export function RelationLookup({ label, value, onChange, load, emptyLabel = 'Seleccione un registro', required = false }: { label: string; value: string; onChange: (value: string) => void; load: (search: string) => Promise<LookupOption[]>; emptyLabel?: string; required?: boolean }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selected, setSelected] = useState<LookupOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const listId = useId();
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      loadRef.current(search)
        .then((items) => {
          if (!active) return;
          setOptions(items);
          setActiveIndex(0);
          const current = items.find((item) => item.value === value);
          if (current) setSelected(current);
        })
        .catch(() => { if (active) setError('No se pudieron cargar los registros.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, value, revision]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  const visibleOptions = selected && selected.value === value && !options.some((item) => item.value === value)
    ? [selected, ...options]
    : options;
  const choose = (item: LookupOption) => { setSelected(item); onChange(item.value); setSearch(''); setOpen(false); };

  return <div className="field"><span>{label}{required ? ' *' : ''}</span>
    <div className="relation-lookup" ref={container} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <label className="relation-lookup__search">
        <Search size={16} />
        <input role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && !loading && visibleOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          value={open ? search : (value && selected?.value === value ? selected.label : search)}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={(event) => { setSearch(event.target.value); setLoading(true); setOpen(true); if (value) onChange(''); }}
          placeholder="Buscar por nombre, DPI o referencia…" autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setOpen(true);
              setActiveIndex(i => Math.max(0, Math.min(visibleOptions.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1))));
            }
            if (event.key === 'Enter' && open) { event.preventDefault(); if (!loading && visibleOptions[activeIndex]) choose(visibleOptions[activeIndex]); }
          }} />
      </label>
      {open && <div className="relation-lookup__results">
        {loading ? <small role="status">Buscando registros…</small> : error ? <div role="alert">{error} <Button type="button" variant="ghost" size="sm" onClick={() => setRevision(r => r + 1)}>Reintentar</Button></div> : null}
        <div role="listbox" id={listId} aria-label={`Resultados de ${label.toLowerCase()}`}>
          {!loading && !error && visibleOptions.map((item, index) => <button type="button" role="option" id={`${listId}-${index}`} aria-selected={item.value === value} className={index === activeIndex ? 'active' : ''} key={item.value} onPointerDown={event => event.preventDefault()} onClick={() => choose(item)}>{item.label}</button>)}
        </div>
        {!loading && !error && !visibleOptions.length && <small role="status">Sin coincidencias. {emptyLabel}.</small>}
      </div>}
    </div>
  </div>;
}

export function FilterBar({ value, onChange, placeholder, children }: { value: string; onChange: (value: string) => void; placeholder: string; children?: ReactNode }) {
  return <div className="filter-bar"><label className="search-field"><Search size={18} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>Ctrl K</kbd></label>{children}<Button variant="secondary" size="icon" aria-label="Más filtros"><SlidersHorizontal size={18} /></Button></div>;
}

export function Pagination({ page, totalPages, totalCount, onPageChange }: { page: number; totalPages: number; totalCount: number; onPageChange: (page: number) => void }) {
  const lastPage = Math.max(totalPages, 1);
  return <nav className="pagination" aria-label="Paginación"><span>{totalCount} registros</span><div><Button variant="secondary" size="icon" disabled={page <= 1} aria-label="Página anterior" onClick={() => onPageChange(page - 1)}><ChevronLeft size={17} /></Button><span>Página {page} de {lastPage}</span><Button variant="secondary" size="icon" disabled={page >= lastPage} aria-label="Página siguiente" onClick={() => onPageChange(page + 1)}><ChevronRight size={17} /></Button></div></nav>;
}

export function DetailTabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string; count?: number }>; active: string; onChange: (id: string) => void }) {
  return <div className="detail-tabs" role="tablist">{tabs.map((tab) => <button type="button" role="tab" aria-selected={active === tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)} key={tab.id}>{tab.label}{tab.count !== undefined && <span>{tab.count}</span>}</button>)}</div>;
}

export function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return <div className="info-item"><span>{label}</span><strong>{value === null || value === undefined || value === '' ? 'No registrado' : value}</strong></div>;
}
