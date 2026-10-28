// Read-only browser regression after rebuilding the native frontend.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const base = process.argv[3] || 'http://127.0.0.1:5180';
  const config = { ...process.env };
  for (const file of ['.env', '.env.platform.local']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const separator = line.indexOf('=');
      if (separator > 0 && !line.trimStart().startsWith('#')) {
        const key = line.slice(0, separator).trim();
        if (!config[key]) config[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  assert.ok(config.BootstrapAdmin__Email && config.BootstrapAdmin__Password, 'Faltan credenciales locales de prueba.');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  const failures = [];
  page.on('pageerror', () => errors.push('pageerror'));
  page.on('console', message => { if (message.type() === 'error') errors.push('console.error'); });
  page.on('response', response => { if (response.status() >= 400) failures.push({ status: response.status(), path: new URL(response.url()).pathname }); });
  const checked = [];
  try {
    await page.goto(`${base}/acceso`);
    await page.getByLabel('Código de sede').fill(config.QA_TENANT_CODE || 'peten');
    await page.getByLabel('Correo electrónico').fill(config.BootstrapAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.BootstrapAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    checked.push('login');
    for (const route of ['/personas/clientes', '/personas/alumnos', '/expedientes']) {
      await page.goto(`${base}${route}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname, route);
      await page.reload();
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname, route);
      checked.push(`${route}: reload`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    console.log(JSON.stringify({ passed: true, checked, consoleErrors: errors.length, failedResponses: failures.length }));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
