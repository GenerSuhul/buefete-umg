const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const config = {};
for (const file of ['.env', '.env.platform.local']) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const offset = line.indexOf('=');
    if (offset > 0 && !line.startsWith('#')) config[line.slice(0, offset)] = line.slice(offset + 1);
  }
}
const api = process.env.BUFETE_QA_API || 'http://127.0.0.1:5103/api/v1';
const web = process.env.BUFETE_QA_WEB || 'http://127.0.0.1:5191';
async function req(route, method, body, token, tenant = 'peten') {
  const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}
async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const suffix = Date.now().toString();
  const code = `qa-aviso-${suffix}`;
  const email = `${code}@example.test`;
  const password = crypto.randomBytes(16).toString('hex');
  const root = await req('/auth/login', 'POST', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password });
  assert.equal(root.status, 200, JSON.stringify(root.body));
  const tenant = await req('/platform/tenants', 'POST', { code, name: code, administratorName: 'QA Aviso', administratorEmail: email, administratorPassword: password }, root.body.accessToken);
  assert.equal(tenant.status, 200, JSON.stringify(tenant.body));
  const login = await req('/auth/login', 'POST', { email, password }, null, code);
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const endDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const student = await req('/students/registration', 'POST', { student: {
    fullName: `Alumno campanita ${suffix}`, birthDate: '2001-07-16', studentCardNumber: '1690-23-12345',
    dpi: suffix.padEnd(13, '0').slice(0, 13), studyShift: 'Entre semana', email: `${suffix}@example.test`,
    residenceAddress: 'QA', registrationDate: '2026-10-27',
  }, enrollment: { modality: 'ExternalInternship', initialStatus: 'Draft', siteName: 'QA', startDate: '2026-10-27', endDate }, access: null }, login.body.accessToken, code);
  assert.equal(student.status, 201, JSON.stringify(student.body));
  const id = student.body.enrollment.id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 500) failed.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.goto(web + '/acceso');
    await page.getByLabel('Código de sede').fill(code);
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    const bell = page.getByRole('button', { name: /Notificaciones, 1 nuevas/ });
    await bell.waitFor({ timeout: 30000 });
    await bell.click();
    await page.getByText(`Alumno campanita ${suffix}`).waitFor();
    await page.getByRole('button', { name: new RegExp(`Alumno campanita ${suffix}`) }).click();
    await page.waitForURL(url => url.pathname.includes('/personas/alumnos/'));
    await page.reload();
    await page.getByRole('button', { name: 'Notificaciones', exact: true }).waitFor();
    const persisted = await req('/practice-notices', 'GET', undefined, login.body.accessToken, code);
    const notice = persisted.body.find(item => item.id === id);
    assert.equal(notice?.isRead, true);
    assert.equal(notice?.isSounded, true);
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ok: true, api, web, tenant: code, noticeId: id, isRead: notice.isRead, isSounded: notice.isSounded, errors, failed }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
