// Recorrido integral en el entorno QA aislado. No usa bases operativas.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const [modules, environmentPath] = process.argv.slice(2);
  if (!modules || !environmentPath) throw new Error('Indique módulos Playwright y environment.json QA.');
  const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
  assert.match(environment.databaseName, /^bufete_changes_qa_[a-f0-9]{12}$/);
  assert.equal(environment.port, 5103);
  const config = {};
  for (const file of ['.env', '.env.platform.local']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const index = line.indexOf('='); config[line.slice(0, index)] = line.slice(index + 1);
  }
  const api = 'http://127.0.0.1:5103/api/v1', web = 'http://127.0.0.1:5191';
  async function req(route, body, token, method = 'POST') {
    const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': 'peten', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.text(); return { status: response.status, data: raw ? JSON.parse(raw) : null };
  }
  const session = await req('/auth/login', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password });
  assert.equal(session.status, 200); const token = session.data.accessToken;
  const stamp = Date.now();
  const client = await req('/clients', { fullName: `Persona expediente UI QA ${stamp}`, dpi: String(stamp), residenceAddress: 'Dirección QA', assistanceRequested: 'Proceso QA', receptionPlace: 'Sede Petén QA', receptionDate: '2026-10-12', childrenCount: 0 }, token);
  assert.equal(client.status, 201, JSON.stringify(client.data));
  const processes = await req('/catalogs/process-types', undefined, token, 'GET');
  assert.equal(processes.status, 200); const processType = processes.data.find(item => item.isActive); assert.ok(processType);
  const { chromium } = require(path.join(modules, 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.setDefaultTimeout(45000);
  const errors = [], badResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 500) badResponses.push({ url: response.url(), status: response.status() }); });
  let caseId = null;
  try {
    await page.goto(web + '/acceso');
    await page.getByLabel('Código de sede').fill('peten');
    await page.getByLabel('Correo electrónico').fill(config.PlatformAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.PlatformAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.goto(web + '/expedientes');
    await page.getByRole('button', { name: 'Abrir expediente' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Abrir expediente' });
    await dialog.getByRole('combobox', { name: 'Usuario' }).fill(`Persona expediente UI QA ${stamp}`);
    await dialog.getByRole('option', { name: new RegExp(`Persona expediente UI QA ${stamp}`) }).click();
    const processInput = dialog.getByRole('combobox', { name: 'Tipo de proceso' });
    await processInput.fill(processType.code);
    await dialog.getByRole('option', { name: new RegExp(processType.code) }).click();
    assert.match(await processInput.inputValue(), new RegExp(processType.code));
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByRole('button', { name: 'Abrir expediente' }).click();
    await page.waitForURL(url => /^\/expedientes\/[a-f0-9-]{36}$/.test(url.pathname));
    caseId = new URL(page.url()).pathname.split('/').pop();
    const detail = await req(`/cases/${caseId}`, undefined, token, 'GET');
    assert.equal(detail.status, 200); assert.equal(detail.data.summary.processTypeId, processType.id);
    await page.getByRole('tab', { name: /Memoriales/ }).waitFor();
    const tabs = await page.getByRole('tablist').getByRole('tab').allTextContents();
    const memorialIndex = tabs.findIndex(item => item.startsWith('Memoriales'));
    const timelineIndex = tabs.findIndex(item => item.startsWith('Línea de tiempo'));
    assert.ok(memorialIndex >= 0 && timelineIndex >= 0 && memorialIndex < timelineIndex, JSON.stringify(tabs));
    await page.getByRole('button', { name: 'Finalizar proceso' }).first().click();
    const closeDialog = page.getByRole('dialog', { name: 'Finalizar proceso' });
    await closeDialog.getByLabel('Motivo').fill('Finalización QA con persistencia');
    await closeDialog.getByRole('button', { name: 'Finalizar proceso' }).click();
    await page.getByRole('button', { name: 'Marcar activo' }).first().waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Marcar activo' }).first().waitFor();
    assert.equal((await req(`/cases/${caseId}`, undefined, token, 'GET')).data.summary.status, 'Closed');
    await page.getByRole('button', { name: 'Marcar activo' }).first().click();
    const reopenDialog = page.getByRole('dialog', { name: 'Marcar expediente activo' });
    await reopenDialog.getByLabel('Motivo').fill('Reapertura QA');
    await reopenDialog.getByRole('button', { name: 'Marcar activo' }).click();
    await page.getByRole('button', { name: 'Finalizar proceso' }).first().waitFor();
    await page.reload();
    assert.equal((await req(`/cases/${caseId}`, undefined, token, 'GET')).data.summary.status, 'Active');
    await page.getByRole('tab', { name: /Línea de tiempo/ }).click();
    await page.getByText('Expediente cerrado').waitFor();
    await page.getByText('Expediente reabierto').waitFor();
    await page.getByRole('button', { name: 'Dar de baja' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Dar de baja' }).click();
    await page.waitForURL(url => url.pathname === '/expedientes');
    const deleted = await req(`/deleted-records?search=${encodeURIComponent(detail.data.summary.caseNumber)}`, undefined, token, 'GET');
    assert.equal(deleted.status, 200); assert.ok(deleted.data.items.some(item => item.id === caseId));
    assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
    console.log(JSON.stringify({ qaDatabase: environment.databaseName, clientId: client.data.id, caseId, processCode: processType.code, checks: ['selector por código', 'apertura y persistencia', 'orden Memoriales/Línea de tiempo', 'finalizar y refrescar', 'reactivar y refrescar', 'historial de ambos estados', 'dar de baja', 'consola y red sin errores'] }, null, 2));
  } finally {
    await browser.close();
    // The fixture stays soft-deleted for verification; all data lives in the QA database.
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
