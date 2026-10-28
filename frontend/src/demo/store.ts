import "server-only";
import postgres from "postgres";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  DemoError,
  emptyState,
  ensure,
  id,
  rootId,
  normalizeInstitutionalProfile,
  type DemoState,
} from "./model";
import type { DemoTenant } from "./client";
import { isStudentBlocked } from './studentDiscipline';

const connection = () => {
  ensure(
    process.env.DEMO_MODE === "true",
    "Este entorno no dispone de la demo.",
    404,
  );
  ensure(
    process.env.DEMO_DATABASE_URL,
    "Falta configurar la base de datos de la demo.",
    503,
  );
  return process.env.DEMO_DATABASE_URL!;
};
let pool: ReturnType<typeof postgres> | undefined;
export const database = () =>
  (pool ??= postgres(connection(), {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: "require",
  }));
let initialized: Promise<void> | undefined;
export function initializeDemo() {
  return (initialized ??= (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS demo_tenants (id uuid PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, is_active boolean NOT NULL DEFAULT true, state jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0)`;
    await sql`CREATE TABLE IF NOT EXISTS demo_sessions (hash text PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES demo_tenants(id), user_id uuid NOT NULL, platform_admin boolean NOT NULL, expires_at timestamptz NOT NULL)`;
    await sql`CREATE INDEX IF NOT EXISTS demo_sessions_expiry ON demo_sessions(expires_at)`;
    await sql`CREATE TABLE IF NOT EXISTS demo_login_attempts (key text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS demo_client_restrictions (id uuid PRIMARY KEY, dpi text NOT NULL, reason text NOT NULL, source_tenant_code text NOT NULL, issued_by_name text NOT NULL, created_at_utc timestamptz NOT NULL DEFAULT now(), removed_at_utc timestamptz, removed_by_name text, removal_reason text)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS demo_client_restrictions_active_dpi ON demo_client_restrictions(dpi) WHERE removed_at_utc IS NULL`;
    await sql`CREATE TABLE IF NOT EXISTS demo_student_disciplines (id uuid PRIMARY KEY,dpi text NOT NULL,student_name text NOT NULL,kind text NOT NULL,reason text NOT NULL,starts_on date,ends_on date,document_id uuid,source_tenant_code text NOT NULL,issued_by_name text NOT NULL,created_at_utc timestamptz NOT NULL DEFAULT now(),revoked_at_utc timestamptz,revocation_reason text,revoked_by_user_id uuid)`;
    await sql`CREATE INDEX IF NOT EXISTS demo_student_disciplines_dpi ON demo_student_disciplines(dpi,created_at_utc DESC)`;
    const seed = emptyState(
      process.env.DEMO_ADMIN_EMAIL ?? "licenciado@demo.umg.gt",
    );
    await sql`INSERT INTO demo_tenants(id,code,name,state) VALUES ('84a93391-1076-4b52-9ba5-7cb7fcb06505','peten','Bufete Popular UMG · Petén',${sql.json(seed as never)}) ON CONFLICT(code) DO NOTHING`;
    await sql.begin(async (transaction) => {
      const legacy = transaction.json({ users: [{ id: rootId, fullName: "Licenciado Demo" }] });
      const rows = await transaction`SELECT id,state FROM demo_tenants WHERE state @> ${legacy}::jsonb FOR UPDATE`;
      for (const row of rows) {
        const state = row.state as DemoState;
        if (normalizeInstitutionalProfile(state))
          await transaction`UPDATE demo_tenants SET state=${transaction.json(state as never)},revision=revision+1 WHERE id=${row.id}`;
      }
    });
  })().catch((error) => {
    initialized = undefined;
    throw error;
  }));
}
export function hashPassword(password: string) {
  ensure(
    password.length >= 8 && password.length <= 128,
    "La contraseña debe tener entre 8 y 128 caracteres.",
  );
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest || password.length > 128) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export interface DemoSession {
  hash: string;
  tenant_id: string;
  user_id: string;
  platform_admin: boolean;
  expires_at: Date;
}
export async function sessionFor(token: string) {
  await initializeDemo();
  const [session] = await database()<
    DemoSession[]
  >`SELECT * FROM demo_sessions WHERE hash=${tokenHash(token)} AND expires_at>now()`;
  ensure(session, "La sesión finalizó. Inicie sesión nuevamente.", 401);
  const [tenant] = await database()`SELECT state FROM demo_tenants WHERE id=${session.tenant_id}`;
  const student = (tenant?.state as DemoState | undefined)?.students.find(x => x.student.userAccountId === session.user_id);
  if (student) ensure(!await isStudentBlocked(student.student.dpi, database()), 'El alumno tiene una suspensión global vigente.', 401);
  return session;
}
export async function issueSession(
  tenantId: string,
  userId: string,
  platformAdmin: boolean,
) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 12 * 3600_000);
  await database()`INSERT INTO demo_sessions(hash,tenant_id,user_id,platform_admin,expires_at) VALUES (${tokenHash(token)},${tenantId},${userId},${platformAdmin},${expires})`;
  const [row] =
    await database()`SELECT state FROM demo_tenants WHERE id=${tenantId} AND is_active=true`;
  const user = (row.state as DemoState).users.find((u) => u.id === userId)!;
  const permissions = user.roles.includes("AdministradorGeneral")
    ? ["*"]
    : user.roles.includes("Secretaria")
      ? [
          "dashboard.read",
          "clients.read",
          "clients.write",
          "students.read",
          "students.write",
          "cases.read",
          "cases.write",
          "documents.read",
          "documents.write",
          "activities.read",
          "activities.write",
          "reports.generate",
          "reports.review",
          "reports.send",
        ]
      : [
          "dashboard.read",
          "students.self.read",
          "cases.assigned.read",
          "documents.read",
        ];
  return {
    accessToken: token,
    accessTokenExpiresAtUtc: expires.toISOString(),
    refreshToken: token,
    refreshTokenExpiresAtUtc: expires.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      photoDocumentId: user.photoDocumentId,
      roles: user.roles,
      permissions,
    },
  };
}
export async function login(email: string, password: string, ip: string) {
  await initializeDemo();
  const sql = database(),
    key = createHash("sha256")
      .update(ip + email.toLowerCase())
      .digest("hex");
  const [attempt] =
    await sql`INSERT INTO demo_login_attempts(key,attempts,reset_at) VALUES (${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN demo_login_attempts.reset_at<now() THEN 1 ELSE demo_login_attempts.attempts+1 END, reset_at=CASE WHEN demo_login_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE demo_login_attempts.reset_at END RETURNING attempts`;
  ensure(
    attempt.attempts <= 15,
    "Demasiados intentos. Espere 15 minutos.",
    429,
  );
  const tenants =
    await sql`SELECT id,code,state FROM demo_tenants WHERE is_active=true ORDER BY code='peten' DESC`;
  const root =
    email.trim().toLowerCase() ===
    (process.env.DEMO_ADMIN_EMAIL ?? "licenciado@demo.umg.gt").toLowerCase();
  if (
    root &&
    process.env.DEMO_ADMIN_PASSWORD_HASH &&
    checkPassword(password, process.env.DEMO_ADMIN_PASSWORD_HASH)
  ) {
    await sql`DELETE FROM demo_login_attempts WHERE key=${key}`;
    return issueSession(tenants[0].id, rootId, true);
  }
  for (const tenant of tenants) {
    const state = tenant.state as DemoState;
    const user = state.users.find(
      (u) =>
        u.id !== rootId &&
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        effectiveActive(u),
    );
    if (user && checkPassword(password, state.passwords[user.id] ?? "")) {
      const student = state.students.find(x => x.student.userAccountId === user.id);
      if (student) ensure(!await isStudentBlocked(student.student.dpi, sql), 'El alumno tiene una suspensión global vigente.', 403);
      await sql`DELETE FROM demo_login_attempts WHERE key=${key}`;
      return issueSession(tenant.id, user.id, false);
    }
  }
  throw new DemoError("Correo o contraseña incorrectos.", 401);
}
export function effectiveActive(user: DemoState["users"][number]) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    user.isActive &&
    !user.isDeleted &&
    (!user.participationStartDate || user.participationStartDate <= today) &&
    (!user.participationEndDate || user.participationEndDate >= today)
  );
}
export async function workspace(session: DemoSession) {
  const rows = await database()<
    Array<{ id: string; code: string; name: string; is_active: boolean }>
  >`SELECT id,code,name,is_active FROM demo_tenants WHERE ${session.platform_admin} OR id=${session.tenant_id} ORDER BY name`;
  const tenants: DemoTenant[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    isActive: r.is_active,
  }));
  return {
    current: tenants.find((t) => t.id === session.tenant_id)!,
    tenants,
    platformAdmin: session.platform_admin,
  };
}
export async function createTenant(
  session: DemoSession,
  code: string,
  name: string,
) {
  ensure(
    session.platform_admin,
    "Sólo el administrador de plataforma puede crear sedes.",
    403,
  );
  ensure(
    /^[a-z0-9][a-z0-9-]{1,39}$/.test(code),
    "Use un código de 2 a 40 letras minúsculas, números o guiones.",
  );
  ensure(
    name.trim().length >= 3 && name.trim().length <= 120,
    "Indique un nombre de sede entre 3 y 120 caracteres.",
  );
  const tenantId = id(),
    state = emptyState(
      process.env.DEMO_ADMIN_EMAIL ?? "licenciado@demo.umg.gt",
    );
  state.audit.push({
    id: id(),
    userId: session.user_id,
    username: "licenciado.demo",
    occurredAtUtc: new Date().toISOString(),
    action: "Sede creada",
    entityType: "Tenant",
    entityId: tenantId,
    changesJson: null,
    traceId: id(),
    ipAddress: null,
  });
  try {
    await database()`INSERT INTO demo_tenants(id,code,name,state) VALUES (${tenantId},${code},${name.trim()},${database().json(state as never)})`;
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new DemoError("El código de sede ya existe.");
    throw error;
  }
  return workspace(session);
}
export async function switchTenant(session: DemoSession, tenantId: string) {
  ensure(
    session.platform_admin || tenantId === session.tenant_id,
    "No tiene acceso a esta sede.",
    403,
  );
  const [tenant] =
    await database()`SELECT id FROM demo_tenants WHERE id=${tenantId} AND is_active=true`;
  ensure(tenant, "La sede no está disponible.", 404);
  const result = await issueSession(
    tenantId,
    session.platform_admin ? rootId : session.user_id,
    session.platform_admin,
  );
  await revoke(session);
  return result;
}
export const revoke = (session: DemoSession) =>
  database()`DELETE FROM demo_sessions WHERE hash=${session.hash}`;

export async function inTenant<T>(
  session: DemoSession,
  write: boolean,
  fn: (state: DemoState, sql: postgres.TransactionSql) => Promise<T> | T,
): Promise<T> {
  const result = await database().begin(async (sql) => {
    const [row] = write
      ? await sql`SELECT state FROM demo_tenants WHERE id=${session.tenant_id} AND is_active=true FOR UPDATE`
      : await sql`SELECT state FROM demo_tenants WHERE id=${session.tenant_id} AND is_active=true`;
    ensure(row, "La sede no está disponible.", 403);
    const state = row.state as DemoState;
    const user = state.users.find((u) => u.id === session.user_id);
    ensure(
      user && effectiveActive(user),
      "La cuenta no tiene acceso vigente.",
      401,
    );
    const value = await fn(state, sql);
    if (write)
      await sql`UPDATE demo_tenants SET state=${sql.json(state as never)},revision=revision+1 WHERE id=${session.tenant_id}`;
    return value;
  });
  return result as T;
}
