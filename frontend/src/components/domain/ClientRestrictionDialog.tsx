import { useState } from 'react';
import { Button, Field, Modal } from '../ui';
import { clientRestrictions } from '../../data/clientRestrictions';
import { formatCui } from '../../utils/inputMasks';

export function ClientRestrictionDialog({ dpi = '', onClose, onSaved }: { dpi?: string; onClose: () => void; onSaved: () => void }) {
  const [identity, setIdentity] = useState(dpi);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const digits = (value: string) => value.replace(/\D/g, '');
  const valid = digits(identity).length === 13 && digits(identity) === digits(confirmation) && reason.trim().length >= 10 && accepted;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await clientRestrictions.create(identity, confirmation, reason.trim()); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo emitir el veto. Intente nuevamente.'); }
    finally { setBusy(false); }
  };
  return <Modal open title="Veto global permanente" description="Bloquea la atención a este DPI en todas las sedes de esta plataforma." onClose={() => { if (!busy) onClose(); }} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="danger" disabled={!valid || busy} onClick={save}>{busy ? 'Registrando veto…' : 'Confirmar veto permanente'}</Button></>}>
    <div className="form-grid">
      <p className="confirmation-warning field--wide">Esta acción no tiene vencimiento ni opción de deshacer. No elimina el historial. Verifique el DPI y la autorización institucional antes de continuar.</p>
      {error && <div role="alert" className="form-error field--wide">{error}</div>}
      <Field label="DPI que se bloqueará"><input value={identity} readOnly={Boolean(dpi)} inputMode="numeric" maxLength={15} onChange={event => setIdentity(formatCui(event.target.value))} /></Field>
      <Field label="Repita el DPI para confirmar"><input value={confirmation} inputMode="numeric" maxLength={15} onChange={event => setConfirmation(formatCui(event.target.value))} autoComplete="off" /></Field>
      <Field label="Motivo institucional" wide><textarea value={reason} minLength={10} maxLength={2000} rows={4} onChange={event => setReason(event.target.value)} /></Field>
      <label className="choice-card field--wide"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Confirmo la identidad y autorizo el bloqueo permanente en todas las sedes.</span></label>
    </div>
  </Modal>;
}
