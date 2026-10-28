import "server-only";
import { DemoError, ensure, rootId } from './model';
import { database, inTenant, initializeDemo, type DemoSession } from './store';
import type { ClientRestriction, ClientRestrictionStatus, PagedResult } from '../types/domain';
import type postgres from 'postgres';

const key = (value: unknown) => {
  const input = String(value ?? '').trim();
  ensure(/^[\d -]+$/.test(input), 'El DPI sólo admite dígitos y separadores.');
  const dpi = input.replace(/[ -]/g, '');
  ensure(/^\d{13}$/.test(dpi), 'El DPI debe contener 13 dígitos.');
  return dpi;
};
const humanDpi = (dpi: string) => `${dpi.slice(0,4)} ${dpi.slice(4,9)} ${dpi.slice(9)}`;
interface Row { id: string; dpi: string; reason: string; source_tenant_code: string; issued_by_name: string; created_at_utc: Date; }
const map = (row: Row): ClientRestriction => ({ id: row.id, dpi: humanDpi(row.dpi), reason: row.reason,
  sourceTenantCode: row.source_tenant_code, issuedByName: row.issued_by_name, createdAtUtc: row.created_at_utc.toISOString() });
async function administrator(session: DemoSession) {
  await inTenant(session, false, (state) => {
    const user = state.users.find((candidate) => candidate.id === session.user_id);
    ensure(user?.roles.includes('AdministradorGeneral'), 'Sólo los administradores pueden administrar la lista negra.', 403);
  });
}
export async function restrictionStatus(dpi: unknown): Promise<ClientRestrictionStatus> {
  await initializeDemo();
  let normalized: string;
  try { normalized = key(dpi); } catch { return { isRestricted: false, reference: null, hasValidIdentity: false }; }
  const [row] = await database()<Row[]>`SELECT id,dpi,reason,source_tenant_code,issued_by_name,created_at_utc FROM demo_client_restrictions WHERE dpi=${normalized} AND removed_at_utc IS NULL`;
  return { isRestricted: Boolean(row), reference: row?.id ?? null, hasValidIdentity: true };
}
export async function ensureClientAllowed(dpi: unknown, transaction: postgres.TransactionSql) {
  const normalized = key(dpi);
  await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${normalized}, 0))`;
  const rows = await transaction`SELECT id FROM demo_client_restrictions WHERE dpi=${normalized} AND removed_at_utc IS NULL`;
  if (rows.length) throw new DemoError('Atención bloqueada: este DPI está en lista negra en todas las sedes.', 409);
}
export async function listRestrictions(session: DemoSession, dpi: string, page: number): Promise<PagedResult<ClientRestriction>> {
  await administrator(session);
  const searched = dpi ? key(dpi) : null;
  page = Math.max(1, Math.trunc(page) || 1);
  const global = session.platform_admin;
  const [count] = await database()`SELECT count(*)::int AS total FROM demo_client_restrictions WHERE removed_at_utc IS NULL AND (${global} OR source_tenant_code=(SELECT code FROM demo_tenants WHERE id=${session.tenant_id})) AND (${searched}::text IS NULL OR dpi=${searched})`;
  const rows = await database()<Row[]>`SELECT id,dpi,reason,source_tenant_code,issued_by_name,created_at_utc FROM demo_client_restrictions WHERE removed_at_utc IS NULL AND (${global} OR source_tenant_code=(SELECT code FROM demo_tenants WHERE id=${session.tenant_id})) AND (${searched}::text IS NULL OR dpi=${searched}) ORDER BY created_at_utc DESC LIMIT 20 OFFSET ${(page-1)*20}`;
  return { items: rows.map(map), page, pageSize: 20, totalCount: count.total, totalPages: Math.max(1, Math.ceil(count.total/20)) };
}
export async function createRestriction(session: DemoSession, dpiInput: string, confirmInput: string, reasonInput: string): Promise<ClientRestriction> {
  await administrator(session);
  const dpi = key(dpiInput);
  ensure(key(confirmInput) === dpi, 'Los DPI no coinciden.');
  const reason = reasonInput.trim();
  ensure(reason.length >= 10 && reason.length <= 2000, 'Indique un motivo de 10 a 2000 caracteres.');
  const rows = await database().begin(async transaction => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${dpi}, 0))`;
    return transaction<Row[]>`INSERT INTO demo_client_restrictions(id,dpi,reason,source_tenant_code,issued_by_name)
    SELECT gen_random_uuid(),${dpi},${reason},t.code,${session.user_id === rootId ? 'Administrador de plataforma' : 'Administrador de sede'}
    FROM demo_tenants t WHERE t.id=${session.tenant_id} ON CONFLICT(dpi) WHERE removed_at_utc IS NULL DO NOTHING
    RETURNING id,dpi,reason,source_tenant_code,issued_by_name,created_at_utc`;
  });
  ensure(rows[0], 'Este DPI ya está en lista negra.', 409);
  return map(rows[0]);
}
export async function removeRestriction(session: DemoSession, id: string, reasonInput: string) {
  await administrator(session);
  const reason = reasonInput.trim();
  ensure(reason.length >= 10 && reason.length <= 2000, 'Indique un motivo de 10 a 2000 caracteres.');
  const rows = await database()`UPDATE demo_client_restrictions SET removed_at_utc=now(),removed_by_name=${session.user_id === rootId ? 'Administrador de plataforma' : 'Administrador de sede'},removal_reason=${reason}
    WHERE id=${id} AND removed_at_utc IS NULL AND (${session.platform_admin} OR source_tenant_code=(SELECT code FROM demo_tenants WHERE id=${session.tenant_id})) RETURNING id`;
  ensure(rows.length, 'No se encontró un bloqueo vigente que pueda retirar esta sede.', 404);
}
