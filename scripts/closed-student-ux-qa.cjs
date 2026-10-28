const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const fixture = JSON.parse(fs.readFileSync('.artifacts/changes-qa/legal-study/result.json', 'utf8'));
  const config = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto('http://127.0.0.1:5191/acceso');
    const seat = page.getByLabel('Código de sede'); if (await seat.count()) await seat.fill('peten');
    await page.getByLabel('Correo electrónico').fill(config.BootstrapAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.BootstrapAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.goto(`http://127.0.0.1:5191/personas/alumnos/${fixture.studentId}`);
    await page.getByText('Práctica cerrada', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reactivar', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Activar acceso', exact: true }).count(), 0);
    await page.getByRole('tab', { name: 'Estudio jurídico', exact: true }).click();
    await page.getByText('Estudio jurídico entregado · práctica cerrada', { exact: true }).waitFor();
    await page.screenshot({ path: '.artifacts/changes-qa/legal-study/closed-student-ux.png', fullPage: true });
    console.log('Alumno cerrado: sin reactivación ni activación de acceso; estudio e historial visibles.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
