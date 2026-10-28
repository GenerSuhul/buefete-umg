const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const modulesPath = process.argv[2];
  const studentId = process.argv[3];
  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const config = {};
  for (const file of ['.env', '.env.platform.local']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const separator = line.indexOf('=');
      if (separator > 0 && !line.trimStart().startsWith('#')) config[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5180/acceso');
    await page.getByLabel('Código de sede').fill('peten');
    await page.getByLabel('Correo electrónico').fill(config.BootstrapAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.BootstrapAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    try { await page.waitForURL(url => url.pathname === '/', { timeout: 10000 }); }
    catch (error) {
      console.error('Login did not navigate:', (await page.locator('body').innerText()).slice(0, 800));
      throw error;
    }
    await page.goto(`http://127.0.0.1:5180/personas/alumnos/${studentId}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const link = page.getByRole('link', { name: /Enviar mensaje por WhatsApp/ });
    await link.waitFor();
    const href = await link.getAttribute('href');
    assert.match(href, /^https:\/\/wa\.me\/502\d{8}\?text=/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, url: page.url(), whatsapp: href.split('?')[0], errors }));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
