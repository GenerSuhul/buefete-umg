// E2E on isolated QA API/DB only. Creates and purges a unique fictitious client.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const [modules, environmentPath] = process.argv.slice(2);
  if (!modules || !environmentPath) throw new Error('Usage: node script <playwright-node_modules> <QA environment.json>');
  const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
  assert.match(environment.databaseName, /^bufete_changes_qa_[a-f0-9]{12}$/);
  assert.equal(environment.port, 5103);
  const config = {};
  for (const file of ['.env', '.env.platform.local']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const i = line.indexOf('='); config[line.slice(0, i)] = line.slice(i + 1);
  }
  const api = 'http://127.0.0.1:5103/api/v1';
  const web = 'http://127.0.0.1:5191';
  const stamp = Date.now();
  async function req(route, body, token, method = 'POST') {
    const r = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': 'peten', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await r.text(); return { status: r.status, data: raw ? JSON.parse(raw) : null };
  }
  const login = await req('/auth/login', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password }); assert.equal(login.status, 200);
  const token = login.data.accessToken;
  const client = await req('/clients', { fullName: `Persona purga UI QA ${stamp}`, dpi: String(stamp), residenceAddress: 'QA', assistanceRequested: 'QA', receptionPlace: 'QA', receptionDate: '2026-10-12', childrenCount: 0 }, token);
  assert.equal(client.status, 201, JSON.stringify(client.data));
  assert.equal((await req(`/clients/${client.data.id}`, { reason: 'Prueba interfaz QA' }, token, 'DELETE')).status, 204);
  const preview = await req(`/deleted-records/Client/${client.data.id}/purge-preview`, undefined, token, 'GET'); assert.equal(preview.status, 200);

  const { chromium } = require(path.join(modules, 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [], badResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 500) badResponses.push({ url: response.url(), status: response.status() }); });
  page.setDefaultTimeout(45000);
  try {
    await page.goto(web + '/acceso');
    await page.getByLabel('Código de sede').fill('peten');
    await page.getByLabel('Correo electrónico').fill(config.PlatformAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.PlatformAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.goto(web + '/eliminados');
    const row = page.locator('.deleted-records-list article').filter({ hasText: `Persona purga UI QA ${stamp}` });
    await row.waitFor();
    await row.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Eliminar definitivamente' });
    await dialog.getByLabel(`Escriba ${preview.data.reference} para confirmar`).waitFor();
    const purgeButton = dialog.getByRole('button', { name: 'Eliminar definitivamente' });
    assert.equal(await purgeButton.isDisabled(), true);
    await dialog.getByLabel(`Escriba ${preview.data.reference} para confirmar`).fill(preview.data.reference);
    assert.equal(await purgeButton.isEnabled(), true);
    await purgeButton.click();
    await row.waitFor({ state: 'detached' });
    await page.reload();
    assert.equal(await page.getByText(`Persona purga UI QA ${stamp}`).count(), 0);
    assert.equal((await req(`/deleted-records/Client/${client.data.id}/purge-preview`, undefined, token, 'GET')).status, 404);
    await page.goto(web + '/catalogos');
    await page.getByRole('button', { name: 'Requisito', exact: true }).click();
    for (const label of ['Condicional', 'Vigencia máxima (días)', 'Condición', 'Instrucciones'])
      assert.equal(await page.getByLabel(label, { exact: true }).count(), 0, label);
    assert.deepEqual(errors, []);
    assert.deepEqual(badResponses, []);
    console.log(JSON.stringify({ qaDatabase: environment.databaseName, clientId: client.data.id, checks: ['modal preview', 'typed confirmation', 'purge', 'refresh', 'catalog removed fields', 'console/network clean'] }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
