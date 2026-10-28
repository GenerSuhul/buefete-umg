import { dataSource } from '../../data/dataSource';
import { useAsyncData } from '../../hooks/useAsyncData';

export function StudentDisciplineAlert({ studentId, revision, onOpen }: { studentId: string; revision: number; onOpen: () => void }) {
  const { data, error } = useAsyncData(() => dataSource.listStudentDisciplines(studentId), [studentId, revision]);
  if (error) return <p role="alert">No se pudo comprobar el estado de amonestaciones. <button type="button" onClick={onOpen}>Ver detalle</button></p>;
  if (!data) return null;
  const blocking = data.filter(item => item.isBlocking);
  const warnings = data.filter(item => item.kind === 'WrittenWarning' && !item.revokedAtUtc);
  if (!blocking.length && !warnings.length) return null;
  return <div className="info-banner" role="alert">
    <strong>{blocking.length ? 'Alumno suspendido' : 'Alumno con amonestación escrita'}</strong>
    <p>{blocking.length ? 'No puede iniciar sesión, inscribirse ni recibir nuevos casos mientras dure la medida.' : 'Consulte el documento firmado y el historial de la medida.'}</p>
    <button type="button" className="document-link" onClick={onOpen}>Ver amonestaciones</button>
  </div>;
}
