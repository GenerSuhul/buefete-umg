const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const [modulesPath, baseUrl, screenshotPath, width = '1536', height = '900'] = process.argv.slice(2);
  const username = process.env.FRONTEND_E2E_USERNAME;
  const password = process.env.FRONTEND_E2E_PASSWORD;
  if (!modulesPath || !baseUrl || !screenshotPath || !username || !password) {
    throw new Error('Faltan argumentos o credenciales de entorno para el smoke del frontend.');
  }
  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const progressPath = `${screenshotPath}.steps`;
  fs.writeFileSync(progressPath, 'start\n');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--disable-software-rasterizer'] });
  fs.appendFileSync(progressPath, 'browser\n');
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  page.setDefaultTimeout(10000);
  const errors = [];
  let loginStatus = null;
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.url().includes('/api/v1/auth/login')) loginStatus = response.status(); });
  await page.goto(new URL('/acceso', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 15000 });
  fs.appendFileSync(progressPath, 'login-page\n');
  await page.locator('input[autocomplete="email"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('button[type="submit"]').click({ noWaitAfter: true });
  fs.appendFileSync(progressPath, 'clicked\n');
  await page.waitForFunction(() => location.pathname === '/' || Boolean(document.querySelector('.login-error')), null, { timeout: 15000 });
  fs.appendFileSync(progressPath, 'authenticated\n');
  await page.waitForTimeout(1200);
  const favicon = await page.request.get(new URL('/favicon.ico', baseUrl).href);
  const state = await page.evaluate(() => ({
    url: location.href,
    heading: document.querySelector('h1')?.textContent?.trim() ?? null,
    hasSession: Boolean(sessionStorage.getItem('bufete_umg_session')),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.appendFileSync(progressPath, 'screenshot\n');
  await browser.close();
  const result = { ...state, loginStatus, faviconStatus: favicon.status(), errors, screenshotPath };
  console.log(JSON.stringify(result, null, 2));
  if (loginStatus !== 200 || !state.hasSession || new URL(state.url).pathname !== '/' || errors.length || state.horizontalOverflow || favicon.status() !== 200) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
