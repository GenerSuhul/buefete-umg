const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const base = process.argv[3] || 'http://127.0.0.1:5180';
  const configuration = {};
  for (const file of ['.env', '.env.platform.local']) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const separator = line.indexOf('=');
      configuration[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
  const code = `qa-ui-${Date.now()}`;
  const email = `${code}@example.test`;
  const password = require('node:crypto').randomBytes(12).toString('hex');
  const artifacts = path.resolve('.artifacts/tenancy-ui', code);
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const steps = [];
  let tenantCreated = false;
  async function login(userEmail, userPassword, sede) {
    await page.goto(`${base}/acceso`);
    await page.getByLabel('Código de sede').fill(sede);
    await page.getByLabel('Correo electrónico').fill(userEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill(userPassword);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/', { timeout: 60000 });
  }
  async function resetSession() { await page.context().clearCookies(); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); }
  try {
    await login(configuration.PlatformAdmin__Email, configuration.PlatformAdmin__Password, 'peten');
    steps.push('Superusuario: inicio de sesión nativo');
    await page.goto(`${base}/sedes`);
    await page.getByRole('heading', { name: 'Bufetes y sedes' }).waitFor();
    await page.locator('[data-module="platform"] a[href="/sedes"]').waitFor();
    if (await page.locator('nav a[href="/vetos"]').count() !== 1) throw new Error('Vetos globales duplicados o ausentes.');
    await page.getByText('Código: peten', { exact: false }).waitFor();
    await page.getByLabel('Nombre de la sede', { exact: true }).fill('Sede QA navegador');
    await page.getByLabel('Código de acceso', { exact: true }).fill(code);
    await page.getByLabel('Nombre del administrador', { exact: true }).fill('Administrador QA navegador');
    await page.getByLabel('Correo del administrador', { exact: true }).fill(email);
    await page.getByLabel('Contraseña inicial', { exact: true }).fill(password);
    const creation = page.waitForResponse(response => response.url().endsWith('/platform/tenants') && response.request().method() === 'POST', { timeout: 120000 });
    await page.getByRole('button', { name: 'Crear sede y administrador' }).click();
    const response = await creation;
    if (response.status() !== 200) throw new Error(`Creación de sede: HTTP ${response.status()}`);
    tenantCreated = true;
    let row = page.locator('.tenant-row').filter({ hasText: code });
    await row.getByRole('button', { name: 'Entrar a la sede' }).waitFor();
    await page.reload();
    row = page.locator('.tenant-row').filter({ hasText: code });
    await row.getByLabel(`Nombre de ${code}`).fill('Sede QA nombre actualizado');
    await row.getByRole('button', { name: 'Guardar nombre' }).click();
    await row.getByText('Sede QA nombre actualizado', { exact: true }).waitFor();
    await page.reload();
    await page.locator('.tenant-row').filter({ hasText: code }).getByText('Sede QA nombre actualizado', { exact: true }).waitFor();
    steps.push('Crear sede y administrador, editar nombre, refrescar y recuperar');
    await page.screenshot({ path: path.join(artifacts, 'sedes.png'), fullPage: true });
    await page.locator('.tenant-row').filter({ hasText: code }).getByRole('button', { name: 'Entrar a la sede' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Entrar a la sede' }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.locator('.sidebar-seat-context strong').getByText('Sede QA nombre actualizado', { exact: true }).waitFor();
    steps.push('Superusuario: cambio de contexto a nueva sede');
    await resetSession();
    await login(email, password, code);
    await page.goto(`${base}/usuarios`);
    await page.getByRole('button', { name: 'Crear personal' }).waitFor();
    if (await page.locator('[data-module="platform"]').count()) throw new Error('Administrador local ve el módulo global.');
    await page.locator('[data-module="administration"] a[href="/vetos"]').waitFor();
    await page.getByRole('button', { name: 'Crear personal' }).click();
    const userDialog = page.getByRole('dialog');
    await userDialog.getByLabel('Nombre completo', { exact: true }).fill('Secretaría QA navegador');
    await userDialog.getByLabel('Correo', { exact: true }).fill(`secretaria-${email}`);
    await userDialog.getByLabel('Contraseña temporal', { exact: true }).fill(password);
    await userDialog.getByRole('listbox').selectOption({ label: 'Secretaria' });
    await userDialog.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await page.getByText('Secretaría QA navegador', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Secretaría QA navegador', { exact: true }).waitFor();
    steps.push('Administrador local: crear secretaría y comprobar persistencia tras refrescar');
    await page.screenshot({ path: path.join(artifacts, 'administrador-local.png'), fullPage: true });
    await page.goto(`${base}/sedes`);
    await page.getByText('La administración de sedes requiere una cuenta de superusuario.', { exact: true }).waitFor();
    steps.push('Administrador local: acceso a cuentas y rechazo de módulo global');
    await resetSession();
    await login(`secretaria-${email}`, password, code);
    if (await page.locator('nav a[href="/vetos"], [data-module="platform"]').count()) throw new Error('Secretaría ve controles restringidos.');
    steps.push('Secretaría: navegación sin administración global ni vetos');
    await resetSession();
    await login(configuration.PlatformAdmin__Email, configuration.PlatformAdmin__Password, 'peten');
    await page.goto(`${base}/sedes`);
    await page.getByRole('heading', { name: 'Bufetes y sedes' }).waitFor();
    if (errors.length) throw new Error(`Errores de ejecución: ${errors.join('; ')}`);
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed: true, steps, pageErrors: errors }, null, 2));
    console.log(JSON.stringify({ passed: true, steps, artifacts }));
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed: false, steps, error: error.message, pageErrors: errors }, null, 2));
    throw error;
  } finally {
    await browser.close();
    // Remove only the disposable seat created by this run; never existing business data.
    if (tenantCreated && /^qa-ui-\d+$/.test(code)) {
      const connection = configuration.ConnectionStrings__BufeteDb || '';
      const central = configuration.POSTGRES_DB || connection.match(/Database=([^;]+)/i)?.[1];
      if (!central || !/^[a-zA-Z0-9_]+$/.test(central)) throw new Error('Base central no resuelta para limpieza QA.');
      const args = ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', configuration.POSTGRES_USER, '-d', central, '-At', '-c'];
      const database = execFileSync('docker', [...args, `SELECT "DatabaseName" FROM bufete.tenants WHERE "Code" = '${code}';`], { encoding: 'utf8' }).trim();
      if (!/^bufete_t_[a-f0-9]{32}$/.test(database)) throw new Error('Base QA no validada.');
      execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'dropdb', '-U', configuration.POSTGRES_USER, '--force', database]);
      execFileSync('docker', [...args, `DELETE FROM bufete.tenants WHERE "Code" = '${code}' AND "DatabaseName" = '${database}';`]);
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
