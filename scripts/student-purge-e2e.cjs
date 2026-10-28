const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('../frontend/node_modules/pdf-lib');

async function main() {
  const environmentPath = process.argv[2];
  if (!environmentPath) throw new Error('Indique environment.json de una base QA aislada.');
  const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
  assert.match(environment.databaseName, /^bufete_changes_qa_[a-f0-9]{12}$/);
  assert.equal(environment.port, 5105);
  const base = 'http://127.0.0.1:5105/api/v1';
  const config = {};
  for (const file of ['.env', '.env.platform.local']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const index = line.indexOf('='); if (index > 0) config[line.slice(0, index)] = line.slice(index + 1);
    }
  }
  let checks = 0;
  async function call(method, endpoint, body, token, expected = 200) {
    const response = await fetch(base + endpoint, { method, headers: { 'X-Sede-Code': 'peten', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await response.text(); const value = raw ? JSON.parse(raw) : null;
    assert.equal(response.status, expected, `${endpoint}: ${raw}`); checks++; return value;
  }
  const login = await call('POST', '/auth/login', { email: config.BootstrapAdmin__Email, password: config.BootstrapAdmin__Password });
  const admin = login.accessToken;
  const suffix = Date.now().toString(); const studentPassword = crypto.randomBytes(12).toString('hex');
  const registration = await call('POST', '/students/registration', {
    student: { fullName: `Alumno cierre QA ${suffix}`, birthDate: '2001-01-01', studentCardNumber: `QA-${suffix}`, dpi: suffix.slice(-13).padStart(13, '8'), semester: null, studyShift: 'Entre semana', residenceAddress: 'Dirección QA', mobilePhone: '55551234', email: `qa-cierre-${suffix}@example.test`, registrationDate: '2026-01-01' },
    enrollment: { modality: 'CivilFamilyCases', initialStatus: 'Draft' },
    access: { password: studentPassword, participationStartDate: '2026-01-01', participationEndDate: '2027-12-31' }
  }, admin, 201);
  const student = registration.student; const enrollment = registration.enrollment;
  await call('PUT', `/students/enrollments/${enrollment.id}/status`, { status: 'Submitted' }, admin, 409);
  const pdf = await PDFDocument.create(); pdf.addPage([300, 400]); const bytes = Buffer.from(await pdf.save());
  async function upload(contextType, contextId, label) {
    const form = new FormData(); form.set('File', new Blob([bytes], { type: 'application/pdf' }), 'firmado-qa.pdf');
    form.set('Source', 'Upload'); form.set('ContextType', contextType); form.set('ContextId', contextId); form.set('Label', label);
    const response = await fetch(base + '/documents', { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'X-Sede-Code': 'peten' }, body: form });
    const value = await response.json(); assert.equal(response.status, 201, JSON.stringify(value)); checks++; return value;
  }
  for (const requirement of enrollment.requirements) {
    const document = await upload('Enrollment', enrollment.id, requirement.label);
    await call('PUT', `/students/enrollments/${enrollment.id}/requirements/${requirement.id}`, { status: 'Accepted', documentId: document.id, dataValue: 'Validado QA', notes: 'Evidencia de prueba' }, admin);
  }
  for (const status of ['Submitted', 'Admitted', 'UnderReview', 'Approved']) await call('PUT', `/students/enrollments/${enrollment.id}/status`, { status, resolutionNotes: 'Validación QA' }, admin);
  const studentSession = await call('POST', '/auth/login', { email: student.email, password: studentPassword });
  const client = await call('POST', '/clients', { fullName: `Cliente cierre QA ${suffix}`, dpi: (BigInt(student.dpi.replace(/\D/g, '')) + 1n).toString().padStart(13, '0'), residenceAddress: 'QA', assistanceRequested: 'Prueba', receptionPlace: 'QA', receptionDate: '2026-01-01', childrenCount: 0 }, admin, 201);
  const processes = await call('GET', '/catalogs/process-types', null, admin);
  const legalCase = await call('POST', '/cases', { clientId: client.id, processTypeId: processes[0].id }, admin, 201);
  await call('POST', `/cases/${legalCase.summary.id}/assignments`, { studentId: student.id, isPrimary: true }, admin, 201);
  const document = await upload('Student', student.id, 'Revisión firmada QA');
  await call('POST', `/student-legal-studies/${student.id}/delivery`, { deliveryDate: '2026-10-01', finalDocumentId: document.id, notes: '' }, admin, 409);
  await call('POST', `/student-legal-studies/${student.id}/reviews`, { reviewType: 'FirstReview', reviewDate: '2026-09-30', observations: 'Observaciones firmadas', signedDocumentId: document.id }, studentSession.accessToken, 403);
  await call('POST', `/student-legal-studies/${student.id}/reviews`, { reviewType: 'FirstReview', reviewDate: '2026-09-30', observations: 'Observaciones firmadas', signedDocumentId: document.id }, admin);
  const reopened = await call('GET', `/student-legal-studies/${student.id}`, null, admin); assert.equal(reopened.reviews.length, 1); checks++;
  await call('POST', `/student-legal-studies/${student.id}/delivery`, { deliveryDate: '2026-10-01', finalDocumentId: document.id, notes: 'Entrega final QA' }, admin);
  const profile = await call('GET', `/students/${student.id}/profile`, null, admin);
  assert.equal(profile.student.isActive, false); assert.equal(profile.cases[0].assignmentStatus, 'Completed'); assert.equal(profile.enrollments[0].status, 'Completed'); checks += 3;
  const closedCase = await call('GET', `/cases/${legalCase.summary.id}`, null, admin); assert.ok(closedCase.timeline.some(item => item.title === 'Cierre de práctica del alumno')); checks++;
  const closures = await call('GET', `/student-legal-studies/closures?search=${encodeURIComponent(suffix)}`, null, admin); assert.ok(closures.items.some(item => item.studentId === student.id)); checks++;
  await call('PUT', `/students/${student.id}/active`, { isActive: true }, admin, 409);
  await call('POST', '/auth/login', { email: student.email, password: studentPassword }, null, 401);
  await call('GET', '/auth/me', null, studentSession.accessToken, 401);
  const download = await fetch(base + `/documents/${document.id}/content`, { headers: { Authorization: `Bearer ${admin}`, 'X-Sede-Code': 'peten' } });
  assert.equal(download.status, 200); assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 4).toString(), '%PDF'); checks += 2;
  const platform = await call('POST', '/auth/login', { email: config.PlatformAdmin__Email, password: config.PlatformAdmin__Password });
  const superToken = platform.accessToken;
  await call('DELETE', `/cases/${legalCase.summary.id}`, { reason: 'Purga QA expediente' }, admin, 204);
  const casePreview = await call('GET', `/deleted-records/LegalCase/${legalCase.summary.id}/purge-preview`, null, superToken);
  assert.equal(casePreview.blockReason, null, JSON.stringify(casePreview)); checks++;
  await call('DELETE', `/deleted-records/LegalCase/${legalCase.summary.id}/purge`, { reference: casePreview.reference }, superToken);
  await call('DELETE', `/students/${student.id}`, { reason: 'Purga QA alumno con cierre' }, admin, 204);
  const studentPreview = await call('GET', `/deleted-records/Student/${student.id}/purge-preview`, null, superToken);
  assert.equal(studentPreview.blockReason, null, JSON.stringify(studentPreview));
  assert.ok(studentPreview.documentCount >= enrollment.requirements.length + 1); checks += 2;
  const studentPurge = await call('DELETE', `/deleted-records/Student/${student.id}/purge`, { reference: studentPreview.reference }, superToken);
  assert.equal(studentPurge.pendingStorageDeletes, 0); checks++;
  await call('GET', `/students/${student.id}/profile`, null, superToken, 404);
  await call('GET', `/documents/${document.id}`, null, superToken, 404);
  const closuresAfter = await call('GET', `/student-legal-studies/closures?search=${encodeURIComponent(suffix)}`, null, admin);
  assert.ok(!closuresAfter.items.some(item => item.studentId === student.id)); checks++;
  const sql = query => execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', environment.databaseName, '-At', '-c', query], { encoding: 'utf8' }).trim();
  for (const recordId of [student.id, student.userAccountId, legalCase.summary.id, document.id]) if (recordId) assert.match(recordId, /^[a-f0-9-]{36}$/);
  assert.equal(sql(`SELECT count(*) FROM bufete.students WHERE "Id"='${student.id}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM bufete.users WHERE "Id"='${student.userAccountId}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM bufete.student_legal_reviews WHERE "StudentId"='${student.id}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM bufete.student_practice_closures WHERE "StudentId"='${student.id}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM bufete.documents WHERE "Id"='${document.id}'`), '0');
  assert.equal(sql('SELECT count(*) FROM bufete.pending_storage_purges'), '0'); checks += 6;
  const result = { checks, studentId: student.id, caseId: legalCase.summary.id, documentId: document.id, studentPreview, studentPurge, completedAt: new Date().toISOString() };
  const artifacts = path.resolve('.artifacts/changes-qa/student-purge'); fs.mkdirSync(artifacts, { recursive: true }); fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
