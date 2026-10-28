const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const config = {};
for (const file of ['.env', '.env.platform.local']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const offset = line.indexOf('='); if (offset > 0 && !line.startsWith('#')) config[line.slice(0, offset)] = line.slice(offset + 1);
}
const api = process.env.BUFETE_QA_API || 'http://127.0.0.1:5103/api/v1';
const web = process.env.BUFETE_QA_WEB || 'http://127.0.0.1:5191';
async function req(route, method, body, token, tenant = 'peten') {
  const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text(); return { status: response.status, body: raw ? JSON.parse(raw) : null };
}
async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const suffix = Date.now().toString(), code = `qa-ui-rehab-${suffix}`, dpi = suffix.padEnd(13, '0').slice(0, 13);
  const email = `${code}@example.test`, password = crypto.randomBytes(16).toString('hex');
  const root = await req('/auth/login', 'POST', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password }); assert.equal(root.status, 200);
  assert.equal((await req('/platform/tenants', 'POST', { code, name: code, administratorName: 'QA Rehabilitación', administratorEmail: email, administratorPassword: password }, root.body.accessToken)).status, 200);
  const login = await req('/auth/login', 'POST', { email, password }, null, code); assert.equal(login.status, 200);
  const created = await req('/client-restrictions', 'POST', { dpi, confirmDpi: dpi, reason: `QA restricción interfaz ${suffix}` }, login.body.accessToken, code); assert.equal(created.status, 201, JSON.stringify(created.body));
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
    await page.getByRole('link', { name: /Lista negra/ }).click();
    await page.waitForURL(url => url.pathname === '/vetos');
    await page.getByText(`QA restricción interfaz ${suffix}`).waitFor();
    await page.getByRole('button', { name: 'Habilitar nuevamente' }).click();
    await page.getByLabel('Motivo de la rehabilitación').fill(`QA habilitación por decisión administrativa ${suffix}`);
    await page.getByRole('button', { name: 'Confirmar habilitación' }).click();
    await page.getByText('No hay personas en lista negra que coincidan con esta consulta.').waitFor();
    await page.reload();
    await page.getByText('No hay personas en lista negra que coincidan con esta consulta.').waitFor();
    const status = await req('/client-restrictions/check', 'POST', { dpi }, login.body.accessToken, code);
    assert.equal(status.body.isRestricted, false);
    const person = await req('/clients', 'POST', { fullName: `Cliente QA ${suffix}`, dpi, residenceAddress: 'Dirección QA', assistanceRequested: 'Proceso QA', receptionPlace: 'Sede QA', receptionDate: '2026-10-27', childrenCount: 0, mobilePhone: '55551002' }, login.body.accessToken, code);
    assert.equal(person.status, 201, JSON.stringify(person.body));
    await page.goto(web + `/personas/clientes/${person.body.id}`);
    await page.getByRole('button', { name: 'Editar datos' }).waitFor();
    assert.equal(await page.getByRole('tab', { name: /Papelería/ }).count(), 0);
    const whatsapp = page.getByRole('link', { name: /Enviar mensaje por WhatsApp/ });
    assert.match(await whatsapp.getAttribute('href'), /^https:\/\/wa\.me\/50255551002\?text=/);
    await page.getByRole('button', { name: 'Editar datos' }).click();
    await page.getByLabel('Nombre completo').fill(`Cliente actualizado ${suffix}`);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByText(`Cliente actualizado ${suffix}`).first().waitFor();
    await page.reload();
    await page.getByText(`Cliente actualizado ${suffix}`).first().waitFor();
    await page.getByRole('tab', { name: /Ingresos/ }).click();
    await page.getByText(/Documentos|declaraciones/i).first().waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ok: true, api, web, tenant: code, restrictionId: created.body.id, clientId: person.body.id, status: status.body.isRestricted, errors, failed }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
