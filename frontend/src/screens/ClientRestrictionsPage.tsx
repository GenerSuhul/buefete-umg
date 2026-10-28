import { useState } from 'react';
import { Badge, Button, Card, ErrorState, Field, LoadingState, Modal, PageHeader } from '../components/ui';
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
  if (!user?.roles.some(role => role === 'Administrador' || (demoEnabled && role === 'AdministradorGeneral'))) return <ErrorState error={new Error('Este módulo requiere una cuenta administradora.')} />;
  return <RestrictionAdministration />;
}
function RestrictionAdministration() {
  const { user } = useAuth();
  const initialDpi = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('dpi') ?? '';
  const notify = useNotify();
  const [input, setInput] = useState(initialDpi), [dpi, setDpi] = useState(initialDpi), [page, setPage] = useState(1), [open, setOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null), [removeReason, setRemoveReason] = useState(''), [removing, setRemoving] = useState(false), [removeError, setRemoveError] = useState('');
  const { data, error, loading, reload } = useAsyncData(() => clientRestrictions.list(dpi, page), [dpi, page]);
  const removeRestriction = async () => {
    if (!removeId) return;
    if (removeReason.trim().length < 10) { setRemoveError('Indique un motivo de al menos 10 caracteres.'); return; }
    setRemoving(true); setRemoveError('');
    try {
      await clientRestrictions.remove(removeId, removeReason.trim());
      setRemoveId(null); setRemoveReason('');
      await reload();
      notify.success({ title: 'Atención habilitada', message: 'El bloqueo fue retirado para todas las sedes. El historial de la decisión queda en auditoría.' });
    } catch (reason) { setRemoveError(reason instanceof Error ? reason.message : 'No se pudo retirar el bloqueo.'); }
    finally { setRemoving(false); }
  };
  return <>
    <PageHeader eyebrow="Control de atención" title="Lista negra" description={user?.isPlatformAdmin ? 'Registro permanente de todas las sedes de la plataforma.' : 'Personas agregadas a lista negra por esta sede. El bloqueo se aplica a todas las sedes.'} actions={<Button variant="danger" onClick={() => setOpen(true)}>Agregar a lista negra</Button>} />
    <Card>
      <form className="inline-actions" onSubmit={event => { event.preventDefault(); setDpi(input); setPage(1); }}><Field label="Filtrar por DPI exacto"><input value={input} inputMode="numeric" maxLength={15} onChange={event => setInput(formatCui(event.target.value))} placeholder="0000 00000 0000" /></Field><Button type="submit" variant="secondary" disabled={Boolean(input) && input.replace(/\D/g, '').length !== 13}>Buscar</Button><Button type="button" variant="ghost" onClick={() => { setInput(''); setDpi(''); setPage(1); }}>Limpiar</Button></form>
      {loading ? <LoadingState label="Consultando lista negra" /> : error ? <ErrorState error={error} retry={reload} /> : <>
        {!data?.items.length && <p role="status">No hay personas en lista negra que coincidan con esta consulta.</p>}
        {data?.items.map(item => <article className="restriction-record" key={item.id}><div><strong>DPI {item.dpi}</strong><Badge tone="danger">Permanente · Todas las sedes</Badge></div><p>{item.reason}</p><small>{item.sourceTenantCode} · {item.issuedByName} · {formatDateTime(item.createdAtUtc)}</small><small>Referencia: {item.id}</small><Button type="button" variant="secondary" onClick={() => { setRemoveId(item.id); setRemoveReason(''); setRemoveError(''); }}>Habilitar nuevamente</Button></article>)}
        <Pagination page={page} totalPages={data?.totalPages ?? 1} totalCount={data?.totalCount ?? 0} onPageChange={setPage} />
      </>}
    </Card>
    {open && <ClientRestrictionDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); notify.success({ title: 'Ingreso a lista negra registrado', message: 'La atención a ese DPI está bloqueada en todas las sedes.' }); }} />}
    <Modal open={Boolean(removeId)} onClose={() => !removing && setRemoveId(null)} title="Habilitar atención nuevamente" description="Se retirará el bloqueo de todas las sedes. Los registros y procesos anteriores se conservan." footer={<><Button type="button" variant="secondary" disabled={removing} onClick={() => setRemoveId(null)}>Cancelar</Button><Button type="button" disabled={removing || removeReason.trim().length < 10} onClick={removeRestriction}>{removing ? 'Habilitando…' : 'Confirmar habilitación'}</Button></>}><Field label="Motivo de la rehabilitación"><textarea value={removeReason} maxLength={2000} onChange={event => setRemoveReason(event.target.value)} /></Field>{removeError && <p role="alert" className="form-error">{removeError}</p>}</Modal>
  </>;
}
