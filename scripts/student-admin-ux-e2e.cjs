const path = require('node:path');

async function main() {
  const [modulesPath, baseUrl, screenshotPath] = process.argv.slice(2);
  const username = process.env.FRONTEND_E2E_USERNAME;
  const password = process.env.FRONTEND_E2E_PASSWORD;
  if (!modulesPath || !baseUrl || !screenshotPath || !username || !password) throw new Error('Faltan argumentos o credenciales.');

  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/acceso', baseUrl).href);
  await page.getByLabel('Correo electrónico').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /ingresar al sistema/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto(new URL('/personas/alumnos', baseUrl).href);
  await page.getByRole('heading', { name: 'Alumnos' }).waitFor();
  await page.locator('.directory-row').first().waitFor();
  const pendingRow = page.locator('.directory-row').filter({ hasText: 'Acceso pendiente' }).first();
  const activeCount = await page.getByText('Acceso activo', { exact: true }).count();
  const pendingCount = await page.getByText('Acceso pendiente', { exact: true }).count();
  if (!pendingCount || !activeCount) throw new Error(`Estados de acceso incompletos: activos=${activeCount}, pendientes=${pendingCount}`);

  await pendingRow.click();
  await page.locator('.profile-layout').waitFor();
  if (await page.getByRole('button', { name: /activar acceso/i }).count() !== 1) throw new Error('El alumno pendiente no ofrece Activar acceso.');
  await page.getByRole('button', { name: /editar perfil/i }).click();
  const editDialog = page.getByRole('dialog');
  if ((await editDialog.innerText()).includes('Fotografía pendiente')) throw new Error('La edición todavía mezcla el acceso con la fotografía.');
  await editDialog.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: /activar acceso/i }).click();
  const accessDialog = page.getByRole('dialog');
  await accessDialog.getByLabel('Nombre de usuario').waitFor();
  if (!(await accessDialog.innerText()).includes('permisos estrictamente de consulta')) throw new Error('El modal no explica el alcance del acceso.');
  await accessDialog.getByRole('button', { name: 'Cerrar' }).click();

  await page.goto(new URL('/personas/alumnos', baseUrl).href);
  await page.getByRole('button', { name: /inscribir alumno/i }).click();
  const registrationDialog = page.getByRole('dialog');
  for (const heading of ['1. Identidad y contacto', '2. Práctica supervisada', '3. Acceso al sistema']) {
    if (await registrationDialog.getByRole('heading', { name: heading }).count() !== 1) throw new Error(`Falta la sección ${heading}.`);
  }
  if (await registrationDialog.getByRole('button', { name: /crear alumno y acceso/i }).count() !== 1) throw new Error('Falta la acción integral de alta.');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await registrationDialog.getByRole('button', { name: 'Cerrar' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /inscribir alumno/i }).click();
  await page.getByRole('dialog').getByRole('heading', { name: '1. Identidad y contacto' }).waitFor();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hasHorizontalOverflow) throw new Error('El formulario se desborda horizontalmente en móvil.');
  const parsedPath = path.parse(screenshotPath);
  const mobileScreenshotPath = path.join(parsedPath.dir, `${parsedPath.name}-mobile${parsedPath.ext}`);
  await page.screenshot({ path: mobileScreenshotPath, fullPage: false });
  await browser.close();
  if (consoleErrors.length) throw new Error(JSON.stringify({ consoleErrors }, null, 2));
  console.log(JSON.stringify({ activeCount, pendingCount, sections: 3, hasHorizontalOverflow, consoleErrors, screenshotPath, mobileScreenshotPath }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
