const path = require('node:path');

async function main() {
  const [modulesPath, baseUrl, outputDirectory] = process.argv.slice(2);
  if (!modulesPath || !baseUrl || !outputDirectory) {
    throw new Error('Uso: node frontend-ui-audit.cjs <node_modules> <base-url> <directorio-capturas>');
  }

  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-software-rasterizer'] });
  const routes = ['/', '/expedientes', '/personas/clientes', '/personas/alumnos', '/documentos', '/actividades', '/reportes'];
  const viewports = [
    { name: 'desktop', width: 1536, height: 900 },
    { name: 'tablet', width: 834, height: 1112 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  const results = [];
  const username = process.env.FRONTEND_E2E_USERNAME;
  const password = process.env.FRONTEND_E2E_PASSWORD;

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    if (username && password) {
      const loginPage = await context.newPage();
      await loginPage.goto(new URL('/acceso', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await loginPage.locator('input[autocomplete="email"]').fill(username);
      await loginPage.locator('input[autocomplete="current-password"]').fill(password);
      await Promise.all([
        loginPage.waitForURL((url) => url.pathname === '/', { timeout: 15000 }),
        loginPage.locator('button[type="submit"]').click(),
      ]);
      await loginPage.close();
    }
    for (const route of routes) {
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      await page.goto(new URL(route, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(900);

      const layout = await page.evaluate(() => {
        const visible = (element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
        };
        const describe = (element) => {
          const tag = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : '';
          const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
          return `${tag}${id}${classes}`;
        };
        const horizontal = [];
        const clipped = [];
        for (const element of document.querySelectorAll('body *')) {
          if (!visible(element)) continue;
          const sidebar = element.closest('.app-sidebar');
          if (sidebar && !sidebar.classList.contains('app-sidebar--open') && matchMedia('(max-width: 1120px)').matches) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)) {
            horizontal.push({ element: describe(element), left: Math.round(rect.left), right: Math.round(rect.right) });
          }
          const parent = element.parentElement;
          if (!parent) continue;
          const parentStyle = getComputedStyle(parent);
          if (!['hidden', 'clip'].includes(parentStyle.overflow) && !['hidden', 'clip'].includes(parentStyle.overflowY)) continue;
          const parentRect = parent.getBoundingClientRect();
          if (rect.height > 0 && (rect.top < parentRect.top - 1 || rect.bottom > parentRect.bottom + 1)) {
            clipped.push({ element: describe(element), parent: describe(parent), bottom: Math.round(rect.bottom), parentBottom: Math.round(parentRect.bottom) });
          }
        }
        return {
          horizontal: horizontal.slice(0, 20),
          clipped: clipped.slice(0, 20),
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });

      const slug = route === '/' ? 'dashboard' : route.slice(1).replaceAll('/', '-');
      const screenshotPath = path.join(outputDirectory, `${viewport.name}-${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({ viewport: viewport.name, route, runtimeErrors, ...layout, screenshotPath });
      await page.close();
    }
    await context.close();
  }

  await browser.close();
  const failures = results.filter((result) => result.runtimeErrors.length || result.documentWidth > result.viewportWidth || result.horizontal.length || result.clipped.length);
  console.log(JSON.stringify({ audited: results.length, failures }, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
