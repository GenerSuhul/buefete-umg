const path = require('node:path');

async function main() {
  const [modulesPath, url, screenshotPath, width = '1600', height = '1200', clickSelector] = process.argv.slice(2);
  if (!modulesPath || !url || !screenshotPath) {
    throw new Error('Uso: node visual-check.cjs <node_modules> <url> <captura> [ancho] [alto]');
  }

  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (clickSelector) {
    await page.locator(clickSelector).click();
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  const title = await page.title();
  const heading = await page.locator('h1').first().textContent();
  await browser.close();
  console.log(JSON.stringify({ title, heading, errors, dimensions, screenshotPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
