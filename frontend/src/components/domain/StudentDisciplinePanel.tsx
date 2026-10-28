import { useEffect, useState } from 'react';
import { dataSource } from '../../data/dataSource';
import type { Student } from '../../types/domain';
import type { StudentDiscipline, StudentDisciplineKind } from '../../types/studentDiscipline';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../ui/Feedback';
import { AppDatePicker, Button, Card, Field, FilePicker, LoadingState, SectionHeading, Select } from '../ui';
import { WhatsAppLink } from './WhatsAppLink';

const labels: Record<StudentDisciplineKind, string> = {
  WrittenWarning: 'Amonestación escrita',
  SixMonthSuspension: 'Suspensión por seis meses',
  PermanentSuspension: 'Suspensión definitiva',
};
function sixMonthsAfter(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const last = new Date(Date.UTC(year, month + 6, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + 5, Math.min(day, last))).toISOString().slice(0, 10);
}

export function StudentDisciplinePanel({ student, onChanged }: { student: Student; onChanged?: () => void }) {
  const { user } = useAuth();
  const canManage = Boolean(user?.roles.some(role => role === 'Administrador' || role === 'AdministradorGeneral'));
  const [items, setItems] = useState<StudentDiscipline[]>([]);
  const [kind, setKind] = useState<StudentDisciplineKind>('WrittenWarning');
  const [reason, setReason] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const confirm = useConfirm();
  const reload = async () => setItems(await dataSource.listStudentDisciplines(student.id));
  useEffect(() => { let active = true; setLoading(true); dataSource.listStudentDisciplines(student.id)
    .then(rows => { if (active) setItems(rows); })
    .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las amonestaciones.'); })
    .finally(() => { if (active) setLoading(false); });
    return () => { active = false; }; }, [student.id]);
  const create = async () => {
    setBusy(true); setError('');
    try {
      if (reason.trim().length < 10) throw new Error('Indique un motivo de al menos 10 caracteres.');
      if (kind === 'SixMonthSuspension' && !startsOn) throw new Error('Indique la fecha inicial de la suspensión.');
      if (kind === 'WrittenWarning' && (!pdf || pdf.type !== 'application/pdf')) throw new Error('Adjunte la amonestación escrita en PDF.');
      if (kind !== 'WrittenWarning' && !await confirm({ title: 'Confirmar suspensión global', message: kind === 'PermanentSuspension' ? 'El alumno perderá acceso y no podrá inscribirse ni recibir casos en ninguna sede hasta que un administrador retire la medida.' : `El alumno quedará bloqueado en todas las sedes desde ${startsOn} hasta ${sixMonthsAfter(startsOn)}.`, confirmLabel: 'Confirmar suspensión', tone: 'danger' })) return;
      let documentId: string | null = null;
      if (pdf) {
        if (pdf.type !== 'application/pdf') throw new Error('El documento debe ser PDF.');
        const document = await dataSource.uploadDocument({ file: pdf, source: 'Upload', contextType: 'Student', contextId: student.id, label: labels[kind] });
        documentId = document.id;
      }
      await dataSource.createStudentDiscipline(student.id, { kind, reason: reason.trim(), startsOn: kind === 'SixMonthSuspension' ? startsOn : null,
        endsOn: kind === 'SixMonthSuspension' ? sixMonthsAfter(startsOn) : null, documentId });
      setReason(''); setStartsOn(''); setPdf(null);
      await reload(); onChanged?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo registrar la amonestación.'); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!await confirm({ title: 'Retirar amonestación', message: 'La medida quedará retirada en todas las sedes. El historial seguirá visible.', confirmLabel: 'Retirar medida', tone: 'danger' })) return;
    setBusy(true); setError('');
    try {
      await dataSource.revokeStudentDiscipline(student.id, revokeId, revokeReason.trim());
      setRevokeId(''); setRevokeReason(''); await reload(); onChanged?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo retirar la amonestación.'); }
    finally { setBusy(false); }
  };
  if (loading) return <LoadingState label="Cargando amonestaciones" />;
  return <Card><section aria-label="Amonestaciones del alumno">
    <SectionHeading title="Amonestaciones" description="Historial y medidas vigentes en todas las sedes" />
    {items.some(item => item.isBlocking) && <p role="alert">Alumno suspendido: no puede iniciar sesión, inscribirse ni recibir casos mientras dure la medida.</p>}
    {items.some(item => item.kind === 'WrittenWarning' && !item.revokedAtUtc) && <p role="status">El alumno tiene una amonestación escrita vigente.</p>}
    {error && <p role="alert">{error}</p>}
    {items.length === 0 && <p>Sin amonestaciones registradas.</p>}
    <ul>{items.map(item => <li key={item.id}>
      <strong>{labels[item.kind]}</strong> · {item.reason} · {item.sourceTenantCode} · {new Date(item.createdAtUtc).toLocaleDateString('es-GT')}
      {item.startsOn && <> · {item.startsOn} a {item.endsOn}</>}
      {item.revokedAtUtc && <> · Retirada: {item.revocationReason}</>}
      {item.documentId && <Button variant="ghost" onClick={async () => {
        try { const blob = await dataSource.downloadStudentDisciplineDocument(student.id, item.id); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo abrir el PDF.'); }
      }}>Ver PDF</Button>}
      <WhatsAppLink phone={student.mobilePhone ?? student.homePhone} message={`Hola ${student.fullName}. Le informamos que el Bufete Popular UMG registró: ${labels[item.kind]}. Comuníquese con la administración para conocer el detalle.`} />
      {canManage && !item.revokedAtUtc && <Button variant="ghost" onClick={() => setRevokeId(item.id)}>Retirar</Button>}
    </li>)}</ul>
    {canManage && <div className="form-grid">
      <Field label="Tipo de amonestación"><Select value={kind} onChange={event => setKind(event.target.value as StudentDisciplineKind)}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select></Field>
      <Field label="Motivo"><textarea value={reason} onChange={event => setReason(event.target.value)} /></Field>
      {kind === 'SixMonthSuspension' && <><AppDatePicker label="Inicio de suspensión" value={startsOn} onChange={setStartsOn} preset="processDate" required />
        <Field label="Finalización"><input readOnly value={startsOn ? sixMonthsAfter(startsOn) : ''} /></Field></>}
      {(kind === 'WrittenWarning' || kind === 'PermanentSuspension') && <FilePicker label="Documento firmado en PDF" file={pdf} onChange={setPdf} accept="application/pdf" />}
      <Button disabled={busy} onClick={create}>Registrar amonestación</Button>
    </div>}
    {canManage && revokeId && <div className="form-grid"><Field label="Motivo del retiro"><textarea value={revokeReason} onChange={event => setRevokeReason(event.target.value)} /></Field>
      <Button disabled={busy || revokeReason.trim().length < 10} onClick={revoke}>Confirmar retiro</Button>
      <Button variant="secondary" onClick={() => { setRevokeId(''); setRevokeReason(''); }}>Cancelar</Button></div>}
  </section></Card>;
}
