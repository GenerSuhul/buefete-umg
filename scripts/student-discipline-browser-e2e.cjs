const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PDFDocument } = require('../frontend/node_modules/pdf-lib');

async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const base = process.env.STUDENT_QA_WEB || 'http://127.0.0.1:5191';
  const api = (process.env.STUDENT_QA_API || 'http://127.0.0.1:5103') + '/api/v1';
  const config = {};
  for (const file of ['.env', '.env.platform.local']) if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('='); if (index > 0 && !line.trimStart().startsWith('#')) config[line.slice(0,index)] = line.slice(index+1);
  }
  const suffix = Date.now().toString();
  const artifacts = path.resolve('.artifacts/student-discipline-browser', suffix);
  fs.mkdirSync(artifacts, { recursive: true });
  async function call(method, endpoint, body, token) {
    const response = await fetch(api + endpoint, { method, headers: { 'X-Sede-Code': 'peten', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await response.text(); return { status: response.status, value: raw ? JSON.parse(raw) : null };
  }
  const login = await call('POST', '/auth/login', { email: config.BootstrapAdmin__Email, password: config.BootstrapAdmin__Password });
  assert.equal(login.status, 200);
  const token = login.value.accessToken;
  const registration = await call('POST', '/students/registration', {
    student: { fullName: `Alumno disciplina navegador ${suffix}`, birthDate: '2000-01-01', studentCardNumber: `QA-BR-${suffix}`, dpi: suffix.slice(-13).padStart(13,'7'), studyShift: 'Domingo', residenceAddress: 'Dirección QA', mobilePhone: '56857965', registrationDate: '2026-10-27' },
    enrollment: { modality: 'CivilFamilyCases', initialStatus: 'Draft' }, access: null,
  }, token);
  assert.equal(registration.status, 201, JSON.stringify(registration.value));
  const studentId = registration.value.student.id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  const steps = [];
  try {
    await page.goto(base + '/acceso');
    await page.getByLabel('Código de sede').fill('peten');
    await page.getByLabel('Correo electrónico').fill(config.BootstrapAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.BootstrapAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.goto(base + `/personas/alumnos/${studentId}`);
    await page.getByRole('tab', { name: 'Amonestaciones' }).click();
    const panel = page.locator('section[aria-label="Amonestaciones del alumno"]');
    await panel.getByText('Sin amonestaciones registradas.').waitFor();
    await panel.locator('select').selectOption('PermanentSuspension');
    await panel.locator('textarea').first().fill('Suspensión definitiva validada en navegador QA');
    await panel.getByRole('button', { name: 'Registrar amonestación' }).click();
    const createResponse = page.waitForResponse(response => response.url().endsWith(`/students/${studentId}/disciplines`) && response.request().method() === 'POST');
    await page.getByRole('dialog', { name: 'Confirmar suspensión global' }).getByRole('button', { name: 'Confirmar suspensión' }).click();
    assert.equal((await createResponse).status(), 201);
    await panel.locator('li').first().getByText('Suspensión definitiva', { exact: false }).waitFor();
    await page.reload();
    await page.getByText('Alumno suspendido', { exact: true }).first().waitFor();
    steps.push('Suspensión definitiva: confirmación, guardado, alerta visible y refresh');
    await page.getByRole('tab', { name: 'Amonestaciones' }).click();
    await panel.getByRole('button', { name: 'Retirar' }).first().click();
    await panel.locator('textarea').last().fill('Retiro administrativo validado en navegador QA');
    await panel.getByRole('button', { name: 'Confirmar retiro' }).click();
    const revokeResponse = page.waitForResponse(response => response.url().includes('/revoke') && response.request().method() === 'POST');
    await page.getByRole('dialog', { name: 'Retirar amonestación' }).getByRole('button', { name: 'Retirar medida' }).click();
    assert.equal((await revokeResponse).status(), 200);
    await panel.getByText('Retirada:', { exact: false }).first().waitFor();
    await page.reload();
    assert.equal(await page.getByText('Alumno suspendido', { exact: true }).count(), 0);
    steps.push('Retiro: confirmación, historial y alerta desaparece tras refresh');
    await page.getByRole('tab', { name: 'Amonestaciones' }).click();
    await panel.locator('select').selectOption('WrittenWarning');
    await panel.locator('textarea').first().fill('Amonestación escrita validada en navegador QA');
    const pdf = await PDFDocument.create(); pdf.addPage([300,400]);
    const bytes = Buffer.from(await pdf.save());
    await panel.locator('input[type=file]').setInputFiles({ name: 'amonestacion-firmada.pdf', mimeType: 'application/pdf', buffer: bytes });
    const writtenResponse = page.waitForResponse(response => response.url().endsWith(`/students/${studentId}/disciplines`) && response.request().method() === 'POST');
    await panel.getByRole('button', { name: 'Registrar amonestación' }).click();
    assert.equal((await writtenResponse).status(), 201);
    await panel.locator('li').first().getByText('Amonestación escrita', { exact: false }).waitFor();
    const whatsapp = panel.locator('a[href^="https://wa.me/"]').first();
    assert.match(await whatsapp.getAttribute('href'), /wa\.me\/50256857965\?text=/);
    const listed = await call('GET', `/students/${studentId}/disciplines`, null, token);
    assert.equal(listed.status, 200);
    const written = listed.value.find(item => item.kind === 'WrittenWarning');
    assert.ok(written?.documentId);
    const responsePromise = page.waitForResponse(response => response.url().includes(`/disciplines/${written.id}/document`));
    await panel.getByRole('button', { name: 'Ver PDF' }).click();
    const documentResponse = await responsePromise;
    assert.equal(documentResponse.status(), 200);
    assert.match(documentResponse.headers()['content-type'] ?? '', /application\/pdf/);
    await page.screenshot({ path: path.join(artifacts, 'amonestacion.png'), fullPage: true });
    steps.push('Amonestación escrita: PDF real abierto desde UI, WhatsApp preparado');
    assert.deepEqual(pageErrors, []);
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed: true, studentId, steps, pageErrors }, null, 2));
    console.log(JSON.stringify({ passed: true, studentId, steps, artifacts }));
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed: false, studentId, steps, error: error.message, pageErrors }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
