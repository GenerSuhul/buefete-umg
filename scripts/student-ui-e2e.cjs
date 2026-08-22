const path = require('node:path');

async function main() {
  const [modulesPath, baseUrl, screenshotPath] = process.argv.slice(2);
  const username = process.env.FRONTEND_E2E_USERNAME;
  const password = process.env.FRONTEND_E2E_PASSWORD;
  if (!modulesPath || !baseUrl || !screenshotPath || !username || !password) throw new Error('Faltan argumentos o credenciales.');

  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15000);
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', async (response) => {
    if (response.url().includes('/api/v1/auth/login') && response.status() >= 400) {
      consoleErrors.push(`LOGIN_HTTP_${response.status()}: ${await response.text()}`);
    }
  });

  await page.goto(new URL('/acceso', baseUrl).href, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo electrónico').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /ingresar al sistema/i }).click();
  try {
    await page.waitForURL((url) => url.pathname === '/expedientes');
  } catch (error) {
    consoleErrors.push(`LOGIN_UI: ${(await page.locator('body').innerText()).slice(0, 1200)}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();
    throw new Error(JSON.stringify({ consoleErrors }, null, 2), { cause: error });
  }
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Mis casos asignados' }).waitFor();
  await page.locator('.case-list__item').first().waitFor();

  const caseChecks = {
    heading: await page.getByRole('heading', { name: 'Mis casos asignados' }).count() === 1,
    noCreate: await page.getByRole('button', { name: /abrir expediente/i }).count() === 0,
    noGlobalSearch: await page.getByPlaceholder(/buscar cliente/i).count() === 0,
    oneCase: await page.locator('.case-list__item').count() === 1,
  };

  await page.getByRole('link', { name: /alumnos/i }).click();
  await page.waitForLoadState('networkidle');
  await page.locator('a[href^="/personas/alumnos/"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.locator('.profile-layout').waitFor();

  const profileChecks = {
    noEdit: await page.getByRole('button', { name: /editar perfil/i }).count() === 0,
    noAssign: await page.getByRole('button', { name: /asignar caso/i }).count() === 0,
    noStatusChange: await page.getByRole('button', { name: /cambiar estado/i }).count() === 0,
    noRequirementEdit: await page.locator('.requirement-card svg.lucide-pencil').count() === 0,
  };

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();
  if (consoleErrors.length || Object.values(caseChecks).includes(false) || Object.values(profileChecks).includes(false)) {
    throw new Error(JSON.stringify({ caseChecks, profileChecks, consoleErrors }, null, 2));
  }
  console.log(JSON.stringify({ caseChecks, profileChecks, consoleErrors, screenshotPath }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
