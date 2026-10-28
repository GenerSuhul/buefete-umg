const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const config = {};
for (const file of ['.env', '.env.platform.local']) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const offset = line.indexOf('=');
    if (offset < 1 || line.startsWith('#')) continue;
    config[line.slice(0, offset)] = line.slice(offset + 1);
  }
}
const base = process.env.BUFETE_QA_API || 'http://127.0.0.1:5106/api/v1';
const suffix = Date.now().toString();
const dpi = suffix.padEnd(13, '0').slice(0, 13);
const password = crypto.randomBytes(16).toString('hex');
async function req(path, method, body, token, tenant = 'peten') {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}
async function main() {
  const root = await req('/auth/login', 'POST', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password });
  assert.equal(root.status, 200, JSON.stringify(root.body));
  const rootToken = root.body.accessToken;
  const tenants = [];
  for (const index of [1, 2]) {
    const code = `qa-rehab-${suffix}-${index}`;
    const email = `${code}@example.test`;
    const created = await req('/platform/tenants', 'POST', { code, name: code, administratorName: 'QA Administrador', administratorEmail: email, administratorPassword: password }, rootToken);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const login = await req('/auth/login', 'POST', { email, password }, null, code);
    assert.equal(login.status, 200, JSON.stringify(login.body));
    tenants.push({ code, token: login.body.accessToken });
  }
  const [a, b] = tenants;
  const reason = `QA institucional ${suffix}: restricción reversible`;
  const created = await req('/client-restrictions', 'POST', { dpi, confirmDpi: dpi, reason }, a.token, a.code);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.id;
  const checked = await req('/client-restrictions/check', 'POST', { dpi }, b.token, b.code);
  assert.equal(checked.status, 200); assert.equal(checked.body.isRestricted, true);
  const blocked = await req('/clients', 'POST', { fullName: 'QA Bloqueado', dpi, residenceAddress: 'QA', assistanceRequested: 'QA', receptionPlace: 'QA', receptionDate: '2026-10-27', childrenCount: 0 }, b.token, b.code);
  assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
  const foreignRemove = await req(`/client-restrictions/${id}`, 'DELETE', { reason: `QA sede no propietaria ${suffix}` }, b.token, b.code);
  assert.equal(foreignRemove.status, 403, JSON.stringify(foreignRemove.body));
  const removed = await req(`/client-restrictions/${id}`, 'DELETE', { reason: `QA rehabilitación comprobada ${suffix}` }, a.token, a.code);
  assert.equal(removed.status, 204, JSON.stringify(removed.body));
  const after = await req('/client-restrictions/check', 'POST', { dpi }, b.token, b.code);
  assert.equal(after.status, 200); assert.equal(after.body.isRestricted, false);
  const duplicate = await req(`/client-restrictions/${id}`, 'DELETE', { reason: `QA segundo intento ${suffix}` }, a.token, a.code);
  assert.equal(duplicate.status, 404, JSON.stringify(duplicate.body));
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const enrolled = await req('/students/registration', 'POST', {
    student: { fullName: `Alumno aviso QA ${suffix}`, birthDate: '2001-07-16', studentCardNumber: '1690-23-12345', dpi: `${Number(dpi) + 1}`, studyShift: 'Entre semana', email: `aviso-${suffix}@example.test`, residenceAddress: 'QA', registrationDate: '2026-10-27' },
    enrollment: { modality: 'ExternalInternship', initialStatus: 'Draft', siteName: 'QA', startDate: '2026-10-27', endDate: soon },
    access: null,
  }, a.token, a.code);
  assert.equal(enrolled.status, 201, JSON.stringify(enrolled.body));
  const noticeId = enrolled.body.enrollment.id;
  const beforeNotice = await req('/practice-notices', 'GET', undefined, a.token, a.code);
  assert.equal(beforeNotice.status, 200, JSON.stringify(beforeNotice.body));
  const notice = beforeNotice.body.find(item => item.id === noticeId);
  assert.ok(notice, JSON.stringify(beforeNotice.body));
  assert.equal(notice.isRead, false); assert.equal(notice.isSounded, false);
  assert.equal((await req(`/practice-notices/${noticeId}/sounded`, 'POST', undefined, a.token, a.code)).status, 204);
  assert.equal((await req(`/practice-notices/${noticeId}/read`, 'POST', undefined, a.token, a.code)).status, 204);
  const afterNotice = await req('/practice-notices', 'GET', undefined, a.token, a.code);
  assert.equal(afterNotice.status, 200);
  const persistedNotice = afterNotice.body.find(item => item.id === noticeId);
  assert.equal(persistedNotice?.isRead, true); assert.equal(persistedNotice?.isSounded, true);
  console.log(JSON.stringify({ ok: true, api: base, tenants: tenants.map(item => item.code), dpi, restrictionId: id, noticeId, checks: ['global-block', 'cross-tenant-permission', 'rehabilitation', 'idempotency', 'practice-notice-persistence'] }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
