import 'server-only';
import type postgres from 'postgres';
import type { StudentDiscipline, CreateStudentDiscipline } from '../types/studentDiscipline';
import type { DemoState } from './model';
import { DemoError, ensure, id, requireValue } from './model';
import { loadFile } from './files';
import type { DemoSession } from './store';

type Sql = postgres.TransactionSql;
interface Row { id: string; dpi: string; student_name: string; kind: StudentDiscipline['kind']; reason: string;
  starts_on: string | null; ends_on: string | null; document_id: string | null; source_tenant_code: string;
  issued_by_name: string; created_at_utc: Date; revoked_at_utc: Date | null; revocation_reason: string | null; }
const dpiKey = (value: string) => value.replace(/\D/g, '');
const today = () => new Date().toISOString().slice(0, 10);
const validDate = (value: string | null) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
function sixMonths(value: string) { const [y,m,d] = value.split('-').map(Number); const last = new Date(Date.UTC(y, m+6, 0)).getUTCDate(); return new Date(Date.UTC(y, m+5, Math.min(d,last))).toISOString().slice(0,10); }
const blocking = (row: Row) => !row.revoked_at_utc && (row.kind === 'PermanentSuspension' ||
  row.kind === 'SixMonthSuspension' && !!row.starts_on && !!row.ends_on && row.starts_on <= today() && row.ends_on >= today());
const map = (row: Row): StudentDiscipline => ({ id: row.id, dpi: row.dpi, studentName: row.student_name, kind: row.kind,
  reason: row.reason, startsOn: row.starts_on, endsOn: row.ends_on, documentId: row.document_id,
  sourceTenantCode: row.source_tenant_code, issuedByName: row.issued_by_name,
  createdAtUtc: row.created_at_utc.toISOString(), revokedAtUtc: row.revoked_at_utc?.toISOString() ?? null,
  revocationReason: row.revocation_reason, isBlocking: blocking(row) });

export async function ensureStudentNotBlocked(dpi: string, sql: Sql) {
  const key = dpiKey(dpi);
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 1))`;
  const rows = await sql`SELECT id FROM demo_student_disciplines WHERE dpi=${key} AND revoked_at_utc IS NULL AND
    (kind='PermanentSuspension' OR (kind='SixMonthSuspension' AND starts_on<=CURRENT_DATE AND ends_on>=CURRENT_DATE)) LIMIT 1`;
  if (rows.length) throw new DemoError('El alumno tiene una suspensión global vigente. Consulte con la administración.', 409);
}

export async function isStudentBlocked(dpi: string, sql: postgres.Sql) {
  const key = dpiKey(dpi);
  const rows = await sql`SELECT id FROM demo_student_disciplines WHERE dpi=${key} AND revoked_at_utc IS NULL AND
    (kind='PermanentSuspension' OR (kind='SixMonthSuspension' AND starts_on<=CURRENT_DATE AND ends_on>=CURRENT_DATE)) LIMIT 1`;
  return rows.length > 0;
}

export async function studentDisciplineOperation(state: DemoState, session: DemoSession,
  method: string, args: unknown[], sql: Sql) {
  const studentId = String(args[0]);
  const profile = requireValue(state.students.find(x => x.student.id === studentId), 'No se encontró el alumno.');
  const user = requireValue(state.users.find(x => x.id === session.user_id));
  const admin = user.roles.includes('AdministradorGeneral');
  ensure(admin || user.roles.includes('Secretaria') || profile.student.userAccountId === user.id,
    'No tiene permiso para consultar las amonestaciones.', 403);
  const key = dpiKey(profile.student.dpi);
  if (method === 'listStudentDisciplines') {
    const rows = await sql<Row[]>`SELECT * FROM demo_student_disciplines WHERE dpi=${key} ORDER BY created_at_utc DESC`;
    return rows.map(map);
  }
  if (method === 'downloadStudentDisciplineDocument') {
    const [row] = await sql<Row[]>`SELECT * FROM demo_student_disciplines WHERE id=${String(args[1])} AND dpi=${key}`;
    ensure(row?.document_id, 'No se encontró el PDF de la amonestación.', 404);
    const [source] = await sql`SELECT state FROM demo_tenants WHERE code=${row.source_tenant_code} AND is_active=true`;
    ensure(source, 'La sede de origen no está disponible.', 404);
    const original = source.state as DemoState;
    const document = requireValue(original.documents.find(x => x.id === row.document_id && x.contextType === 'Student' && x.contentType === 'application/pdf'), 'No se encontró el PDF de la amonestación.');
    const owner = original.students.find(x => x.student.id === document.contextId);
    ensure(owner && dpiKey(owner.student.dpi) === key, 'El documento no corresponde al alumno.', 403);
    return { __blob: true, type: 'application/pdf', data: (await loadFile(document.storagePath)).toString('base64') };
  }
  ensure(admin, 'Sólo los administradores pueden registrar o retirar amonestaciones.', 403);
  if (method === 'createStudentDiscipline') {
    const request = args[1] as CreateStudentDiscipline;
    ensure(['WrittenWarning','SixMonthSuspension','PermanentSuspension'].includes(request?.kind), 'Seleccione un tipo válido.');
    const reason = String(request.reason ?? '').trim();
    ensure(reason.length >= 10 && reason.length <= 2000, 'Indique un motivo de 10 a 2000 caracteres.');
    ensure(validDate(request.startsOn) && validDate(request.endsOn), 'Revise las fechas de la suspensión.');
    if (request.kind === 'SixMonthSuspension') ensure(request.startsOn && request.endsOn === sixMonths(request.startsOn), 'La fecha final debe ser exactamente seis meses después del inicio.');
    else ensure(!request.startsOn && !request.endsOn, 'Sólo la suspensión temporal utiliza fechas.');
    if (request.kind === 'WrittenWarning') ensure(request.documentId, 'Adjunte la amonestación escrita firmada en PDF.');
    if (request.documentId) {
      const document = state.documents.find(x => x.id === request.documentId);
      ensure(document?.contextType === 'Student' && document.contextId === studentId && document.contentType === 'application/pdf', 'Adjunte un PDF del alumno de esta sede.');
    }
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 1))`;
    if (request.kind !== 'WrittenWarning') {
      const existing = await sql`SELECT id FROM demo_student_disciplines WHERE dpi=${key} AND revoked_at_utc IS NULL AND
        (kind='PermanentSuspension' OR (kind='SixMonthSuspension' AND ends_on>=CURRENT_DATE)) LIMIT 1`;
      ensure(!existing.length, 'El alumno ya tiene una suspensión vigente.', 409);
    }
    const [row] = await sql<Row[]>`INSERT INTO demo_student_disciplines(id,dpi,student_name,kind,reason,starts_on,ends_on,document_id,source_tenant_code,issued_by_name)
      VALUES (${id()},${key},${profile.student.fullName},${request.kind},${reason},${request.startsOn},${request.endsOn},${request.documentId},
      (SELECT code FROM demo_tenants WHERE id=${session.tenant_id}),${user.fullName}) RETURNING *`;
    return map(row);
  }
  if (method === 'revokeStudentDiscipline') {
    const reason = String(args[2] ?? '').trim();
    ensure(reason.length >= 10 && reason.length <= 2000, 'Indique un motivo de 10 a 2000 caracteres para retirar la medida.');
    const [row] = await sql<Row[]>`UPDATE demo_student_disciplines SET revoked_at_utc=now(),revocation_reason=${reason},revoked_by_user_id=${user.id}
      WHERE id=${String(args[1])} AND dpi=${key} AND revoked_at_utc IS NULL RETURNING *`;
    ensure(row, 'No se encontró una amonestación vigente.', 404);
    return map(row);
  }
  throw new DemoError('Operación no disponible.', 404);
}
