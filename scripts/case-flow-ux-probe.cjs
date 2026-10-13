const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const cfg = Object.fromEntries(fs.readFileSync('.env.platform.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto('http://127.0.0.1:5180/acceso');
    await page.getByLabel('Código de sede').fill('peten'); await page.getByLabel('Correo electrónico').fill(cfg.PlatformAdmin__Email); await page.getByLabel('Contraseña', { exact: true }).fill(cfg.PlatformAdmin__Password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click(); await page.waitForURL(url => url.pathname === '/');
    const options = await page.evaluate(async () => {
      const s = JSON.parse(sessionStorage.getItem('bufete_umg_session'));
      const headers = { Authorization: `Bearer ${s.accessToken}`, 'X-Sede-Code': 'peten' };
      const clients = await (await fetch('http://127.0.0.1:5104/api/v1/clients', { headers })).json();
      const processes = await (await fetch('http://127.0.0.1:5104/api/v1/catalogs/process-types', { headers })).json();
      return { clientId: clients.items[0].id, process: processes.find(p => p.requirements.length > 4) };
    });
    await page.goto(`http://127.0.0.1:5180/expedientes?clientId=${options.clientId}`);
    await page.getByLabel('Tipo de proceso').click(); await page.getByRole('option', { name: options.process.name, exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const result = await page.locator('.requirement-preview').evaluate(e => ({ width:e.clientWidth, scrollWidth:e.scrollWidth, badgeWidth:e.querySelector('.badge').getBoundingClientRect().width, badgeTextWidth:e.querySelector('.badge').scrollWidth, nestedScroll:e.scrollHeight>e.clientHeight }));
    fs.mkdirSync('.artifacts/case-flow', { recursive:true });
    await page.screenshot({ path:`.artifacts/case-flow/${process.argv.includes('--after')?'after':'before'}.png` });
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
