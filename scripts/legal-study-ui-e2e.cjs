const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PDFDocument } = require('../frontend/node_modules/pdf-lib');

async function main() {
  const modules = process.argv[2]; if (!modules) throw new Error('Indique la ruta de módulos de Playwright.');
  const { chromium } = require(path.join(modules, 'playwright'));
  const context = JSON.parse(fs.readFileSync('.artifacts/changes-qa/legal-study/ui-context.json', 'utf8'));
  const config = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
  const base = process.env.LEGAL_STUDY_WEB || 'http://127.0.0.1:5191';
  const artifacts = path.resolve('.artifacts/changes-qa/legal-study');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(45000);
  const errors = []; const failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 400) failures.push({ status: response.status(), url: response.url() }); });
  try {
    await page.goto(base + '/acceso');
    const seat = page.getByLabel('Código de sede'); if (await seat.count()) await seat.fill('peten');
    await page.getByLabel('Correo electrónico').fill(config.BootstrapAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(config.BootstrapAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.goto(`${base}/personas/alumnos/${context.studentId}`);
    await page.getByRole('tab', { name: 'Estudio jurídico', exact: true }).click();
    await page.getByRole('button', { name: 'Primera revisión', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Primera revisión', exact: true });
    await dialog.getByLabel('Observaciones', { exact: true }).fill('Revisión QA desde navegador: documento firmado recibido.');
    const pdf = await PDFDocument.create(); pdf.addPage([300, 400]); const bytes = Buffer.from(await pdf.save());
    await dialog.locator('input[type=file]').setInputFiles({ name: 'revision-firmada-ui.pdf', mimeType: 'application/pdf', buffer: bytes });
    await dialog.getByRole('button', { name: 'Guardar revisión', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByRole('tab', { name: 'Estudio jurídico', exact: true }).click();
    await page.getByText('Revisión QA desde navegador: documento firmado recibido.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ver revisión firmada', exact: true }).click();
    const viewer = page.getByRole('dialog'); await viewer.waitFor();
    await page.screenshot({ path: path.join(artifacts, 'revision-documento.png'), fullPage: true });
    await viewer.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await page.getByRole('button', { name: 'Estudio jurídico entregado · cerrar práctica', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Entregar estudio jurídico', exact: true });
    await dialog.locator('input[type=file]').setInputFiles({ name: 'estudio-final-ui.pdf', mimeType: 'application/pdf', buffer: bytes });
    await dialog.getByLabel('Notas de entrega').fill('Entrega final desde navegador.');
    await dialog.getByRole('button', { name: 'Entregar y cerrar práctica', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Cerrar práctica', exact: true });
    await confirmation.getByRole('button', { name: 'Entregar y cerrar práctica', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByRole('tab', { name: 'Estudio jurídico', exact: true }).click();
    await page.getByText('Estudio jurídico entregado · práctica cerrada', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'practica-cerrada.png'), fullPage: true });
    await page.goto(base + '/personas/alumnos/cierre-practica');
    await page.locator(`a[href="/personas/alumnos/${context.studentId}"]`).waitFor();
    assert.deepEqual(failures, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'ui-result.json'), JSON.stringify({ studentId: context.studentId, errors, failures, passed: true, completedAt: new Date().toISOString() }, null, 2));
    console.log('UI estudio jurídico: revisión, PDF, refresh, entrega, cierre y listado aprobados; sin errores de consola ni requests.');
  } catch (error) { await page.screenshot({ path: path.join(artifacts, 'ui-failure.png'), fullPage: true }); throw error; }
  finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
