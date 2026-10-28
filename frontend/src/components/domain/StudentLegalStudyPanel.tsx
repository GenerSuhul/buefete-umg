import { useState } from 'react';
import { dataSource } from '../../data/dataSource';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useConfirm, useNotify } from '../ui/Feedback';
import { AppDatePicker, Badge, Button, Card, DocumentLink, ErrorState, Field, FilePicker, LoadingState, Modal, SectionHeading } from '../ui';
import type { Student } from '../../types/domain';
import type { LegalStudyReviewType } from '../../types/studentLegalStudy';
import { formatDate } from '../../utils/format';
import { toLocalDateOnly } from '../../utils/date';

const reviewTypes: Array<{ value: LegalStudyReviewType; label: string }> = [
  { value: 'FirstReview', label: 'Primera revisión' },
  { value: 'SecondReview', label: 'Segunda revisión' },
  { value: 'WrittenSubmission', label: 'Escrito' },
];

export function StudentLegalStudyPanel({ student, canWrite, onChanged }: { student: Student; canWrite: boolean; onChanged: () => void }) {
  const { data, error, loading, reload } = useAsyncData(() => dataSource.getStudentLegalStudy(student.id), [student.id]);
  const [mode, setMode] = useState<LegalStudyReviewType | 'delivery' | null>(null);
  const [date, setDate] = useState(toLocalDateOnly());
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const confirm = useConfirm();
  const notify = useNotify();
  const open = (value: NonNullable<typeof mode>) => { setMode(value); setDate(toLocalDateOnly()); setNotes(''); setFile(null); setUploadedId(null); setMessage(''); };
  const save = async () => {
    if (!mode || !date || (!file && !uploadedId)) { setMessage('Indique la fecha y adjunte el PDF firmado.'); return; }
    if (mode !== 'delivery' && !notes.trim()) { setMessage('Escriba las observaciones de la revisión.'); return; }
    if (file && file.type !== 'application/pdf') { setMessage('El documento firmado debe ser un PDF.'); return; }
    if (mode === 'delivery' && !await confirm({ title: 'Cerrar práctica', message: 'Al confirmar la entrega se finalizarán las asignaciones y se revocará el acceso del alumno. La ficha, los procesos y los documentos seguirán disponibles para consulta.', confirmLabel: 'Entregar y cerrar práctica', tone: 'danger' })) return;
    setBusy(true); setMessage('');
    try {
      let documentId = uploadedId;
      if (!documentId && file) {
        const document = await dataSource.uploadDocument({ file, contextType: 'Student', contextId: student.id, label: mode === 'delivery' ? 'Estudio jurídico entregado' : `Estudio jurídico · ${reviewTypes.find(item => item.value === mode)?.label}`, source: 'Upload' });
        documentId = document.id; setUploadedId(document.id);
      }
      if (!documentId) throw new Error('Adjunte el PDF firmado.');
      if (mode === 'delivery') await dataSource.deliverStudentLegalStudy(student.id, { deliveryDate: date, finalDocumentId: documentId, notes: notes.trim() });
      else await dataSource.addStudentLegalReview(student.id, { reviewType: mode, reviewDate: date, observations: notes.trim(), signedDocumentId: documentId });
      notify.success({ title: mode === 'delivery' ? 'Práctica cerrada' : 'Revisión registrada', message: 'El documento y su historial quedaron guardados.' });
      setMode(null); reload(); onChanged();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar. Intente nuevamente.'); }
    finally { setBusy(false); }
  };
  if (loading) return <LoadingState label="Cargando estudio jurídico" />;
  if (error || !data) return <ErrorState error={error ?? new Error('No se pudo cargar el estudio jurídico.')} retry={reload} />;
  return <Card>
    <SectionHeading title="Estudio jurídico" description={`${data.reviews.length} ${data.reviews.length === 1 ? 'revisión registrada' : 'revisiones registradas'}`} />
    {data.closure ? <div className="info-banner" role="status"><strong>Estudio jurídico entregado · práctica cerrada</strong><p>{formatDate(data.closure.deliveryDate)}. El alumno está inactivo y su acceso fue revocado.</p><p>{data.closure.notes}</p><DocumentLink documentId={data.closure.finalDocumentId} label="Ver estudio jurídico entregado" /></div> : null}
    {!data.closure && canWrite && student.isActive ? <div className="page-actions">{reviewTypes.map(type => <Button key={type.value} variant="secondary" onClick={() => open(type.value)}>{type.label}</Button>)}</div> : null}
    {data.reviews.length ? <div className="detail-column">{data.reviews.map((review, index) => <section key={review.id} className="subtle-panel"><Badge tone="neutral">Revisión {index + 1}</Badge><h3>{reviewTypes.find(item => item.value === review.reviewType)?.label}</h3><p>{formatDate(review.reviewDate)}</p><p style={{ whiteSpace: 'pre-wrap' }}>{review.observations}</p><DocumentLink documentId={review.signedDocumentId} label="Ver revisión firmada" /></section>)}</div> : <p className="muted">Todavía no se han registrado revisiones firmadas.</p>}
    {!data.closure && canWrite && student.isActive ? <div className="section-footer"><Button disabled={!data.reviews.length} onClick={() => open('delivery')}>Estudio jurídico entregado · cerrar práctica</Button></div> : null}
    <Modal open={mode !== null} onClose={() => !busy && setMode(null)} title={mode === 'delivery' ? 'Entregar estudio jurídico' : reviewTypes.find(item => item.value === mode)?.label ?? 'Registrar revisión'} description="Adjunte la copia firmada para conservarla en el historial del alumno." footer={<><Button variant="secondary" disabled={busy} onClick={() => setMode(null)}>Cancelar</Button><Button disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : mode === 'delivery' ? 'Entregar y cerrar práctica' : 'Guardar revisión'}</Button></>}>
      <div className="form-grid"><AppDatePicker label={mode === 'delivery' ? 'Fecha de entrega' : 'Fecha de revisión'} value={date} onChange={setDate} preset="processDate" min={student.registrationDate} max={toLocalDateOnly()} required /><Field label={mode === 'delivery' ? 'Notas de entrega' : 'Observaciones'} wide><textarea maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} /></Field><div className="field--wide"><FilePicker label="Documento firmado (PDF)" accept="application/pdf,.pdf" file={file} onChange={value => { setFile(value); setUploadedId(null); }} /></div></div>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
    </Modal>
  </Card>;
}
