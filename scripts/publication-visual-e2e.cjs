const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, scryptSync } = require('node:crypto');

async function main() {
  const postgres = require('../frontend/node_modules/postgres');
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const base = process.argv[3] || 'https://bufete-popular-umg.vercel.app';
  const configuration = Object.fromEntries(fs.readFileSync('frontend/.env.demo.local', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
  }));
  const sql = postgres(configuration.DATABASE_URL, { ssl: 'require', max: 1 });
  const tenantId = randomUUID(), userId = randomUUID(), rootId = '6dcbdcf0-2b1c-40ec-a956-8769abb38e68';
  const code = `qa-publicacion-${Date.now()}`, email = `${code}@example.test`, password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const user = { id: userId, username: code, email, fullName: 'QA Publicación', roles: ['Secretaria'], isActive: true, isDeleted: false, participationStartDate: null, participationEndDate: null, photoDocumentId: null, accessStatus: 'Active' };
  const state = { version: 1, users: [user, { ...user, id: rootId, username: 'licenciado.demo', email: 'qa-root@example.test', fullName: 'Licenciado Demo', roles: ['AdministradorGeneral'] }], passwords: { [userId]: `${salt}:${scryptSync(password, salt, 32).toString('hex')}` }, clients: [], students: [], cases: [], processes: [], studentDefinitions: [], documents: [], scans: [], activities: [], reports: [], deleted: [], audit: [] };
  const artifacts = path.resolve('.artifacts/publication', code);
  fs.mkdirSync(artifacts, { recursive: true });
  let browser;
  const errors = [], badResponses = [];
  try {
    await sql`INSERT INTO demo_tenants(id,code,name,state) VALUES (${tenantId},${code},'QA Publicación',${sql.json(state)})`;
    const health = await fetch(`${base}/api/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'getPlatformHealth', args: [] }) });
    assert.equal(health.status, 200, await health.text());
    // Newly created fixtures may reach an already warm instance; existing production rows were migrated on startup.
    const [production] = await sql`SELECT count(*)::int AS legacy FROM demo_tenants WHERE id<>${tenantId} AND state @> ${sql.json({ users: [{ id: rootId, fullName: 'Licenciado Demo' }] })}::jsonb`;
    assert.equal(production.legacy, 0, 'Existing default root names must be migrated');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() }); });
    await page.goto(`${base}/acceso`);
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
    await page.waitForURL(url => url.pathname === '/', { timeout: 60000 });
    await page.getByRole('heading', { name: /Hola, QA/ }).waitFor();
    assert.equal(await page.getByText('Gestión institucional', { exact: true }).count(), 0);
    assert.equal(await page.locator('.demo-banner').count(), 0);
    const icons = await page.locator('.sidebar-nav svg.fui-Icon').count();
    assert.ok(icons >= 5, `Expected Fluent sidebar icons, received ${icons}`);
    assert.equal(await page.getByRole('link', { name: /Lista negra global|Bufetes y sedes/ }).count(), 0, 'Secretariat must not receive platform navigation');
    await page.evaluate(() => {
      const session = JSON.parse(sessionStorage.getItem('bufete_umg_session'));
      session.user.fullName = 'Nombre anterior';
      sessionStorage.setItem('bufete_umg_session', JSON.stringify(session));
    });
    await page.reload();
    await page.getByRole('heading', { name: /Hola, QA/ }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'publicacion-verificada.png'), fullPage: true });
    const cachedName = await page.evaluate(() => JSON.parse(sessionStorage.getItem('bufete_umg_session')).user.fullName);
    assert.equal(cachedName, user.fullName);
    // Seed platform scope only for this disposable QA session, then verify the server response drives navigation.
    await sql`UPDATE demo_sessions SET platform_admin=true WHERE tenant_id=${tenantId} AND user_id=${userId}`;
    await page.reload();
    await page.getByRole('link', { name: /Bufetes y sedes/ }).waitFor();
    await page.locator('.app-viewport.admin-center').waitFor();
    assert.equal(await page.getByRole('link', { name: /Lista negra global/ }).count(), 0);
    const topbarHeight = await page.locator('.topbar').evaluate(element => element.getBoundingClientRect().height);
    assert.equal(topbarHeight, 64);
    await page.screenshot({ path: path.join(artifacts, 'administracion-publicada.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(badResponses, []);
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ base, icons, profileRefresh: true, platformScope: true, topbarHeight, existingLegacyNames: production.legacy, errors, badResponses }, null, 2));
    console.log(JSON.stringify({ artifacts, icons, profileRefresh: true, platformScope: true, topbarHeight, existingLegacyNames: production.legacy, errors, badResponses }));
  } finally {
    if (browser) await browser.close();
    await sql.begin(async transaction => {
      const rows = await transaction`SELECT id FROM demo_tenants WHERE id=${tenantId} AND code=${code} FOR UPDATE`;
      if (rows.length) {
        await transaction`DELETE FROM demo_sessions WHERE tenant_id=${tenantId}`;
        await transaction`DELETE FROM demo_tenants WHERE id=${tenantId} AND code=${code}`;
      }
    });
    await sql.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
