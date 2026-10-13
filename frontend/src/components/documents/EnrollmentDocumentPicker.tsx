import { useState } from 'react';
import { acquireFromScanner, getScannerAgentHealth, listScannerDevices, type LocalScannerDevice } from '../../data/scannerAgent';
import { Button, Field, FilePicker, Select } from '../ui';

/** Capture before registration: no server document is created until its owner exists. */
export function EnrollmentDocumentPicker({ label, file, onChange }: {
  label: string; file: File | null; onChange: (file: File | null, source: 'Upload' | 'Scanner') => void;
}) {
  const [devices, setDevices] = useState<LocalScannerDevice[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState<File | null>(null);
  const [useFeeder, setUseFeeder] = useState(false);
  const [duplex, setDuplex] = useState(false);
  const connect = async () => {
    setOpen(true); setBusy(true); setError('');
    try {
      const health = await getScannerAgentHealth();
      if (!health.ready) throw new Error('El agente NAPS2 no está listo. Abra el agente local y vuelva a intentar.');
      const available = await listScannerDevices();
      setDevices(available); setDeviceId(available[0]?.id ?? '');
      if (!available.length) throw new Error('No se encontraron escáneres. Conecte uno o seleccione un PDF.');
    } catch { setError('No se pudo conectar con el escáner local. Verifique el agente NAPS2 y el dispositivo, o seleccione un PDF.'); }
    finally { setBusy(false); }
  };
  const scan = async () => {
    setBusy(true); setError('');
    try { setCandidate(await acquireFromScanner({ deviceId, resolutionDpi: 300, colorMode: 'Color', useFeeder, duplex })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo escanear.'); }
    finally { setBusy(false); }
  };
  return <div>
    <FilePicker label={label} hint="PDF, JPG, PNG o WEBP · seleccione un archivo o escanee" file={file} onChange={(value) => onChange(value, 'Upload')} />
    {!open ? <Button variant="secondary" onClick={connect}>Escanear {label}</Button> : <section aria-label={`Escanear ${label}`}>
      <Field label="Escáner"><Select disabled={busy} value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
        <option value="">Seleccione un dispositivo</option>
        {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
      </Select></Field>
      <label><input type="checkbox" checked={useFeeder} disabled={busy} onChange={(event) => { setUseFeeder(event.target.checked); if (!event.target.checked) setDuplex(false); }} /> Alimentador de páginas</label>
      <label><input type="checkbox" checked={duplex} disabled={busy || !useFeeder} onChange={(event) => setDuplex(event.target.checked)} /> Ambas caras</label>
      <Button variant="secondary" disabled={busy || !deviceId} onClick={scan}>{busy ? 'Conectando…' : 'Capturar documento'}</Button>
      {!busy && !devices.length && <Button variant="secondary" onClick={connect}>Reintentar conexión</Button>}
      {candidate && <><FilePicker label="Revise el documento capturado" file={candidate} onChange={setCandidate} />
        <Button disabled={busy} onClick={() => { onChange(candidate, 'Scanner'); setCandidate(null); setOpen(false); }}>Aceptar documento escaneado</Button></>}
      <Button variant="secondary" disabled={busy} onClick={() => { setOpen(false); setCandidate(null); setError(''); }}>Cancelar escaneo</Button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p>La captura se adjuntará al confirmar la inscripción. Revise todas las páginas antes de aceptarla.</p>
    </section>}
  </div>;
}
