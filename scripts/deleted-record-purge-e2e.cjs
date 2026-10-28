// Run only against an isolated QA central database and isolated storage prefix.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

async function main() {
  const metadataPath = process.argv[2];
  if (!metadataPath) throw new Error('Provide isolated QA environment.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert.match(metadata.databaseName, /^bufete_changes_qa_[a-f0-9]{12}$/);
  assert.match(metadata.storagePrefix, /^bufete-changes-qa\/[a-f0-9]{12}$/);
  const config = {};
  for (const file of ['.env', '.env.platform.local']) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue;
      const i = line.indexOf('='); config[line.slice(0, i)] = line.slice(i + 1);
    }
  }
  const api = `http://127.0.0.1:${metadata.port}/api/v1`;
  const code = `qa-purge-${Date.now()}`;
  const password = require('node:crypto').randomBytes(14).toString('hex');
  const email = `${code}@example.test`;
  const db = query => execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', metadata.databaseName, '-At', '-c', query], { encoding: 'utf8' }).trim();
  async function req(route, body, token, tenant = code, method = 'POST') {
    const r = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', 'X-Sede-Code': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await r.text(); return { status: r.status, data: raw ? JSON.parse(raw) : null };
  }
  const platform = await req('/auth/login', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password }, undefined, 'peten');
  assert.equal(platform.status, 200, JSON.stringify(platform.data));
  const platformToken = platform.data.accessToken;
  assert.equal((await req('/platform/tenants', { code, name: 'Purga QA', administratorName: 'Administrador QA', administratorEmail: email, administratorPassword: password }, platformToken, 'peten')).status, 200);
  const user = await req('/auth/login', { email, password }); assert.equal(user.status, 200);
  const token = user.data.accessToken;
  const switched = await req(`/platform/tenants/${code}/session`, undefined, platformToken, 'peten');
  assert.equal(switched.status, 200, JSON.stringify(switched.data));
  const tenantPlatformToken = switched.data.accessToken;
  const client = await req('/clients', { fullName: 'Persona purga QA', dpi: String(Date.now()), residenceAddress: 'QA', assistanceRequested: 'QA', receptionPlace: 'QA', receptionDate: '2026-10-12', childrenCount: 0 }, token);
  assert.equal(client.status, 201, JSON.stringify(client.data));
  const { PDFDocument } = require('../frontend/node_modules/pdf-lib');
  const pdf = await PDFDocument.create(); pdf.addPage().drawText('Archivo de purga QA');
  const form = new FormData(); form.append('File', new Blob([await pdf.save()], { type: 'application/pdf' }), 'purga-qa.pdf'); form.append('ContextType', 'Client'); form.append('ContextId', client.data.id); form.append('Label', 'Documento QA');
  const upload = await fetch(api + '/documents', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Sede-Code': code }, body: form });
  const document = await upload.json(); assert.equal(upload.status, 201, JSON.stringify(document));
  const types = await req('/catalogs/process-types', undefined, token, code, 'GET');
  assert.equal(types.status, 200); assert.ok(types.data.length);
  const legalCase = await req('/cases', { clientId: client.data.id, processTypeId: types.data[0].id, counterparties: [] }, token);
  assert.equal(legalCase.status, 201, JSON.stringify(legalCase.data));
  const caseId = legalCase.data.summary.id;
  const caseForm = new FormData(); caseForm.append('File', new Blob([await pdf.save()], { type: 'application/pdf' }), 'expediente-qa.pdf'); caseForm.append('ContextType', 'LegalCase'); caseForm.append('ContextId', caseId); caseForm.append('Label', 'Documento expediente QA');
  const caseUpload = await fetch(api + '/documents', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Sede-Code': code }, body: caseForm });
  const caseDocument = await caseUpload.json(); assert.equal(caseUpload.status, 201, JSON.stringify(caseDocument));
  assert.equal((await req(`/clients/${client.data.id}`, { reason: 'Purga QA' }, token, code, 'DELETE')).status, 204);
  assert.equal((await req(`/deleted-records/Client/${client.data.id}/purge-preview`, undefined, token, code, 'GET')).status, 403);
  const preview = await req(`/deleted-records/Client/${client.data.id}/purge-preview`, undefined, tenantPlatformToken, code, 'GET');
  assert.equal(preview.status, 200, JSON.stringify(preview.data)); assert.equal(preview.data.documentCount, 2); assert.equal(preview.data.blockReason, null);
  assert.equal((await req(`/deleted-records/Client/${client.data.id}/purge`, { reference: 'wrong' }, tenantPlatformToken, code, 'DELETE')).status, 400);
  const purged = await req(`/deleted-records/Client/${client.data.id}/purge`, { reference: preview.data.reference }, tenantPlatformToken, code, 'DELETE');
  assert.equal(purged.status, 200, JSON.stringify(purged.data)); assert.equal(purged.data.documentCount, 2);
  assert.equal((await req(`/deleted-records/Client/${client.data.id}/purge-preview`, undefined, tenantPlatformToken, code, 'GET')).status, 404);
  const tenantDb = db(`SELECT "DatabaseName" FROM bufete.tenants WHERE "Code"='${code}'`);
  assert.match(tenantDb, /^bufete_t_[a-f0-9]{32}$/);
  const tenantSql = query => execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', tenantDb, '-At', '-c', query], { encoding: 'utf8' }).trim();
  assert.equal(tenantSql(`SELECT count(*) FROM bufete.clients WHERE "Id"='${client.data.id}'`), '0');
  assert.equal(tenantSql(`SELECT count(*) FROM bufete.documents WHERE "Id"='${document.id}'`), '0');
  assert.equal(tenantSql(`SELECT count(*) FROM bufete.legal_cases WHERE "Id"='${caseId}'`), '0');
  assert.equal(tenantSql(`SELECT count(*) FROM bufete.documents WHERE "Id"='${caseDocument.id}'`), '0');
  assert.equal(tenantSql('SELECT count(*) FROM bufete.pending_storage_purges'), '0');
  console.log(JSON.stringify({ qaDatabase: metadata.databaseName, tenant: code, clientId: client.data.id, caseId, documentIds: [document.id, caseDocument.id], preview: preview.data, result: purged.data, checks: ['403 tenant admin', '400 wrong reference', '200 purge', '404 record', 'client/case/documents absent in PostgreSQL', 'storage outbox empty'] }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
