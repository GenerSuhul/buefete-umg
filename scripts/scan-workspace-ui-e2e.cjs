const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
async function main() {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const { PDFDocument } = require('../frontend/node_modules/pdf-lib');
  const config = {};
  for (const file of ['.env', '.env.platform.local']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const i = line.indexOf('='); config[line.slice(0, i)] = line.slice(i + 1);
  }
  const code = `qa-scan-${Date.now()}`, email = `${code}@example.test`, password = require('node:crypto').randomBytes(12).toString('hex');
  const api = 'http://127.0.0.1:5104/api/v1', base = 'http://127.0.0.1:5180';
  const artifacts = path.resolve('.artifacts/scanner', code); fs.mkdirSync(artifacts, { recursive: true });
  let token, created = false, browser;
  async function req(route, body, method = 'POST', auth = token, sede = code) {
    const r = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': sede, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await r.text();
    return { status: r.status, data: text ? JSON.parse(text) : null };
  }
  const steps = [];
  try {
    const root = await req('/auth/login', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password }, 'POST', null, 'peten'); assert.equal(root.status, 200);
    const tenant = await req('/platform/tenants', { code, name: 'Sede QA escaneo', administratorName: 'Admin QA', administratorEmail: email, administratorPassword: password }, 'POST', root.data.accessToken, 'peten'); assert.equal(tenant.status, 200); created = true;
    const login = await req('/auth/login', { email, password }, 'POST', null); assert.equal(login.status, 200); token = login.data.accessToken;
    const registration = await req('/students/registration', {
      student: { fullName: 'Alumno QA escaneo', birthDate: '2001-07-16', studentCardNumber: '1690-23-12345', dpi: '3307445961712', semester: 10, studyShift: 'Matutina', residenceAddress: 'QA', email: `alumno-${email}`, registrationDate: '2026-10-12' },
      enrollment: { modality: 'CivilFamilyCases', initialStatus: 'Submitted', siteName: 'Sede QA escaneo' }, access: { password }
    });
    assert.equal(registration.status, 201, JSON.stringify(registration.data));
    const { student, enrollment } = registration.data;
    const label = enrollment.requirements[0].label;
    const scan = await req('/scan-sessions', { contextType: 'Enrollment', contextId: enrollment.id, label, acquisitionProvider: 'BrowserImport', resolutionDpi: 300, colorMode: 'Color' }); assert.equal(scan.status, 201);
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 3; i++) pdf.addPage([300 + i * 20, 400]).drawText(`Pagina QA ${i + 1}`, { x: 30, y: 350 });
    const form = new FormData(); form.append('File', new Blob([await pdf.save()], { type: 'application/pdf' }), 'captura-qa.pdf'); form.append('ClientPageId', require('node:crypto').randomUUID()); form.append('Source', 'Scanner');
    const upload = await fetch(`${api}/scan-sessions/${scan.data.id}/pages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Sede-Code': code }, body: form }); assert.equal(upload.status, 200);
    let session = await upload.json(); assert.equal(session.pageCount, 3);
    const contentPath = `/scan-sessions/${session.id}/pages/${session.pages[0].id}/content`;
    const original = await fetch(api + contentPath, { headers: { Authorization: `Bearer ${token}`, 'X-Sede-Code': code } }); assert.equal(original.status, 200);
    const wrong = await fetch(api + contentPath.replace('/pages/', '/screens/'), { headers: { Authorization: `Bearer ${token}`, 'X-Sede-Code': code } }); assert.equal(wrong.status, 404);
    steps.push('Reproducción: pages devuelve PDF 200; screens devuelve 404 para la misma página real');
    if (process.argv.includes('--probe')) { console.log(JSON.stringify({ passed: true, steps })); return; }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } }); page.setDefaultTimeout(30000);
    const errors = [], badResponses = []; page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().includes('/scan-sessions/') && r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
    await page.goto(base + '/acceso'); await page.getByLabel('Código de sede').fill(code); await page.getByLabel('Correo electrónico').fill(email); await page.getByLabel('Contraseña', { exact: true }).fill(password); await page.getByRole('button', { name: /Ingresar al sistema/ }).click(); await page.waitForURL(url => url.pathname === '/');
    async function openDraft() {
      await page.goto(base + `/personas/alumnos/${student.id}`);
      await page.getByRole('tab', { name: /^Papelería/ }).click();
      await page.getByRole('button', { name: 'Adjuntar', exact: true }).first().click();
      await page.getByRole('button', { name: /Escanear documento/ }).click();
      await page.getByRole('button').filter({ hasText: label }).last().click();
      await page.locator('.scan-canvas iframe').waitFor();
    }
    await openDraft();
    const viewer = page.locator('.scan-canvas iframe');
    assert.match(await viewer.getAttribute('src'), /^blob:/);
    const renderedBytes = await viewer.evaluate(async iframe => Array.from(new Uint8Array(await (await fetch(iframe.src)).arrayBuffer())));
    assert.equal((await PDFDocument.load(Uint8Array.from(renderedBytes))).getPageCount(), 1);
    steps.push('Navegador: borrador recuperado y página PDF individual visible sin generar PDF final');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/rotation') && r.status() === 200), page.getByRole('button', { name: 'Girar', exact: true }).click()]);
    await page.getByRole('button', { name: 'Guardar y salir', exact: true }).click();
    await openDraft();
    session = (await req(`/scan-sessions/${session.id}`, null, 'GET')).data;
    assert.equal(session.pages[0].rotationDegrees, 90);
    const ids = session.pages.map(p => p.id);
    assert.equal((await req(`/scan-sessions/${session.id}/pages/order`, { pageIds: [ids[2], ids[0], ids[1]] }, 'PUT')).status, 200);
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar y salir', exact: true }).click();
    await openDraft();
    session = (await req(`/scan-sessions/${session.id}`, null, 'GET')).data; assert.equal(session.pageCount, 2);
    steps.push('Girar/quitar desde UI, ordenar por contrato real, guardar/salir/reabrir y persistencia comprobada');
    await page.getByRole('button', { name: 'Generar vista previa', exact: true }).click();
    await page.getByTitle('Vista previa del PDF final', { exact: true }).waitFor();
    assert.equal(await page.locator('.scan-canvas').getByTitle('Vista previa del PDF final').count(), 1);
    await page.screenshot({ path: path.join(artifacts, 'pdf-final.png'), fullPage: true });
    await page.getByRole('button', { name: 'Confirmar PDF', exact: true }).click();
    await page.getByRole('dialog', { name: /^Digitalización/ }).waitFor({ state: 'hidden' });
    await page.reload(); await page.getByRole('tab', { name: /^Papelería/ }).click();
    const profile = (await req(`/students/${student.id}/profile`, null, 'GET')).data;
    const requirement = profile.enrollments[0].requirements.find(r => r.label === label); assert.ok(requirement.documentId);
    const download = await fetch(`${api}/documents/${requirement.documentId}/content`, { headers: { Authorization: `Bearer ${token}`, 'X-Sede-Code': code } }); assert.equal(download.status, 200);
    const finalPdf = await PDFDocument.load(await download.arrayBuffer());
    assert.equal(finalPdf.getPageCount(), 2);
    assert.deepEqual(finalPdf.getPages().map(p => p.getWidth()), [340, 320]);
    assert.equal((await req(`/scan-sessions/${session.id}`, null, 'GET', token, 'peten')).status, 401);
    const central = config.POSTGRES_DB || config.ConnectionStrings__BufeteDb?.match(/Database=([^;]+)/i)?.[1]; assert.match(central, /^[a-zA-Z0-9_]+$/);
    const dbArgs = ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-At', '-d'];
    const database = execFileSync('docker', [...dbArgs, central, '-c', `SELECT "DatabaseName" FROM bufete.tenants WHERE "Code"='${code}';`], { encoding: 'utf8' }).trim(); assert.match(database, /^bufete_t_[a-f0-9]{32}$/);
    const stored = execFileSync('docker', [...dbArgs, database, '-c', `SELECT "Status" FROM bufete.scan_sessions WHERE "Id"='${session.id}';`], { encoding: 'utf8' }).trim();
    assert.equal(stored, 'Completed');
    steps.push('PDF final central, confirmación, asociación al requisito, refresco y descarga real desde MinIO');
    assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed: true, steps, errors, badResponses }, null, 2)); console.log(JSON.stringify({ passed: true, steps, artifacts }));
  } catch (error) {
    if (browser) {
      const current = browser.contexts()[0]?.pages()[0];
      if (current) {
        await current.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
        fs.writeFileSync(path.join(artifacts, 'failure.html'), await current.content().catch(() => ''));
      }
    }
    fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed: false, steps, error: error.message }, null, 2));
    throw error;
  } finally {
    if (browser) await browser.close();
    if (created && /^qa-scan-\d+$/.test(code)) {
      const central = config.POSTGRES_DB || config.ConnectionStrings__BufeteDb?.match(/Database=([^;]+)/i)?.[1]; assert.match(central, /^[a-zA-Z0-9_]+$/);
      const args = ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', central, '-At', '-c'];
      const database = execFileSync('docker', [...args, `SELECT "DatabaseName" FROM bufete.tenants WHERE "Code"='${code}';`], { encoding: 'utf8' }).trim(); assert.match(database, /^bufete_t_[a-f0-9]{32}$/);
      execFileSync('docker', ['compose', '--env-file', '.env', '-f', 'compose.yaml', 'run', '--rm', '--no-deps', '--entrypoint', '/bin/sh', 'minio-init', '-c', `mc alias set qa "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm --recursive --force "qa/$MINIO_BUCKET/bufete/tenants/${code}/"`], { stdio: 'pipe' });
      execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'dropdb', '-U', config.POSTGRES_USER, '--force', database]);
      execFileSync('docker', [...args, `DELETE FROM bufete.tenants WHERE "Code"='${code}' AND "DatabaseName"='${database}';`]);
    }
  }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
