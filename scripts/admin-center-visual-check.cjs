const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const base = process.argv[3] || 'http://127.0.0.1:5180';
  const phase = process.argv[4] || 'after';
  const configuration = Object.fromEntries(fs.readFileSync('.env.platform.local', 'utf8').split(/\r?\n/)
    .filter(line => line.includes('=') && !line.startsWith('#')).map(line => {
      const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)];
    }));
  const artifacts = path.resolve('.artifacts/admin-center', phase);
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${base}/acceso`);
    await page.getByLabel('Código de sede').fill('peten');
    await page.getByLabel('Correo electrónico').fill(configuration.PlatformAdmin__Email);
    await page.getByLabel('Contraseña', { exact: true }).fill(configuration.PlatformAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/', { timeout: 60000 });
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      for (const [name, route] of [['dashboard', '/'], ['sedes', '/sedes'], ['usuarios', '/usuarios'], ['clientes', '/personas/clientes']]) {
        await page.goto(`${base}${route}`);
        await page.locator('h1').waitFor();
        if (name === 'sedes') await page.locator('.tenant-row').first().waitFor();
        if (name === 'clientes') await page.locator('.directory-table__head').waitFor();
        if (name === 'usuarios') await page.locator('.user-directory-list').waitFor();
        if (name === 'dashboard') await page.locator('.primary-stat strong').waitFor();
        await page.screenshot({ path: path.join(artifacts, `${name}-${width}.png`), fullPage: true });
        const metrics = await page.evaluate(() => ({
          width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth,
          heading: getComputedStyle(document.querySelector('h1')).fontSize,
          primary: getComputedStyle(document.documentElement).getPropertyValue('--umg-800').trim(),
          buttons: [...document.querySelectorAll('.tenant-row .button')].map(button => button.textContent),
          fields: [...document.querySelectorAll('.tenant-form input')].map(input => ({ width: input.clientWidth, height: input.clientHeight })),
          font: getComputedStyle(document.querySelector('.app-viewport')).fontFamily,
          sidebar: document.querySelector('.app-sidebar').getBoundingClientRect().width,
          topbar: document.querySelector('.topbar').getBoundingClientRect().height,
          icons: [...document.querySelectorAll('.sidebar-nav svg')].filter(icon => icon.getBoundingClientRect().width > 0)
            .map(icon => ({ width: icon.getBoundingClientRect().width, height: icon.getBoundingClientRect().height })),
          kpiFits: [...document.querySelectorAll('.kpi-card > *')].every(child => {
            const box = child.getBoundingClientRect(), card = child.parentElement.getBoundingClientRect();
            return box.top >= card.top && box.bottom <= card.bottom;
          }),
          table: document.querySelector('.directory-table__head') ? {
            display: getComputedStyle(document.querySelector('.directory-table__head')).display,
            columns: getComputedStyle(document.querySelector('.directory-table__head')).gridTemplateColumns,
          } : null,
        }));
        assert.ok(metrics.scrollWidth <= metrics.width, `${name} overflows at ${width}`);
        if (phase === 'after') {
          assert.equal(metrics.heading, '28px');
          assert.ok(metrics.font.startsWith('"Segoe UI"'));
          assert.equal(metrics.topbar, 64);
          assert.ok(metrics.kpiFits, `KPI content clipped at ${width}`);
          for (const icon of metrics.icons) { assert.equal(icon.width, 20); assert.equal(icon.height, 20); }
          if (width >= 1366) {
            assert.equal(metrics.sidebar, 260);
            if (metrics.table) assert.equal(metrics.table.display, 'grid');
          }
          for (const field of metrics.fields) { assert.ok(field.width > 100); assert.ok(field.height >= 38 && field.height <= 42); }
        }
        assert.equal(metrics.primary, '#0c365f');
        if (name === 'sedes') assert.deepEqual(metrics.buttons.slice(0, 3), ['Guardar nombre', 'Suspender', 'Entrar a la sede']);
        results.push({ name, viewport: `${width}x${height}`, ...metrics });
      }
      if (phase === 'after' && width >= 1366) {
        const collapse = page.getByRole('button', { name: 'Contraer navegación', exact: true });
        await collapse.focus();
        assert.equal(await collapse.evaluate(button => getComputedStyle(button).outlineStyle), 'solid');
        await collapse.press('Enter');
        assert.equal(await page.locator('.app-sidebar').evaluate(sidebar => sidebar.getBoundingClientRect().width), 68);
        const sedeLink = page.locator('[data-module="platform"] a[href="/sedes"]');
        assert.equal(await sedeLink.getAttribute('title'), 'Bufetes y sedes');
        await sedeLink.click();
        await page.waitForURL(url => url.pathname === '/sedes');
        await page.locator('.tenant-row').first().waitFor();
        await page.screenshot({ path: path.join(artifacts, `collapsed-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Expandir navegación', exact: true }).press('Enter');
        assert.equal(await page.locator('.app-sidebar').evaluate(sidebar => sidebar.getBoundingClientRect().width), 260);
      }
    }
    if (phase === 'after') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base}/sedes`);
      await page.locator('.tenant-form .button').waitFor();
      await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
      await page.locator('[data-module="platform"] a[href="/sedes"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('nav a[href="/vetos"]').count(), 1);
      assert.equal(await page.locator('.sidebar-seat-context strong').textContent(), 'Petén');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(artifacts, 'sidebar-mobile-390.png'), fullPage: true });
      await page.getByRole('button', { name: 'Cerrar navegación', exact: true }).first().click();
      await page.goto(`${base}/sedes`);
      await page.locator('.tenant-form .button').waitFor();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.tenant-form .button').evaluate(button => getComputedStyle(button).transitionDuration), '0s');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ phase, checks: results.length, errors, artifacts }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
