import { readFileSync } from "node:fs";
const base = process.env.DEMO_TEST_URL ?? "http://127.0.0.1:5190";
let token = "";
async function call(method, ...args) {
  const response = await fetch(`${base}/api/demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ method, args }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail);
  return result;
}
token = (
  await call(
    "login",
    "licenciado@demo.umg.gt",
    process.env.DEMO_INITIAL_PASSWORD,
  )
).accessToken;
await call("updateOwnProfile", {
  fullName: "Licenciado Demo",
  email: "licenciado@demo.umg.gt",
});
const workspace = await call("getWorkspace");
if (workspace.current.code !== "peten")
  throw new Error("Seed only applies to the isolated Petén demo.");
if ((await call("listClients", { search: "Persona de ejemplo" })).totalCount) {
  console.log("Demo examples already exist.");
  process.exit(0);
}
const client = await call("createClient", {
  fullName: "Persona de ejemplo · Petén",
  birthDate: "1994-05-15",
  birthPlace: "Petén",
  nationality: "Guatemalteca",
  sex: "Femenino",
  maritalStatus: "Soltera",
  dpi: "0000 00000 0000",
  residenceAddress: "Dirección ficticia de demostración",
  mobilePhone: "0000 0000",
  occupation: "Datos de prueba",
  receptionPlace: "Bufete Popular UMG · Petén",
  receptionDate: "2026-10-09",
  assistanceRequested: "Ejemplo de cambio de nombre",
  childrenCount: 0,
});
const student = await call("registerStudent", {
  student: {
    fullName: "Estudiante de ejemplo",
    birthDate: "2002-03-10",
    studentCardNumber: "1690-26-00001",
    dpi: "0000 00000 0001",
    semester: 10,
    studyShift: "Matutina",
    email: "estudiante.ejemplo@example.test",
    registrationDate: "2026-10-09",
    residenceAddress: "Dirección ficticia",
    mobilePhone: "0000 0000",
  },
  enrollment: {
    modality: "CivilFamilyCases",
    initialStatus: "Submitted",
    siteName: "Bufete Popular UMG · Petén",
    shift: "Matutina",
    startDate: "2026-10-09",
  },
  access: { password: "AlumnoDemo26!" },
});
const pdf = {
  __file: true,
  name: "material-de-ejemplo.pdf",
  type: "application/pdf",
  data: readFileSync(
    new URL("../public/manual-demo.pdf", import.meta.url),
  ).toString("base64"),
};
const evidence = await call("uploadDocument", {
  file: pdf,
  contextType: "Enrollment",
  contextId: student.enrollment.id,
  label: "Material ficticio de demostración - no válido como requisito real",
});
await call("changeEnrollmentStatus", student.enrollment.id, {
  status: "Admitted",
});
await call("changeEnrollmentStatus", student.enrollment.id, {
  status: "UnderReview",
});
for (const r of student.enrollment.requirements)
  await call("updateStudentRequirement", student.enrollment.id, r.id, {
    status: r.isConditional ? "NotApplicable" : "Accepted",
    documentId: r.isConditional ? null : evidence.id,
    notes:
      "Ejemplo preparado exclusivamente para visualizar el flujo. No constituye evidencia real.",
  });
await call("changeEnrollmentStatus", student.enrollment.id, {
  status: "Approved",
  resolutionNotes:
    "Inscripción de ejemplo para demo. Sin validez institucional.",
});
await call("setUserPhoto", student.access.userAccountId, {
  __file: true,
  name: "logo-ejemplo.png",
  type: "image/png",
  data: readFileSync(new URL("../public/umg.png", import.meta.url)).toString(
    "base64",
  ),
});
const legal = await call("openCase", {
  clientId: client.id,
  processTypeId: "CAMBIO_NOMBRE",
  initialStage: "Recolección documental",
});
const file = await call("uploadDocument", {
  file: pdf,
  contextType: "LegalCase",
  contextId: legal.summary.id,
  label: "Material de ejemplo - sustituir con evidencia ficticia al probar",
});
await call(
  "updateCaseRequirement",
  legal.summary.id,
  legal.requirements[0].id,
  {
    status: "Submitted",
    documentId: file.id,
    notes: "Documento de demostración pendiente de revisión.",
  },
);
await call("assignStudent", legal.summary.id, student.student.id, true);
await call("addTimelineEntry", legal.summary.id, {
  title: "Expediente de ejemplo preparado",
  description:
    "Datos ficticios. Utilice este expediente para conocer los módulos o cree su propio caso.",
});
await call("createActivity", {
  activityType: "Recepción",
  description:
    "Preparación de expediente ficticio para revisión del licenciado.",
  legalCaseId: legal.summary.id,
  clientId: client.id,
  studentId: student.student.id,
  occurredAtUtc: new Date().toISOString(),
});
console.log(
  JSON.stringify({
    result: "Demo examples ready",
    caseNumber: legal.summary.caseNumber,
    student: "Estudiante de ejemplo",
    realDataUsed: false,
  }),
);
