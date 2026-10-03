import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Field, Select } from '../ui';

export type LookupOption = { value: string; label: string };

export function RelationLookup({ label, value, onChange, load, emptyLabel = 'Seleccione un registro', required = false }: { label: string; value: string; onChange: (value: string) => void; load: (search: string) => Promise<LookupOption[]>; emptyLabel?: string; required?: boolean }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selected, setSelected] = useState<LookupOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          const current = items.find((item) => item.value === value);
          if (current) setSelected(current);
        })
        .catch(() => { if (active) setError('No se pudieron cargar los registros.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, value]);

  const visibleOptions = selected && selected.value === value && !options.some((item) => item.value === value)
    ? [selected, ...options]
    : options;

  return <Field label={`${label}${required ? ' *' : ''}`}>
    <div className="relation-lookup">
      <label className="relation-lookup__search">
        <Search size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o referencia…" aria-label={`Buscar ${label.toLowerCase()}`} />
      </label>
      <Select aria-label={label} value={value} onChange={(event) => {
        const next = event.target.value;
        setSelected(visibleOptions.find((item) => item.value === next) ?? null);
        onChange(next);
      }} disabled={loading && visibleOptions.length === 0}>
        <option value="">{loading ? 'Cargando…' : emptyLabel}</option>
        {visibleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </Select>
      {error ? <small className="field-error" role="alert">{error}</small> : null}
    </div>
  </Field>;
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
