import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../ui';

export function FilterBar({ value, onChange, placeholder, children }: { value: string; onChange: (value: string) => void; placeholder: string; children?: ReactNode }) {
  return <div className="filter-bar"><label className="search-field"><Search size={18} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>Ctrl K</kbd></label>{children}<Button variant="secondary" size="icon" aria-label="Más filtros"><SlidersHorizontal size={18} /></Button></div>;
}

export function Pagination({ page, totalPages, totalCount }: { page: number; totalPages: number; totalCount: number }) {
  return <div className="pagination"><span>{totalCount} registros</span><div><Button variant="secondary" size="icon" disabled={page <= 1} aria-label="Página anterior"><ChevronLeft size={17} /></Button><span>Página {page} de {Math.max(totalPages, 1)}</span><Button variant="secondary" size="icon" disabled={page >= totalPages} aria-label="Página siguiente"><ChevronRight size={17} /></Button></div></div>;
}

export function DetailTabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string; count?: number }>; active: string; onChange: (id: string) => void }) {
  return <div className="detail-tabs" role="tablist">{tabs.map((tab) => <button type="button" role="tab" aria-selected={active === tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)} key={tab.id}>{tab.label}{tab.count !== undefined && <span>{tab.count}</span>}</button>)}</div>;
}

export function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return <div className="info-item"><span>{label}</span><strong>{value || 'No registrado'}</strong></div>;
}
