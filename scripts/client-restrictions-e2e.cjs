// Isolated integration fixture. Never veto a real person's DPI.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
async function main() {
  const config = {};
  for (const file of ['.env', '.env.platform.local']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const i = line.indexOf('='); config[line.slice(0, i)] = line.slice(i + 1);
  }
  const api = 'http://127.0.0.1:5104/api/v1', web = 'http://127.0.0.1:5180';
  const stamp = Date.now(), codes = [`qa-veto-${stamp}-a`, `qa-veto-${stamp}-b`];
  const password = require('node:crypto').randomBytes(12).toString('hex');
  const dpi = String(stamp), otherDpi = String(stamp + 1), concurrentDpi = String(stamp + 2), reason = `QA veto fixture ${stamp} - nunca una persona real`;
  const out = path.resolve('.artifacts/case-flow', `qa-veto-${stamp}`); fs.mkdirSync(out, { recursive: true });
  const central = config.POSTGRES_DB || config.ConnectionStrings__BufeteDb?.match(/Database=([^;]+)/i)?.[1]; assert.match(central, /^[a-zA-Z0-9_]+$/);
  const pg = ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', central, '-At', '-c'];
  const sql = query => execFileSync('docker', [...pg, query], { encoding: 'utf8' }).trim();
  assert.equal(sql(`SELECT count(*) FROM bufete.client_restrictions WHERE "Dpi" IN ('${dpi}','${otherDpi}')`), '0');
  const created = [], vetoIds = [], steps = [];
  let browser;
  async function req(route, body, token, code, method = 'POST') {
    const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': code, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  const body = (identity = dpi, fullName = 'Persona QA flujo') => ({ fullName, dpi: identity, residenceAddress: 'Dirección QA', assistanceRequested: 'Proceso QA', receptionPlace: 'Sede QA', receptionDate: '2026-10-12', childrenCount: 0 });
  try {
    const root = await req('/auth/login', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password }, null, 'peten'); assert.equal(root.status, 200);
    const legacyId = sql(`SELECT "Id" FROM bufete.clients WHERE "Dpi" IS NOT NULL AND regexp_replace("Dpi", '[ -]', '', 'g') !~ '^[0-9]{13}$' AND "DeletedAtUtc" IS NULL LIMIT 1`);
    if (legacyId) {
      assert.match(legacyId, /^[a-f0-9-]{36}$/);
      const legacy = await req(`/clients/${legacyId}/profile`, null, root.data.accessToken, 'peten', 'GET'); assert.equal(legacy.status, 200); assert.equal(legacy.data.restriction.hasValidIdentity, false);
      steps.push('Ficha histórica con DPI inválido sigue consultable; requiere corrección sin sobrescribir datos');
    }
    const contexts = [];
    for (const code of codes) {
      const email = `${code}@example.test`;
      const tenant = await req('/platform/tenants', { code, name: `Sede ${code}`, administratorName: 'Administrador QA', administratorEmail: email, administratorPassword: password }, root.data.accessToken, 'peten'); assert.equal(tenant.status, 200, JSON.stringify(tenant.data)); created.push(code);
      const login = await req('/auth/login', { email, password }, null, code); assert.equal(login.status, 200); contexts.push({ code, email, token: login.data.accessToken });
    }
    const [a, b] = contexts;
    const { PDFDocument } = require('../frontend/node_modules/pdf-lib');
    const pdf = await PDFDocument.create(); pdf.addPage().drawText('Documento QA flujo'); const bytes = await pdf.save();
    async function upload(contextType, contextId, label) {
      const form = new FormData(); form.append('File', new Blob([bytes], { type: 'application/pdf' }), 'qa-flujo.pdf'); form.append('ContextType', contextType); form.append('ContextId', contextId); form.append('Label', label);
      const response = await fetch(api + '/documents', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'X-Sede-Code': a.code }, body: form });
      const data = await response.json(); assert.equal(response.status, 201, JSON.stringify(data)); return data;
    }
    const clientA = await req('/clients', body(), a.token, a.code), clientB = await req('/clients', body(), b.token, b.code);
    assert.equal(clientA.status, 201, JSON.stringify(clientA.data)); assert.equal(clientB.status, 201);
    const storedDocument = await upload('Client', clientA.data.id, 'DPI QA');
    const signed = await req(`/clients/${clientA.data.id}`, { ...body(), signatureDocumentId: storedDocument.id, concurrencyToken: clientA.data.concurrencyToken }, a.token, a.code, 'PUT'); assert.equal(signed.status, 200);
    const fixtureDb = sql(`SELECT "DatabaseName" FROM bufete.tenants WHERE "Code"='${a.code}'`); assert.match(fixtureDb, /^bufete_t_[a-f0-9]{32}$/);
    // Deliberately model a historical malformed value only inside the disposable QA database.
    execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', fixtureDb, '-c', `UPDATE bufete.clients SET "Dpi"='DPI heredado inválido' WHERE "Id"='${clientA.data.id}';`], { stdio: 'pipe' });
    const historical = await req(`/clients/${clientA.data.id}/profile`, null, a.token, a.code, 'GET'); assert.equal(historical.status, 200); assert.equal(historical.data.restriction.hasValidIdentity, false);
    const corrected = await req(`/clients/${clientA.data.id}`, { ...body(), signatureDocumentId: storedDocument.id, concurrencyToken: signed.data.concurrencyToken }, a.token, a.code, 'PUT'); assert.equal(corrected.status, 200, JSON.stringify(corrected.data)); assert.equal(corrected.data.signatureDocumentId, storedDocument.id);
    steps.push('Recuperación de DPI histórico inválido en fixture aislado conserva la firma y persiste por API');
    const registration = await req('/students/registration', {
      student: { fullName: 'Alumno QA atención', birthDate: '2001-07-16', studentCardNumber: '1690-23-12345', dpi: otherDpi, semester: 10, studyShift: 'Matutina', residenceAddress: 'QA', email: `alumno-${a.email}`, registrationDate: '2026-10-12' },
      enrollment: { modality: 'CivilFamilyCases', initialStatus: 'Submitted', siteName: `Sede ${a.code}` }, access: { password }
    }, a.token, a.code); assert.equal(registration.status, 201, JSON.stringify(registration.data));
    const { student, enrollment } = registration.data;
    for (const requirement of enrollment.requirements) {
      const document = await upload('Enrollment', enrollment.id, requirement.label);
      const updated = await req(`/students/enrollments/${enrollment.id}/requirements/${requirement.id}`, { status: 'Accepted', documentId: document.id, documentIssueDate: '2026-10-12', notes: 'Evidencia real QA' }, a.token, a.code, 'PUT'); assert.equal(updated.status, 200, JSON.stringify(updated.data));
    }
    for (const status of ['Admitted', 'UnderReview', 'Approved']) {
      const updated = await req(`/students/enrollments/${enrollment.id}/status`, { status, resolutionNotes: 'Validación QA' }, a.token, a.code, 'PUT'); assert.equal(updated.status, 200, JSON.stringify(updated.data));
    }
    assert.equal((await req('/clients', body(''), a.token, a.code)).status, 400);
    const catalogs = await req('/catalogs/process-types', null, a.token, a.code, 'GET'); assert.equal(catalogs.status, 200);
    const processType = catalogs.data.find(p => p.requirements.length > 4) || catalogs.data[0]; assert.ok(processType);
    const caseA = await req('/cases', { clientId: clientA.data.id, processTypeId: processType.id, counterparties: [] }, a.token, a.code); assert.equal(caseA.status, 201, JSON.stringify(caseA.data));
    const roles = await req('/roles', null, a.token, a.code, 'GET');
    const secretaryRole = roles.data.find(r => /secretar/i.test(r.name)); assert.ok(secretaryRole);
    const secretaryEmail = `secretaria-${a.email}`;
    const secretary = await req('/users', { username: 'secretaria.qa', email: secretaryEmail, fullName: 'Secretaría QA', password, roleIds: [secretaryRole.id] }, a.token, a.code); assert.equal(secretary.status, 201, JSON.stringify(secretary.data));
    const secretaryLogin = await req('/auth/login', { email: secretaryEmail, password }, null, a.code); assert.equal(secretaryLogin.status, 200);
    const deny = await req('/client-restrictions', { dpi, confirmDpi: dpi, reason }, secretaryLogin.data.accessToken, a.code); assert.equal(deny.status, 403);
    assert.equal((await req('/client-restrictions', { dpi, confirmDpi: otherDpi, reason }, a.token, a.code)).status, 400);
    assert.equal((await req('/client-restrictions', { dpi, confirmDpi: dpi, reason: 'corto' }, a.token, a.code)).status, 400);
    steps.push('Dos sedes aisladas; DPI obligatorio; secretaría no emite veto; identidad y motivo validados');

    // Existing browser regression runner; changes only disposable QA tenant records.
    const { chromium } = require(path.join(process.argv[2], 'playwright'));
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } }); page.setDefaultTimeout(30000);
    const errors = [], networkErrors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 500) networkErrors.push({ status: response.status(), path: new URL(response.url()).pathname }); });
    await page.goto(web + '/acceso'); await page.getByLabel('Código de sede').fill(a.code); await page.getByLabel('Correo electrónico').fill(a.email); await page.getByLabel('Contraseña', { exact: true }).fill(password); await page.getByRole('button', { name: /Ingresar al sistema/ }).click(); await page.waitForURL(url => url.pathname === '/');
    await page.goto(web + '/expedientes'); await page.getByRole('button', { name: /Abrir expediente|Nuevo expediente/ }).first().click();
    const lookup = page.getByRole('combobox', { name: 'Usuario', exact: true }); await lookup.fill(`${dpi.slice(0,4)} ${dpi.slice(4,9)} ${dpi.slice(9)}`);
    const profileLoaded = page.waitForResponse(r => r.url().includes(`/clients/${clientA.data.id}/profile`) && r.status() === 200).then(() => true).catch(() => false);
    await page.getByRole('option', { name: /Persona QA flujo/ }).click();
    await page.getByLabel('Tipo de proceso').click(); await page.getByRole('option', { name: processType.name, exact: true }).click();
    assert.equal(await profileLoaded, true, 'La selección debe cargar la ficha autorizada');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const dimensions = [];
    for (const width of [1366, 900, 360]) {
      await page.setViewportSize({ width, height: 900 });
      const measure = await page.locator('.requirement-preview').evaluate(e => ({ width: e.clientWidth, content: e.scrollWidth, nestedScroll: e.scrollHeight > e.clientHeight, badge: e.querySelector('.badge').clientWidth, badgeContent: e.querySelector('.badge').scrollWidth }));
      assert.ok(measure.content <= measure.width + 1, JSON.stringify(measure)); assert.equal(measure.nestedScroll, false); assert.ok(measure.badgeContent <= measure.badge + 1); dimensions.push({ viewport: width, ...measure });
      await page.screenshot({ path: path.join(out, `checklist-${width}.png`) });
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir expediente', exact: true }).last().click(); await page.waitForURL(url => /^\/expedientes\/[a-f0-9-]+$/.test(url.pathname));
    const uiCaseId = page.url().split('/').pop();
    await page.getByRole('button', { name: 'Asignar alumno', exact: true }).first().click();
    await page.getByRole('combobox', { name: 'Alumno', exact: true }).fill('Alumno QA'); await page.getByRole('option', { name: /Alumno QA atención/ }).click(); await page.getByRole('button', { name: 'Confirmar asignación', exact: true }).click();
    await page.getByText('Alumno QA atención', { exact: true }).first().waitFor(); await page.reload(); await page.getByText('Alumno QA atención', { exact: true }).first().waitFor();
    const assigned = await req(`/cases/${uiCaseId}`, null, a.token, a.code, 'GET'); assert.ok(assigned.data.summary.assignments.some(x => x.studentId === student.id && x.status === 'Active')); assert.ok(assigned.data.timeline.some(x => x.title === 'Alumno asignado'));
    steps.push('Alumno habilitado mediante documentos reales en MinIO; apertura y asignación en navegador; refresh y timeline persistidos');
    await page.goto(web + `/personas/clientes/${clientA.data.id}`);
    await page.getByRole('button', { name: 'Vetar atención', exact: true }).click();
    await page.getByLabel('Repita el DPI para confirmar').fill(dpi); await page.getByLabel('Motivo institucional').fill(reason); await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Confirmar veto permanente' }).click();
    await page.getByText(/Atención bloqueada por veto global/).waitFor(); await page.reload(); await page.getByText(/Atención bloqueada por veto global/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Abrir proceso', exact: true }).isDisabled(), true);
    const check = await req('/client-restrictions/check', { dpi: `${dpi.slice(0,4)} ${dpi.slice(4,9)} ${dpi.slice(9)}` }, b.token, b.code); assert.equal(check.status, 200); assert.equal(check.data.isRestricted, true); vetoIds.push(check.data.reference);
    assert.deepEqual(Object.keys(check.data).sort(), ['hasValidIdentity', 'isRestricted', 'reference']);
    const listA = await req('/client-restrictions', null, a.token, a.code, 'GET'), listB = await req('/client-restrictions', null, b.token, b.code, 'GET'); assert.equal(listA.data.items.length, 1); assert.equal(listB.data.items.length, 0);
    const rootList = await req(`/client-restrictions?dpi=${dpi}`, null, root.data.accessToken, 'peten', 'GET'); assert.equal(rootList.data.items.length, 1);
    await page.goto(web + '/vetos'); await page.getByText(reason, { exact: true }).waitFor(); await page.reload(); await page.getByText(reason, { exact: true }).waitFor(); await page.screenshot({ path: path.join(out, 'vetos.png') });
    await page.goto(web + '/personas/clientes'); await page.getByRole('button', { name: 'Registrar usuario', exact: true }).click();
    await page.getByLabel('Nombre completo', { exact: true }).fill('Persona vetada QA'); await page.getByLabel('DPI', { exact: true }).fill(dpi); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /veto global permanente/ }).waitFor(); assert.equal(await page.getByLabel('Nombre completo', { exact: true }).inputValue(), 'Persona vetada QA');
    await page.goto(web + `/expedientes/${uiCaseId}`); await page.getByRole('alert').filter({ hasText: /Veto global permanente/ }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Asignar alumno', exact: true }).count(), 0);
    steps.push('Navegador: búsqueda por DPI, checklist sin desbordamiento a 1366/900/360, veto por administrador de sede, ficha/listado persisten tras refresh');
    assert.equal((await req('/client-restrictions', { dpi, confirmDpi: dpi, reason }, a.token, a.code)).status, 409);
    assert.equal((await req('/clients', body(dpi, 'Otro nombre QA'), b.token, b.code)).status, 409);
    assert.equal((await req('/clients', body(otherDpi), b.token, b.code)).status, 201);
    assert.equal((await req(`/clients/${clientB.data.id}`, { ...body(otherDpi), concurrencyToken: clientB.data.concurrencyToken }, b.token, b.code, 'PUT')).status, 409);
    assert.equal((await req(`/clients/${clientB.data.id}/attention`, { isActive: true, concurrencyToken: clientB.data.concurrencyToken }, b.token, b.code, 'PUT')).status, 409);
    const procB = (await req('/catalogs/process-types', null, b.token, b.code, 'GET')).data[0];
    assert.equal((await req('/cases', { clientId: clientB.data.id, processTypeId: procB.id, counterparties: [] }, b.token, b.code)).status, 409);
    assert.equal((await req(`/cases/${caseA.data.summary.id}`, { status: 'Active', stage: 'QA', concurrencyToken: caseA.data.summary.concurrencyToken }, a.token, a.code, 'PUT')).status, 409);
    assert.equal((await req('/scan-sessions', { contextType: 'Client', contextId: clientA.data.id, label: 'QA', acquisitionProvider: 'BrowserImport', resolutionDpi: 300, colorMode: 'Color' }, a.token, a.code)).status, 409);
    assert.equal((await req(`/cases/${uiCaseId}/assignments`, { studentId: student.id, isPrimary: true }, a.token, a.code)).status, 409);
    const download = await fetch(`${api}/documents/${storedDocument.id}/content`, { headers: { Authorization: `Bearer ${a.token}`, 'X-Sede-Code': a.code } }); assert.equal(download.status, 200); assert.equal((await PDFDocument.load(await download.arrayBuffer())).getPageCount(), 1);
    assert.equal((await req(`/cases/${caseA.data.summary.id}/close`, { closedAtUtc: new Date().toISOString(), reason: 'Cierre QA tras veto' }, a.token, a.code)).status, 204);
    assert.equal((await req(`/cases/${caseA.data.summary.id}/reopen`, { reason: 'Intento QA de reapertura' }, a.token, a.code)).status, 409);
    const history = await req(`/cases/${caseA.data.summary.id}`, null, a.token, a.code, 'GET'); assert.equal(history.status, 200); assert.equal(history.data.restriction.isRestricted, true); assert.equal(history.data.summary.status, 'Closed');
    assert.equal((await req('/client-restrictions', null, a.token, b.code, 'GET')).status, 401);
    assert.equal(sql(`SELECT count(*) FROM bufete.client_restrictions WHERE "Dpi"='${dpi}' AND "SourceTenantCode"='${a.code}'`), '1');
    assert.equal(sql(`SELECT count(*) FROM bufete.audit_logs WHERE "EntityType"='ClientRestriction' AND "EntityId"='${vetoIds[0]}'`), '1');
    assert.equal(sql(`SELECT count(*) FROM pg_constraint WHERE conname='CK_client_restrictions_dpi'`), '1');
    assert.match(sql(`SELECT indexdef FROM pg_indexes WHERE schemaname='bufete' AND indexname='IX_client_restrictions_Dpi'`), /UNIQUE/);
    const concurrent = await Promise.all(contexts.map(context => req('/client-restrictions', { dpi: concurrentDpi, confirmDpi: concurrentDpi, reason }, context.token, context.code)));
    assert.deepEqual(concurrent.map(x => x.status).sort(), [201, 409]);
    assert.equal((await req('/clients', body(concurrentDpi), b.token, b.code)).status, 409);
    steps.push('API directa: veto transversal, cambio de DPI denegado, mismo nombre distinto DPI permitido, casos/escaneo bloqueados, cierre/historial permitidos, aislamiento y auditoría PostgreSQL');
    assert.deepEqual(errors, []);
    assert.deepEqual(networkErrors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, steps, dimensions, errors, networkErrors }, null, 2)); console.log(JSON.stringify({ passed: true, steps, artifacts: out }));
  } catch (error) {
    const page = browser?.contexts()[0]?.pages()[0]; if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: false, steps, error: error.message }, null, 2)); throw error;
  } finally {
    if (browser) await browser.close();
    // Fixture-only cleanup with validated tenant codes/databases. Permanent production vetoes are never removed.
    const ids = sql(`SELECT "Id" FROM bufete.client_restrictions WHERE "Dpi" IN ('${dpi}','${concurrentDpi}') AND "SourceTenantCode" IN ('${codes[0]}','${codes[1]}')`).split(/\r?\n/).filter(Boolean);
    for (const id of ids) { assert.match(id, /^[a-f0-9-]{36}$/); sql(`DELETE FROM bufete.audit_logs WHERE "EntityType"='ClientRestriction' AND "EntityId"='${id}'; DELETE FROM bufete.client_restrictions WHERE "Id"='${id}' AND "Dpi" IN ('${dpi}','${concurrentDpi}');`); }
    for (const code of created) {
      assert.match(code, /^qa-veto-\d+-[ab]$/);
      const database = sql(`SELECT "DatabaseName" FROM bufete.tenants WHERE "Code"='${code}'`); assert.match(database, /^bufete_t_[a-f0-9]{32}$/);
      execFileSync('docker', ['compose', '--env-file', '.env', '-f', 'compose.yaml', 'run', '--rm', '--no-deps', '--entrypoint', '/bin/sh', 'minio-init', '-c', `mc alias set qa "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm --recursive --force "qa/$MINIO_BUCKET/bufete/tenants/${code}/"`], { stdio: 'pipe' });
      execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'dropdb', '-U', config.POSTGRES_USER, '--force', database]);
      sql(`DELETE FROM bufete.tenants WHERE "Code"='${code}' AND "DatabaseName"='${database}';`);
    }
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
