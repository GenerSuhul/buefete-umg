const path = require('node:path');

async function main() {
  const [modulesPath, baseUrl] = process.argv.slice(2);
  const username = process.env.FRONTEND_E2E_USERNAME;
  const password = process.env.FRONTEND_E2E_PASSWORD;
  if (!modulesPath || !baseUrl || !username || !password) throw new Error('Faltan argumentos o credenciales para dashboard-e2e.');

  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];

  for (const viewport of [{ name: 'desktop', width: 1536, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(new URL('/acceso', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.locator('input[autocomplete="email"]').fill(username);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    const dashboardResponse = page.waitForResponse((response) => response.url().toLowerCase().includes('/api/v1/dashboard') && response.status() === 200);
    await page.locator('button[type="submit"]').click();
    const response = await dashboardResponse;
    const dashboard = await response.json();
    await page.locator('.dashboard-grid').waitFor();
    await page.waitForTimeout(500);

    const rendered = await page.evaluate(() => ({
      activeCases: Number(document.querySelector('.primary-stat strong')?.textContent),
      activeStudents: Number(document.querySelector('.student-highlight > strong')?.textContent),
      teamImages: document.querySelectorAll('.student-highlight__avatars .avatar img').length,
      emptyBarsHaveZeroHeight: [...document.querySelectorAll('.bar-chart__item.is-empty .bar-chart__bar')]
        .every((element) => element.getBoundingClientRect().height === 0),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const expectedVisiblePhotos = dashboard.practiceTeam.slice(0, 4).filter((student) => student.photoDocumentId).length;
    const passed = rendered.activeCases === dashboard.activeCases &&
      rendered.activeStudents === dashboard.activeStudents &&
      rendered.teamImages === expectedVisiblePhotos &&
      rendered.emptyBarsHaveZeroHeight &&
      !rendered.horizontalOverflow && errors.length === 0;
    results.push({ viewport: viewport.name, expectedVisiblePhotos, ...rendered, errors, passed });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
