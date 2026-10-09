import assert from "node:assert/strict";
const base = process.env.DEMO_TEST_URL ?? "http://127.0.0.1:5190";
let token = "";
let count = 0;
async function call(method, ...args) {
  const r = await fetch(`${base}/api/demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ method, args }),
  });
  const body = await r.json();
  if (!r.ok) throw Object.assign(new Error(body.detail), { status: r.status });
  count++;
  return body;
}
async function denied(method, args, code) {
  await assert.rejects(
    () => call(method, ...args),
    (e) => e.status === code,
  );
  count++;
}
const initial = await call(
  "login",
  "licenciado@demo.umg.gt",
  process.env.DEMO_INITIAL_PASSWORD,
);
token = initial.accessToken;
const initialWorkspace = await call("getWorkspace");
const suffix = Date.now().toString(36),
  code = `qa-${suffix}`;
const workspaces = await call("createTenant", {
  code,
  name: `Validación técnica ${suffix}`,
});
const tenant = workspaces.tenants.find((t) => t.code === code);
const switched = await call("switchTenant", tenant.id);
token = switched.accessToken;
assert.equal((await call("listClients")).totalCount, 0);
const p = {
  fullName: "Persona ficticia de validación",
  residenceAddress: "Dirección de prueba",
  receptionDate: "2026-10-09",
  receptionPlace: "Petén",
  assistanceRequested: "Cambio de nombre",
  dpi: "0000 00000 0000",
};
const c = await call("createClient", p);
assert.equal((await call("getClient", c.id)).client.fullName, p.fullName);
await call("updateClient", c.id, {
  ...p,
  fullName: "Persona ficticia editada",
  concurrencyToken: c.concurrencyToken,
});
await denied(
  "updateClient",
  [c.id, { fullName: "Conflicto", concurrencyToken: c.concurrencyToken }],
  409,
);
const opened = await call("openCase", {
  clientId: c.id,
  processTypeId: "CAMBIO_NOMBRE",
});
assert.equal(opened.requirements.length, 2);
const img = {
  __file: true,
  name: "prueba.png",
  type: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
};
const document = await call("uploadDocument", {
  file: img,
  contextType: "LegalCase",
  contextId: opened.summary.id,
  label: "Documento de prueba",
});
assert.equal((await call("downloadDocument", document.id)).data, img.data);
for (const req of opened.requirements) {
  await denied(
    "updateCaseRequirement",
    [opened.summary.id, req.id, { status: "Accepted" }],
    400,
  );
  await call("updateCaseRequirement", opened.summary.id, req.id, {
    status: "Accepted",
    documentId: document.id,
  });
}
const student = await call("registerStudent", {
  student: {
    fullName: "Alumno de validación",
    email: `alumno-${suffix}@example.test`,
    studentCardNumber: `1690-26-${suffix}`,
    dpi: "0000000000000",
    registrationDate: "2026-10-09",
    residenceAddress: "Prueba",
  },
  enrollment: { modality: "CivilFamilyCases", initialStatus: "Submitted" },
  access: { password: "Ejemplo26" },
});
assert.equal(
  (await call("getStudent", student.student.id)).enrollments.length,
  1,
);
await denied(
  "assignStudent",
  [opened.summary.id, student.student.id, true],
  400,
);
await denied(
  "changeEnrollmentStatus",
  [student.enrollment.id, { status: "Approved" }],
  400,
);
await call("changeEnrollmentStatus", student.enrollment.id, {
  status: "Admitted",
});
await call("changeEnrollmentStatus", student.enrollment.id, {
  status: "UnderReview",
});
const evidence = await call("uploadDocument", {
  file: img,
  contextType: "Enrollment",
  contextId: student.enrollment.id,
  label: "Evidencia de prueba",
});
for (const req of student.enrollment.requirements)
  await call("updateStudentRequirement", student.enrollment.id, req.id, {
    status: req.isConditional ? "NotApplicable" : "Accepted",
    documentId: req.isConditional ? null : evidence.id,
  });
await call("changeEnrollmentStatus", student.enrollment.id, {
  status: "Approved",
});
await call("assignStudent", opened.summary.id, student.student.id, true);
await call("issueClinicCard", student.enrollment.id, {
  cardNumber: "DEMO-001",
  issuedDate: "2026-10-09",
  markDelivered: true,
});
assert.equal((await call("getStudent", student.student.id)).cases.length, 1);
await call("addTimelineEntry", opened.summary.id, {
  title: "Actuación de validación",
  description: "Prueba de persistencia",
});
const memorial = await call("createMemorial", opened.summary.id, {
  title: "Memorial de prueba",
  documentId: document.id,
});
await call("reviewMemorial", opened.summary.id, memorial.id, {
  versionId: memorial.versions[0].id,
  outcome: "Approved",
  observations: "Revisión de demostración",
});
await call("presentMemorial", opened.summary.id, memorial.id, {
  result: "Presentación simulada",
  presentedAtUtc: new Date().toISOString(),
});
await call("addCourtNotification", opened.summary.id, {
  documentId: document.id,
  description: "Notificación de prueba",
  newStage: "Seguimiento",
});
await call("createActivity", {
  activityType: "Seguimiento",
  description: "Actividad de prueba",
  occurredAtUtc: new Date().toISOString(),
  legalCaseId: opened.summary.id,
});
const report = await call("generateReport", "2026-01-01", "2027-12-31");
await call("reviewReport", report.id);
await denied(
  "sendReport",
  [report.id, ["example@example.test"], "Prueba"],
  400,
);
const scan = await call("createScanSession", {
  contextType: "LegalCase",
  contextId: opened.summary.id,
  label: "Digitalización de prueba",
  acquisitionProvider: "Upload",
});
await call("addScanPage", scan.id, img, {
  clientPageId: crypto.randomUUID(),
  source: "Upload",
});
const preview = await call("previewScanSession", scan.id);
assert.equal(preview.type, "application/pdf");
const scanned = await call("completeScanSession", scan.id);
assert.equal(scanned.source, "Scanner");
assert.equal(
  (await call("downloadDocument", scanned.id)).type,
  "application/pdf",
);
const photo = await call("setOwnPhoto", img);
assert.ok(photo.photoDocumentId);
assert.equal(
  (await call("getCurrentUser")).photoDocumentId,
  photo.photoDocumentId,
);
const adminToken = token;
token = (await call("login", student.student.email, "Ejemplo26")).accessToken;
assert.equal(
  (await call("getCase", opened.summary.id)).summary.id,
  opened.summary.id,
);
await denied("listUsers", [], 403);
await denied("getClient", [c.id], 403);
await denied("switchTenant", [initialWorkspace.current.id], 403);
token = adminToken;
const staff = await call("createUser", {
  username: `staff-${suffix}`,
  email: `staff-${suffix}@example.test`,
  fullName: "Secretaría de prueba",
  password: "Ejemplo26",
  isActive: true,
  roleIds: ["secretary"],
});
await call("setUserAccess", staff.id, false);
await denied("login", [staff.email, "Ejemplo26"], 401);
await call("deactivateUser", staff.id);
await call("restoreUser", staff.id);
assert.equal(
  (await call("listUsers")).items.find((u) => u.id === staff.id).isActive,
  false,
);
await call("closeCase", opened.summary.id, { reason: "Prueba terminada" });
await call("deleteCase", opened.summary.id, "Prueba");
await denied("getCase", [opened.summary.id], 404);
await call("restoreDeletedRecord", "LegalCase", opened.summary.id);
assert.equal(
  (await call("getCase", opened.summary.id)).summary.status,
  "Closed",
);
await Promise.all(
  Array.from({ length: 3 }, (_, i) =>
    call("createClient", { ...p, fullName: `Concurrencia ${i}` }),
  ),
);
assert.equal((await call("listClients")).totalCount, 4);
token = (await call("switchTenant", initialWorkspace.current.id)).accessToken;
await denied("getClient", [c.id], 404);
await denied("downloadDocument", [document.id], 404);
assert.ok((await call("listAudit")).items.every((x) => x.entityId !== c.id));
await call("logout");
await denied("getWorkspace", [], 401);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      assertionsAndRequests: count,
      base,
      qaTenant: code,
      flows: [
        "CRUD/persistencia",
        "concurrencia",
        "inscripción",
        "evidencia",
        "asignación",
        "memorial",
        "notificación",
        "reportes",
        "escáner/importación",
        "fotos",
        "cuentas",
        "eliminados",
        "aislamiento",
        "revocación",
      ],
    },
    null,
    2,
  ),
);
