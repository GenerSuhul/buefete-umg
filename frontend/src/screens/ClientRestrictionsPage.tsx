import { useState } from 'react';
import { Badge, Button, Card, ErrorState, Field, LoadingState, PageHeader } from '../components/ui';
import { Pagination } from '../components/domain/Shared';
import { ClientRestrictionDialog } from '../components/domain/ClientRestrictionDialog';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../components/ui/Feedback';
import { clientRestrictions } from '../data/clientRestrictions';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatCui } from '../utils/inputMasks';
import { formatDateTime } from '../utils/format';
import { demoEnabled } from '../demo/client';

export function ClientRestrictionsPage() {
  const { user } = useAuth();
  if (demoEnabled || !user?.roles.includes('Administrador')) return <ErrorState error={new Error('Este módulo requiere una cuenta administradora en la plataforma conectada.')} />;
  return <RestrictionAdministration />;
}
function RestrictionAdministration() {
  const { user } = useAuth();
  const notify = useNotify();
  const [input, setInput] = useState(''), [dpi, setDpi] = useState(''), [page, setPage] = useState(1), [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useAsyncData(() => clientRestrictions.list(dpi, page), [dpi, page]);
  return <>
    <PageHeader eyebrow="Control de atención" title="Vetos de atención" description={user?.isPlatformAdmin ? 'Registro permanente de todas las sedes de la plataforma.' : 'Vetos emitidos por esta sede. El bloqueo se aplica a todas las sedes.'} actions={<Button variant="danger" onClick={() => setOpen(true)}>Registrar veto global</Button>} />
    <Card>
      <form className="inline-actions" onSubmit={event => { event.preventDefault(); setDpi(input); setPage(1); }}><Field label="Filtrar por DPI exacto"><input value={input} inputMode="numeric" maxLength={15} onChange={event => setInput(formatCui(event.target.value))} placeholder="0000 00000 0000" /></Field><Button type="submit" variant="secondary" disabled={Boolean(input) && input.replace(/\D/g, '').length !== 13}>Buscar</Button><Button type="button" variant="ghost" onClick={() => { setInput(''); setDpi(''); setPage(1); }}>Limpiar</Button></form>
      {loading ? <LoadingState label="Consultando vetos" /> : error ? <ErrorState error={error} retry={reload} /> : <>
        {!data?.items.length && <p role="status">No hay vetos registrados que coincidan con esta consulta.</p>}
        {data?.items.map(item => <article className="restriction-record" key={item.id}><div><strong>DPI {item.dpi}</strong><Badge tone="danger">Permanente · Todas las sedes</Badge></div><p>{item.reason}</p><small>{item.sourceTenantCode} · {item.issuedByName} · {formatDateTime(item.createdAtUtc)}</small><small>Referencia: {item.id}</small></article>)}
        <Pagination page={page} totalPages={data?.totalPages ?? 1} totalCount={data?.totalCount ?? 0} onPageChange={setPage} />
      </>}
    </Card>
    {open && <ClientRestrictionDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); notify.success({ title: 'Veto global registrado', message: 'La atención a ese DPI está bloqueada en todas las sedes.' }); }} />}
  </>;
}
