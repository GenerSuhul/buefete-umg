import type {
  CaseDetail,
  CaseRequirement,
  Client,
  Enrollment,
  RequirementDefinition,
  Student,
  StudentRequirement,
  UserSummary,
} from "../types/domain";
import { isLegalStudyOperation, legalStudyOperation } from './legalStudy';
import {
  audit,
  DemoError,
  ensure,
  id,
  matches,
  now,
  paged,
  requireValue,
  roles,
  rootId,
  type DemoState,
} from "./model";

type Input = Record<string, unknown>;
const input = (value: unknown): Input =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Input)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const nullable = (value: unknown) => text(value) || null;
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const age = (birth: unknown, date: unknown) => {
  if (!birth) return null;
  const b = new Date(text(birth)),
    d = new Date(text(date) || now());
  ensure(
    Number.isFinite(+b) && Number.isFinite(+d) && b <= d,
    "Revise la fecha de nacimiento.",
  );
  return (
    d.getUTCFullYear() -
    b.getUTCFullYear() -
    Number(
      d.getUTCMonth() < b.getUTCMonth() ||
        (d.getUTCMonth() === b.getUTCMonth() &&
          d.getUTCDate() < b.getUTCDate()),
    )
  );
};
const isDeleted = (s: DemoState, type: string, key: string) =>
  s.deleted.some((d) => d.type === type && d.id === key);
const client = (s: DemoState, key: string) =>
  requireValue(
    s.clients.find((p) => p.client.id === key && !isDeleted(s, "Client", key)),
  );
const student = (s: DemoState, key: string) =>
  requireValue(
    s.students.find(
      (p) => p.student.id === key && !isDeleted(s, "Student", key),
    ),
  );
const legalCase = (s: DemoState, key: string) =>
  requireValue(
    s.cases.find(
      (p) => p.summary.id === key && !isDeleted(s, "LegalCase", key),
    ),
  );
const enrollment = (s: DemoState, key: string) =>
  requireValue(
    s.students.flatMap((p) => p.enrollments).find((e) => e.id === key),
  );
const doc = (s: DemoState, key: unknown) =>
  requireValue(
    s.documents.find((d) => d.id === key),
    "Adjunte un documento válido de esta sede.",
  );
const member = (s: DemoState, key: string) =>
  requireValue(s.users.find((u) => u.id === key));
function concurrency(current: { concurrencyToken: string }, data: Input) {
  ensure(
    !data.concurrencyToken ||
      data.concurrencyToken === current.concurrencyToken,
    "Este registro cambió. Actualice la pantalla antes de guardar.",
    409,
  );
}
function editable(target: object, data: Input, keys: string[]) {
  for (const key of keys)
    if (Object.hasOwn(data, key)) Reflect.set(target, key, data[key]);
}
const clientFields = [
  "fullName",
  "birthDate",
  "birthPlace",
  "nationality",
  "sex",
  "maritalStatus",
  "dpi",
  "residenceAddress",
  "education",
  "occupation",
  "workplace",
  "workAddress",
  "workPhone",
  "phone",
  "mobilePhone",
  "salaryAmount",
  "salaryFrequency",
  "childrenCount",
  "assistanceRequested",
  "claimedAgainstPersonName",
  "claimedAgainstPersonAddress",
  "receptionPlace",
  "receptionDate",
  "signatureDocumentId",
];
const studentFields = [
  "fullName",
  "birthDate",
  "studentCardNumber",
  "dpi",
  "studyShift",
  "workplace",
  "workPhone",
  "immediateSupervisor",
  "jobTitle",
  "residenceAddress",
  "mobilePhone",
  "homePhone",
  "email",
  "registrationDate",
];
function validatePerson(data: Input, academic = false) {
  ensure(text(data.fullName).length >= 2, "Indique el nombre completo.");
  if (data.dpi)
    ensure(
      String(data.dpi).replace(/\D/g, "").length === 13,
      "El DPI debe contener 13 dígitos.",
    );
  for (const field of ["phone", "mobilePhone", "homePhone", "workPhone"])
    if (data[field])
      ensure(
        /^(?:502)?\d{8}$/.test(String(data[field]).replace(/\D/g, "")),
        "Revise el número de teléfono.",
      );
  if (academic) {
    ensure(text(data.studentCardNumber), "Indique el carné del alumno.");
    ensure(!text(data.email) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(data.email)), "Revise el correo electrónico.");
  }
}
function addTimeline(
  s: DemoState,
  c: CaseDetail,
  u: UserSummary,
  title: string,
  type: CaseDetail["timeline"][number]["type"] = "GeneralAction",
  data: Input = {},
) {
  if (data.documentId) doc(s, data.documentId);
  const entry = {
    id: id(),
    type,
    title,
    occurredAtUtc: text(data.occurredAtUtc) || now(),
    description: nullable(data.description),
    performedByStudentId: nullable(data.performedByStudentId),
    documentId: nullable(data.documentId),
    createdByUserId: u.id,
  };
  c.timeline.unshift(entry);
  c.summary.lastStep = entry;
  c.summary.concurrencyToken = id();
  return entry;
}
function requirement(def: RequirementDefinition): CaseRequirement {
  return {
    id: id(),
    requirementDefinitionId: def.id,
    label: def.label,
    kind: def.kind,
    isRequired: def.isRequired,
    isConditional: def.isConditional,
    status: "Pending",
    documentId: null,
    dataValue: null,
    conditionMet: null,
    documentIssueDate: null,
    notes: null,
    isExpired: false,
  };
}
function applyRequirement(
  s: DemoState,
  r: CaseRequirement | StudentRequirement,
  data: Input,
  contextId: string,
) {
  const candidate = { ...r, ...data };
  const statuses = [
    "Pending",
    "Submitted",
    "Accepted",
    "Observed",
    "Expired",
    "NotApplicable",
  ];
  ensure(
    statuses.includes(String(candidate.status)),
    "Estado de requisito inválido.",
  );
  if (candidate.documentId)
    ensure(
      doc(s, candidate.documentId).contextId === contextId,
      "El archivo pertenece a otro registro.",
    );
  if (["Submitted", "Accepted", "Observed"].includes(candidate.status)) {
    ensure(
      candidate.kind === "Document"
        ? !!candidate.documentId
        : candidate.kind === "Data"
          ? !!text(candidate.dataValue)
          : "conditionMet" in candidate && candidate.conditionMet !== null,
      "Complete la evidencia antes de presentar o revisar este requisito.",
    );
  }
  if (candidate.status === "NotApplicable")
    ensure(
      r.isConditional,
      "Sólo los requisitos condicionales pueden marcarse como no aplicables.",
    );
  editable(r, data, [
    "status",
    "documentId",
    "dataValue",
    "conditionMet",
    "documentIssueDate",
    "notes",
  ]);
}
function newEnrollment(
  s: DemoState,
  studentId: string,
  data: Input,
): Enrollment {
  ensure(
    ["CivilFamilyCases", "ExternalInternship", "AdHonoremSecretariat"].includes(
      String(data.modality),
    ),
    "Seleccione una modalidad válida.",
  );
  const initial = text(data.initialStatus) || "Draft";
  ensure(
    initial === 'Draft',
    "Registre primero al alumno en borrador y complete los documentos antes de presentar la inscripción.",
  );
  return {
    id: id(),
    studentId,
    modality: data.modality as Enrollment["modality"],
    status: initial as Enrollment["status"],
    siteName: nullable(data.siteName),
    siteAddress: data.modality === 'CivilFamilyCases' ? null : nullable(data.siteAddress),
    shift: nullable(data.shift),
    practiceDays: nullable(data.practiceDays),
    startTime: nullable(data.startTime),
    endTime: nullable(data.endTime),
    startDate: nullable(data.startDate),
    endDate: nullable(data.endDate),
    submittedAtUtc: null,
    admittedAtUtc: null,
    resolvedAtUtc: null,
    resolutionNotes: null,
    resolutionDocumentId: null,
    clinicCardNumber: null,
    clinicCardIssuedDate: null,
    clinicCardExpirationDate: null,
    clinicCardDeliveredAtUtc: null,
    concurrencyToken: id(),
    requirements: s.studentDefinitions
      .filter((d) => d.isActive)
      .map((d) => requirement(d)),
  };
}
const enrollmentTransitions: Record<
  Enrollment["status"],
  Enrollment["status"][]
> = {
  Draft: ["Submitted"],
  Submitted: ["Admitted", "Observed", "Rejected"],
  Admitted: ["UnderReview", "Observed", "Rejected"],
  UnderReview: ["Approved", "Observed", "Rejected"],
  Observed: ["Submitted", "UnderReview", "Rejected"],
  Approved: ["Completed"],
  Rejected: ["Draft"],
  Completed: [],
};
export const isReadOperation = (method: string) =>
  /^(get|list|search)/.test(method);

/** Business operations for the isolated review environment. All state is tenant-scoped by the caller. */
export function operate(
  s: DemoState,
  u: UserSummary,
  method: string,
  args: unknown[],
): unknown {
  if (isLegalStudyOperation(method)) return legalStudyOperation(s, u, method, args);
  const a = text(args[0]),
    b = text(args[1]),
    data = input(args[1]),
    opts = input(args[0]);
  const admin = u.roles.includes("AdministradorGeneral"),
    secretary = u.roles.includes("Secretaria");
  ensure(
    admin || secretary || u.roles.includes("Alumno"),
    "La cuenta no tiene un rol autorizado.",
    403,
  );
  if (
    !admin &&
    /^(listUsers|listRoles|createUser|updateUser|deactivateUser|setUserAccess|restoreUser|purgeUser|resetUserPassword|setUserPhoto|listAudit|listDeleted|restoreDeleted|createProcess|updateProcess|createRequirement|updateRequirement|listRetention)/.test(
      method,
    )
  )
    throw new DemoError("No tiene permiso para esta operación.", 403);
  if (
    !admin &&
    !secretary &&
    ![
      "getDashboard",
      "listStudents",
      "getStudent",
      "listCases",
      "getCase",
      "listDocuments",
      "getDocument",
      "listDocumentHistory",
      "getDocumentReadAccess",
      "downloadDocument",
      "getCurrentUser",
      "updateOwnProfile",
      "changeOwnPassword",
      "setOwnPhoto",
    ].includes(method)
  )
    throw new DemoError(
      "Esta operación requiere personal autorizado de la sede.",
      403,
    );
  if (!admin && !secretary) {
    const own = s.students.find((p) => p.student.userAccountId === u.id);
    ensure(own, "No hay un perfil académico asociado a esta cuenta.", 403);
    if (method === "getStudent")
      ensure(a === own.student.id, "No tiene acceso a este alumno.", 403);
    if (method === "getCase")
      ensure(
        s.cases.some(
          (c) =>
            c.summary.id === a &&
            c.summary.assignments.some(
              (x) => x.studentId === own.student.id && x.status === "Active",
            ),
        ),
        "No tiene acceso a este expediente.",
        403,
      );
  }
  const visibleCases = () =>
    s.cases.filter(
      (c) =>
        !isDeleted(s, "LegalCase", c.summary.id) &&
        (admin ||
          secretary ||
          c.summary.assignments.some(
            (x) =>
              x.studentId ===
                s.students.find((p) => p.student.userAccountId === u.id)
                  ?.student.id && x.status === "Active",
          )),
    );
  let result: unknown;
  switch (method) {
    case "getCurrentUser":
      return u;
    case "listRoles":
      return roles;
    case "listProcessTypes":
      return s.processes;
    case "listClients":
      return paged(
        s.clients
          .map((p) => p.client)
          .filter(
            (c) =>
              !isDeleted(s, "Client", c.id) &&
              c.isActive === (opts.isActive ?? true) &&
              matches([c.fullName, c.dpi, c.receptionNumber], opts.search),
          ),
        opts,
      );
    case "getClient": {
      const p = client(s, a);
      return {
        ...p,
        cases: s.cases
          .filter(
            (c) =>
              c.summary.clientId === a &&
              !isDeleted(s, "LegalCase", c.summary.id),
          )
          .map(({ summary: c }) => ({
            ...c,
            processType: c.processTypeName,
            lastStep: c.lastStep?.title ?? null,
            lastStepAtUtc: c.lastStep?.occurredAtUtc ?? null,
          })),
      };
    }
    case "createClient": {
      validatePerson(opts);
      const c = {
        id: id(),
        receptionNumber: `REC-${new Date().getFullYear()}-${String(s.clients.length + 1).padStart(5, "0")}`,
        concurrencyToken: id(),
        isActive: true,
        createdAtUtc: now(),
        birthDate: null,
        birthPlace: null,
        nationality: null,
        sex: null,
        maritalStatus: null,
        dpi: null,
        education: null,
        occupation: null,
        workplace: null,
        workAddress: null,
        workPhone: null,
        phone: null,
        mobilePhone: null,
        salaryAmount: null,
        salaryFrequency: null,
        childrenCount: 0,
        claimedAgainstPersonName: null,
        claimedAgainstPersonAddress: null,
        signatureDocumentId: null,
      } as Client;
      editable(c, opts, clientFields);
      c.ageAtReception = age(c.birthDate, c.receptionDate);
      ensure(
        c.residenceAddress && c.assistanceRequested && c.receptionDate,
        "Complete residencia, asistencia y fecha de recepción.",
      );
      s.clients.unshift({ client: c, incomeDeclarations: [], cases: [] });
      result = c;
      break;
    }
    case "updateClient": {
      const c = client(s, a).client;
      concurrency(c, data);
      validatePerson({ ...c, ...data });
      editable(c, data, clientFields);
      c.ageAtReception = age(c.birthDate, c.receptionDate);
      c.concurrencyToken = id();
      s.cases
        .filter((x) => x.summary.clientId === a)
        .forEach((x) => (x.summary.clientName = c.fullName));
      result = c;
      break;
    }
    case "setClientAttention": {
      const c = client(s, a).client;
      concurrency(c, { concurrencyToken: args[2] });
      ensure(typeof args[1] === "boolean", "Estado inválido.");
      c.isActive = args[1];
      c.concurrencyToken = id();
      result = c;
      break;
    }
    case "createIncomeDeclaration": {
      const p = client(s, a),
        c = p.client;
      const declaration = {
        ...c,
        id: id(),
        clientId: a,
        declaredAge: age(c.birthDate, data.declarationDate),
        place: text(data.place) || c.receptionPlace,
        declarationDate: text(data.declarationDate) || now().slice(0, 10),
        declaresLimitedResources: data.declaresLimitedResources === true,
        generatedDocumentId: null,
        signedDocumentId: nullable(data.signedDocumentId),
      };
      p.incomeDeclarations.unshift(declaration);
      result = declaration;
      break;
    }
    case "getIncomeDeclarationPrint": {
      const d = requireValue(
        s.clients.flatMap((p) => p.incomeDeclarations).find((d) => d.id === a),
      );
      return {
        __html: `<!doctype html><html lang="es"><meta charset="utf-8"><title>Declaración</title><body><img src="/umg.png" width="72" alt="UMG"><h1>Bufete Popular UMG</h1><h2>Declaración de ingresos</h2><p>${escape(d.fullName)} · DPI ${escape(d.dpi)}</p><p>${escape(d.residenceAddress)}</p><p>Ingresos declarados: Q ${escape(d.salaryAmount)} · ${escape(d.salaryFrequency)}</p><p>${escape(d.place)} · ${escape(d.declarationDate)}</p><p>Firma: ____________________________</p></body></html>`,
      };
    }
    case "listStudents":
      return paged(
        s.students
          .map((p) => p.student)
          .filter(
            (c) =>
              !isDeleted(s, "Student", c.id) &&
              (admin || secretary || c.userAccountId === u.id) &&
              (opts.isActive === undefined || c.isActive === opts.isActive) &&
              matches([c.fullName, c.studentCardNumber, c.email], opts.search),
          ),
        opts,
      );
    case "getStudent": {
      const p = student(s, a);
      return {
        ...p,
        cases: s.cases.flatMap((c) =>
          !isDeleted(s, "LegalCase", c.summary.id)
            ? c.summary.assignments
                .filter((x) => x.studentId === a)
                .map((x) => ({
                  assignmentId: x.id,
                  caseId: c.summary.id,
                  caseNumber: c.summary.caseNumber,
                  clientName: c.summary.clientName,
                  processType: c.summary.processTypeName,
                  status: c.summary.status,
                  stage: c.summary.stage,
                  isPrimary: x.isPrimary,
                  assignmentStatus: x.status,
                  assignedAtUtc: x.assignedAtUtc,
                  endedAtUtc: x.endedAtUtc,
                  endReason: x.endReason,
                  lastStep: c.summary.lastStep?.title ?? null,
                  lastStepAtUtc: c.summary.lastStep?.occurredAtUtc ?? null,
                }))
            : [],
        ),
      };
    }
    case "registerStudent": {
      const p = input(opts.student);
      validatePerson(p, true);
      ensure(
        !s.students.some(
          (x) =>
            x.student.studentCardNumber === p.studentCardNumber ||
            (text(p.email) && x.student.email === p.email),
        ),
        "El carné o correo ya está registrado.",
      );
      const st = {
        id: id(),
        userAccountId: opts.access ? id() : null,
        photoDocumentId: null,
        concurrencyToken: id(),
        isActive: true,
        birthDate: null,
        ageAtRegistration: null,
        semester: null,
        studyShift: null,
        workplace: null,
        workPhone: null,
        immediateSupervisor: null,
        jobTitle: null,
        mobilePhone: null,
        homePhone: null,
      } as Student;
      editable(st, p, studentFields);
      st.ageAtRegistration = age(st.birthDate, st.registrationDate);
      const en = newEnrollment(s, st.id, input(opts.enrollment)),
        ac = input(opts.access);
      const account: UserSummary | null = st.userAccountId ? {
        id: st.userAccountId!,
        username: st.email,
        email: st.email,
        fullName: st.fullName,
        isActive: true,
        isDeleted: false,
        participationStartDate: nullable(ac.participationStartDate),
        participationEndDate: nullable(ac.participationEndDate),
        photoDocumentId: null,
        roles: ["Alumno"],
        accessStatus: "Active",
      } : null;
      if (account) s.users.push(account);
      s.students.unshift({ student: st, enrollments: [en], cases: [] });
      result = {
        student: st,
        enrollment: en,
        access: account ? {
          userAccountId: account.id,
          username: account.username,
          email: account.email,
          isActive: true,
        } : null,
      };
      break;
    }
    case "updateStudent": {
      const profile = student(s, a);
      const st = profile.student;
      concurrency(st, data);
      validatePerson({ ...st, ...data }, true);
      if (data.practice) {
        const practice = input(data.practice);
        const en = requireValue(profile.enrollments.find(item => item.id === practice.enrollmentId));
        if (en.concurrencyToken) concurrency({ concurrencyToken: en.concurrencyToken }, practice);
        ensure(['CivilFamilyCases', 'ExternalInternship', 'AdHonoremSecretariat'].includes(text(practice.modality)), 'Seleccione una modalidad válida.');
        ensure(!practice.startDate || !practice.endDate || text(practice.endDate) >= text(practice.startDate), 'La fecha final debe ser posterior a la inicial.');
        ensure(!practice.startTime || !practice.endTime || text(practice.endTime) > text(practice.startTime), 'La hora final debe ser posterior a la inicial.');
        editable(en, practice, ['modality', 'siteAddress', 'shift', 'practiceDays', 'startTime', 'endTime', 'startDate', 'endDate']);
        if (practice.modality === 'ExternalInternship') en.siteName = nullable(practice.siteName);
        en.concurrencyToken = id();
      }
      editable(st, data, studentFields);
      st.ageAtRegistration = age(st.birthDate, st.registrationDate);
      st.concurrencyToken = id();
      result = st;
      break;
    }
    case "setStudentActive": {
      const st = student(s, a).student;
      ensure(typeof args[1] === "boolean", "Estado inválido.");
      if (args[1]) ensure(!s.studentLegalStudies?.[a]?.closure, 'La práctica del alumno ya está cerrada; no puede reactivarse.');
      if (!args[1])
        ensure(
          !s.cases.some((c) =>
            c.summary.assignments.some(
              (x) => x.studentId === a && x.status === "Active",
            ),
          ),
          "Finalice o reasigne los casos antes de dar de baja.",
        );
      st.isActive = args[1];
      st.concurrencyToken = id();
      if (st.userAccountId) member(s, st.userAccountId).isActive = st.isActive;
      result = st;
      break;
    }
    case "createEnrollment": {
      const p = student(s, a);
      ensure(p.student.isActive && !s.studentLegalStudies?.[a]?.closure, "La práctica del alumno ya fue cerrada.");
      ensure(
        !p.enrollments.some(
          (e) => !["Rejected", "Completed"].includes(e.status),
        ),
        "El alumno ya tiene una inscripción vigente.",
      );
      const en = newEnrollment(s, a, data);
      p.enrollments.unshift(en);
      result = en;
      break;
    }
    case "changeEnrollmentStatus": {
      const en = enrollment(s, a),
        status = text(data.status) as Enrollment["status"];
      ensure(
        enrollmentTransitions[en.status]?.includes(status),
        "Seleccione el siguiente estado válido del proceso de inscripción.",
      );
      if (status === 'Submitted')
        ensure(en.requirements.filter(r => r.isRequired && r.kind === 'Document').every(r => r.documentId && ['Submitted','Accepted'].includes(r.status)),
          'Complete todos los documentos obligatorios antes de presentar la inscripción.');
      if (status === "Approved")
        ensure(
          en.requirements
            .filter((r) => r.isRequired && !r.isConditional)
            .every((r) => r.status === "Accepted"),
          "Acepte todos los requisitos obligatorios antes de aprobar.",
        );
      en.status = status;
      en.resolutionNotes = nullable(data.resolutionNotes);
      if (data.resolutionDocumentId)
        en.resolutionDocumentId = doc(s, data.resolutionDocumentId).id;
      if (status === "Admitted") en.admittedAtUtc = now();
      if (["Approved", "Rejected", "Completed"].includes(status))
        en.resolvedAtUtc = now();
      result = en;
      break;
    }
    case "updateStudentRequirement": {
      const en = enrollment(s, a);
      const r = requireValue(en.requirements.find((r) => r.id === b));
      applyRequirement(s, r, input(args[2]), en.id);
      result = r;
      break;
    }
    case "issueClinicCard": {
      const en = enrollment(s, a);
      ensure(en.status === "Approved", "La inscripción debe estar aprobada.");
      ensure(
        text(data.cardNumber) && text(data.issuedDate),
        "Indique número y fecha de emisión.",
      );
      en.clinicCardNumber = text(data.cardNumber);
      en.clinicCardIssuedDate = text(data.issuedDate);
      en.clinicCardExpirationDate = nullable(data.expirationDate);
      en.clinicCardDeliveredAtUtc = data.markDelivered ? now() : null;
      result = en;
      break;
    }
    case "listCases":
      return paged(
        visibleCases()
          .map((c) => c.summary)
          .filter(
            (c) =>
              (!opts.status || c.status === opts.status) &&
              matches(
                [c.caseNumber, c.clientName, c.processTypeName],
                opts.search,
              ),
          ),
        opts,
      );
    case "getCase":
      return legalCase(s, a);
    case "openCase": {
      const c = client(s, text(opts.clientId)).client,
        p = requireValue(
          s.processes.find((p) => p.id === opts.processTypeId && p.isActive),
        );
      ensure(c.isActive, "El usuario no tiene atención activa.");
      const detail: CaseDetail = {
        summary: {
          id: id(),
          caseNumber: `EXP-${new Date().getFullYear()}-${String(s.cases.length + 1).padStart(5, "0")}`,
          clientId: c.id,
          clientName: c.fullName,
          processTypeId: p.id,
          processTypeName: p.name,
          status: "DocumentCollection",
          stage: text(opts.initialStage) || "Recolección documental",
          openedAtUtc: now(),
          closedAtUtc: null,
          lastStep: null,
          assignments: [],
          concurrencyToken: id(),
        },
        requirements: p.requirements.filter((r) => r.isActive).map(requirement),
        counterparties: [],
        timeline: [],
        memorials: [],
        presentations: [],
        courtNotifications: [],
      };
      if (Array.isArray(opts.counterparties))
        for (const party of opts.counterparties)
          detail.counterparties.push({
            id: id(),
            fullName: text(input(party).fullName),
            dpi: nullable(input(party).dpi),
            residenceAddress: nullable(input(party).residenceAddress),
            workAddress: nullable(input(party).workAddress),
            phone: nullable(input(party).phone),
            notes: nullable(input(party).notes),
          });
      addTimeline(s, detail, u, "Expediente abierto", "CaseOpened");
      s.cases.unshift(detail);
      result = detail;
      break;
    }
    case "updateCase": {
      const c = legalCase(s, a);
      concurrency(c.summary, data);
      ensure(
        ["DocumentCollection", "Active", "Suspended", "Archived"].includes(
          text(data.status),
        ),
        "Use la acción de cierre para cerrar un expediente.",
      );
      if (data.status === "Active")
        ensure(
          c.requirements
            .filter((r) => r.isRequired && !r.isConditional)
            .every((r) => r.status === "Accepted"),
          "Complete los requisitos obligatorios antes de activar el expediente.",
        );
      ensure(text(data.stage), "Indique la etapa.");
      c.summary.status = data.status as CaseDetail["summary"]["status"];
      c.summary.stage = text(data.stage);
      addTimeline(s, c, u, "Estado y etapa actualizados", "StatusChange");
      result = c;
      break;
    }
    case "listStudentAssignmentCandidates": {
      const c = legalCase(s, a);
      return paged(
        s.students
          .filter(
            (p) =>
              !isDeleted(s, "Student", p.student.id) &&
              p.student.isActive &&
              p.enrollments.some((e) => e.status === "Approved") &&
              !c.summary.assignments.some(
                (x) => x.studentId === p.student.id && x.status === "Active",
              ) &&
              matches(
                [p.student.fullName, p.student.studentCardNumber],
                args[1],
              ),
          )
          .map((p) => ({
            id: p.student.id,
            fullName: p.student.fullName,
            studentCardNumber: p.student.studentCardNumber,
            photoDocumentId: p.student.photoDocumentId ?? null,
          })),
        { pageSize: 100 },
      );
    }
    case "assignStudent": {
      const c = legalCase(s, a),
        p = student(s, b);
      ensure(
        p.student.isActive &&
          p.enrollments.some((e) => e.status === "Approved"),
        "El alumno debe tener una inscripción aprobada y estar activo.",
      );
      ensure(
        !["Closed", "Archived"].includes(c.summary.status),
        "No se puede asignar en un expediente cerrado o archivado.",
      );
      ensure(
        !c.summary.assignments.some(
          (x) => x.studentId === b && x.status === "Active",
        ),
        "El alumno ya está asignado.",
      );
      if (args[2])
        c.summary.assignments.forEach((x) => {
          x.isPrimary = false;
        });
      const assignment = {
        id: id(),
        studentId: b,
        studentName: p.student.fullName,
        studentPhotoDocumentId: p.student.photoDocumentId ?? null,
        isPrimary: args[2] === true,
        status: "Active" as const,
        assignedAtUtc: now(),
        endedAtUtc: null,
        endReason: null,
      };
      c.summary.assignments.push(assignment);
      addTimeline(
        s,
        c,
        u,
        `Alumno asignado: ${p.student.fullName}`,
        "Assignment",
      );
      result = assignment;
      break;
    }
    case "endAssignment": {
      const c = legalCase(s, a),
        x = requireValue(c.summary.assignments.find((x) => x.id === b));
      ensure(text(args[2]), "Indique el motivo de finalización.");
      x.status = "Completed";
      x.endedAtUtc = now();
      x.endReason = text(args[2]);
      addTimeline(s, c, u, "Asignación finalizada", "Assignment");
      break;
    }
    case "addTimelineEntry": {
      const c = legalCase(s, a);
      ensure(text(data.title), "Indique un título.");
      result = addTimeline(s, c, u, text(data.title), "GeneralAction", data);
      break;
    }
    case "updateCaseRequirement": {
      const c = legalCase(s, a),
        r = requireValue(c.requirements.find((r) => r.id === b));
      applyRequirement(s, r, input(args[2]), c.summary.id);
      addTimeline(
        s,
        c,
        u,
        `Requisito actualizado: ${r.label}`,
        "RequirementUpdated",
      );
      result = r;
      break;
    }
    case "addCounterparty": {
      const c = legalCase(s, a);
      ensure(text(data.fullName), "Indique el nombre de la persona.");
      const party = {
        id: id(),
        fullName: text(data.fullName),
        dpi: nullable(data.dpi),
        residenceAddress: nullable(data.residenceAddress),
        workAddress: nullable(data.workAddress),
        phone: nullable(data.phone),
        notes: nullable(data.notes),
      };
      c.counterparties.push(party);
      result = party;
      break;
    }
    case "updateCounterparty": {
      const c = legalCase(s, a),
        p = requireValue(c.counterparties.find((p) => p.id === b));
      editable(p, input(args[2]), [
        "fullName",
        "dpi",
        "residenceAddress",
        "workAddress",
        "phone",
        "notes",
      ]);
      result = p;
      break;
    }
    case "createMemorial": {
      const c = legalCase(s, a);
      ensure(text(data.title), "Indique un título.");
      doc(s, data.documentId);
      const memorial = {
        id: id(),
        title: text(data.title),
        status: "Received" as const,
        versions: [
          {
            id: id(),
            versionNumber: 1,
            documentId: text(data.documentId),
            submittedByStudentId: nullable(data.submittedByStudentId),
            notes: nullable(data.notes),
            reviews: [],
          },
        ],
      };
      c.memorials.push(memorial);
      addTimeline(s, c, u, `Memorial recibido: ${memorial.title}`, "Memorial");
      result = memorial;
      break;
    }
    case "addMemorialVersion": {
      const c = legalCase(s, a),
        m = requireValue(c.memorials.find((m) => m.id === b)),
        v = input(args[2]);
      doc(s, v.documentId);
      ensure(
        m.status !== "Presented",
        "Un memorial presentado no admite cambios.",
      );
      m.versions.push({
        id: id(),
        versionNumber: m.versions.length + 1,
        documentId: text(v.documentId),
        submittedByStudentId: nullable(v.submittedByStudentId),
        notes: nullable(v.notes),
        reviews: [],
      });
      m.status = "Corrected";
      addTimeline(s, c, u, "Nueva versión de memorial", "Memorial");
      result = m;
      break;
    }
    case "reviewMemorial": {
      const c = legalCase(s, a),
        m = requireValue(c.memorials.find((m) => m.id === b)),
        v = input(args[2]),
        version = requireValue(m.versions.find((x) => x.id === v.versionId));
      ensure(
        version.id === m.versions.at(-1)?.id && m.status !== "Presented",
        "Sólo se puede revisar la versión vigente no presentada.",
      );
      ensure(
        ["Approved", "RequiresChanges"].includes(text(v.outcome)) &&
          text(v.observations),
        "Indique resultado y observaciones.",
      );
      if (v.reviewedDocumentId) doc(s, v.reviewedDocumentId);
      version.reviews.push({
        id: id(),
        outcome: v.outcome as "Approved" | "RequiresChanges",
        observations: text(v.observations),
        reviewedDocumentId: nullable(v.reviewedDocumentId),
        reviewedAtUtc: now(),
        reviewedByUserId: u.id,
      });
      m.status =
        v.outcome === "Approved"
          ? "ApprovedForSignature"
          : "RequiresCorrection";
      addTimeline(s, c, u, "Memorial revisado", "MemorialReview");
      result = m;
      break;
    }
    case "presentMemorial": {
      const c = legalCase(s, a),
        m = requireValue(c.memorials.find((m) => m.id === b)),
        v = input(args[2]);
      ensure(
        m.status === "ApprovedForSignature",
        "Apruebe el memorial antes de registrar la presentación.",
      );
      for (const k of ["presentedDocumentId", "receiptDocumentId"])
        if (v[k]) doc(s, v[k]);
      m.status = "Presented";
      const presentation = {
        id: id(),
        memorialId: m.id,
        memorialTitle: m.title,
        memorialVersionId: m.versions.at(-1)!.id,
        presentedAtUtc: text(v.presentedAtUtc) || now(),
        result: text(v.result),
        presentedDocumentId: nullable(v.presentedDocumentId),
        receiptDocumentId: nullable(v.receiptDocumentId),
        createdByUserId: u.id,
      };
      c.presentations.push(presentation);
      addTimeline(s, c, u, "Presentación registrada", "Presentation");
      result = presentation;
      break;
    }
    case "addCourtNotification": {
      const c = legalCase(s, a);
      doc(s, data.documentId);
      ensure(text(data.description), "Describa la notificación.");
      const n = {
        id: id(),
        notifiedAtUtc: text(data.notifiedAtUtc) || now(),
        description: text(data.description),
        documentId: text(data.documentId),
        newStage: nullable(data.newStage),
        createdByUserId: u.id,
      };
      c.courtNotifications.push(n);
      if (n.newStage) c.summary.stage = n.newStage;
      addTimeline(s, c, u, "Notificación registrada", "CourtNotification");
      result = n;
      break;
    }
    case "closeCase": {
      const c = legalCase(s, a);
      ensure(text(data.reason), "Indique el motivo del cierre.");
      c.summary.status = "Closed";
      c.summary.closedAtUtc = text(data.closedAtUtc) || now();
      c.summary.assignments.forEach((x) => {
        if (x.status === "Active") {
          x.status = "Completed";
          x.endedAtUtc = now();
          x.endReason = "Cierre del expediente";
        }
      });
      addTimeline(s, c, u, "Expediente cerrado", "Closure", {
        description: data.reason,
      });
      break;
    }
    case "reopenCase": {
      const c = legalCase(s, a);
      ensure(
        c.summary.status === "Closed" && text(args[1]),
        "Indique el motivo para reabrir un expediente cerrado.",
      );
      c.summary.status = "Active";
      c.summary.closedAtUtc = null;
      addTimeline(s, c, u, "Expediente reabierto", "Reopening", {
        description: args[1],
      });
      break;
    }
    case "deleteClient":
    case "deleteStudent":
    case "deleteCase": {
      ensure(admin, "Sólo un administrador puede eliminar registros.", 403);
      const type =
        method === "deleteClient"
          ? "Client"
          : method === "deleteStudent"
            ? "Student"
            : "LegalCase";
      const entity =
        type === "Client"
          ? client(s, a).client
          : type === "Student"
            ? student(s, a).student
            : legalCase(s, a).summary;
      if (type !== "LegalCase")
        ensure(
          !s.cases.some(
            (c) =>
              !isDeleted(s, "LegalCase", c.summary.id) &&
              !["Closed", "Archived"].includes(c.summary.status) &&
              (type === "Client"
                ? c.summary.clientId === a
                : c.summary.assignments.some(
                    (x) => x.studentId === a && x.status === "Active",
                  )),
          ),
          "Finalice los expedientes o asignaciones activos antes de eliminar este registro.",
        );
      s.deleted.unshift({
        id: a,
        type,
        name: "fullName" in entity ? entity.fullName : entity.clientName,
        reference:
          "receptionNumber" in entity
            ? entity.receptionNumber
            : "studentCardNumber" in entity
              ? entity.studentCardNumber
              : entity.caseNumber,
        deletedAtUtc: now(),
        deletedByUserId: u.id,
        deletedByName: u.fullName,
        reason: nullable(args[1]),
      });
      result = null;
      break;
    }
    case "listDeletedRecords":
      return paged(
        s.deleted.filter(
          (r) =>
            (!opts.type || r.type === opts.type) &&
            matches([r.name, r.reference], opts.search),
        ),
        opts,
      );
    case "restoreDeletedRecord": {
      const index = s.deleted.findIndex((d) => d.type === a && d.id === b);
      ensure(index >= 0, "Registro no encontrado.");
      s.deleted.splice(index, 1);
      break;
    }
    case "listUsers":
      return paged(
        s.users.filter(
          (x) =>
            (opts.lifecycle === "deleted" ? x.isDeleted : !x.isDeleted) &&
            (opts.personType === "student"
              ? x.roles.includes("Alumno")
              : opts.personType === "staff"
                ? !x.roles.includes("Alumno")
                : true) &&
            (opts.isActive === undefined || x.isActive === opts.isActive) &&
            matches([x.fullName, x.email, x.username], opts.search),
        ),
        opts,
      );
    case "createUser": {
      ensure(
        text(opts.username) &&
          text(opts.fullName) &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(opts.email)),
        "Complete nombre, usuario y correo válidos.",
      );
      ensure(
        !s.users.some(
          (x) =>
            x.email.toLowerCase() === text(opts.email).toLowerCase() ||
            x.username === opts.username,
        ),
        "El correo o usuario ya está registrado.",
      );
      const assigned = roles.filter(
        (r) => Array.isArray(opts.roleIds) && opts.roleIds.includes(r.id),
      );
      ensure(assigned.length > 0, "Seleccione un rol válido.");
      const x: UserSummary = {
        id: id(),
        username: text(opts.username),
        email: text(opts.email).toLowerCase(),
        fullName: text(opts.fullName),
        isActive: opts.isActive !== false,
        isDeleted: false,
        participationStartDate: nullable(opts.participationStartDate),
        participationEndDate: nullable(opts.participationEndDate),
        photoDocumentId: null,
        roles: assigned.map((r) => r.name),
        accessStatus: opts.isActive === false ? "Suspended" : "Active",
      };
      s.users.push(x);
      if (opts.studentId) {
        const st = student(s, text(opts.studentId)).student;
        ensure(!st.userAccountId, "El alumno ya tiene acceso.");
        st.userAccountId = x.id;
      }
      result = x;
      break;
    }
    case "updateUser": {
      const x = member(s, a);
      ensure(
        x.id !== rootId,
        "La cuenta de plataforma se administra desde Mi cuenta.",
      );
      const assigned = roles.filter(
        (r) => Array.isArray(data.roleIds) && data.roleIds.includes(r.id),
      );
      ensure(assigned.length > 0, "Seleccione un rol válido.");
      editable(x, data, [
        "email",
        "fullName",
        "isActive",
        "participationStartDate",
        "participationEndDate",
      ]);
      x.roles = assigned.map((r) => r.name);
      x.accessStatus = x.isActive ? "Active" : "Suspended";
      result = x;
      break;
    }
    case "deactivateUser": {
      const x = member(s, a);
      ensure(
        a !== rootId && a !== u.id,
        "No puede eliminar la cuenta actual ni la de plataforma.",
      );
      x.isActive = false;
      x.isDeleted = true;
      x.accessStatus = "Deleted";
      break;
    }
    case "setUserAccess": {
      const x = member(s, a);
      ensure(
        a !== rootId && a !== u.id,
        "No puede suspender la cuenta actual ni la de plataforma.",
      );
      if (args[1] === true) {
        const linked = s.students.find(p => p.student.userAccountId === a);
        ensure(!linked || linked.student.isActive && !s.studentLegalStudies?.[linked.student.id]?.closure,
          'La práctica del alumno está cerrada; su acceso no puede reactivarse.');
      }
      x.isActive = args[1] === true;
      x.accessStatus = x.isActive ? "Active" : "Suspended";
      result = x;
      break;
    }
    case "restoreUser": {
      const x = member(s, a);
      ensure(x.isDeleted, "La cuenta no está eliminada.");
      x.isDeleted = false;
      x.isActive = false;
      x.accessStatus = "Suspended";
      result = x;
      break;
    }
    case "purgeUser": {
      const x = member(s, a);
      ensure(
        x.isDeleted && a !== rootId && a !== u.id,
        "Primero debe eliminar lógicamente la cuenta.",
      );
      s.users = s.users.filter((x) => x.id !== a);
      delete s.passwords[a];
      s.students.forEach((p) => {
        if (p.student.userAccountId === a) p.student.userAccountId = null;
      });
      break;
    }
    case "updateOwnProfile": {
      ensure(
        text(opts.fullName) &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(opts.email)),
        "Indique nombre y correo válidos.",
      );
      ensure(
        u.id !== rootId ||
          text(opts.email).toLowerCase() === u.email.toLowerCase(),
        "El correo de plataforma se administra mediante soporte.",
      );
      u.fullName = text(opts.fullName);
      u.email = text(opts.email);
      result = u;
      break;
    }
    case "createProcessType": {
      ensure(text(opts.code) && text(opts.name), "Indique código y nombre.");
      const p = {
        id: id(),
        code: text(opts.code),
        name: text(opts.name),
        description: text(opts.description),
        isActive: opts.isActive !== false,
        requirements: [],
      };
      s.processes.push(p);
      result = p;
      break;
    }
    case "updateProcessType": {
      const p = requireValue(s.processes.find((x) => x.id === a));
      editable(p, data, ["code", "name", "description", "isActive"]);
      result = p;
      break;
    }
    case "createRequirement": {
      const d = { ...opts, id: id() } as unknown as RequirementDefinition;
      ensure(
        text(d.code) &&
          text(d.label) &&
          ["Document", "Data", "Condition"].includes(d.kind),
        "Complete código, etiqueta y tipo.",
      );
      if (d.scope === "Process")
        requireValue(
          s.processes.find((p) => p.id === d.processTypeId),
        ).requirements.push(d);
      else s.studentDefinitions.push(d);
      result = d;
      break;
    }
    case "updateRequirement": {
      const d = requireValue(
        [
          ...s.processes.flatMap((p) => p.requirements),
          ...s.studentDefinitions,
        ].find((d) => d.id === a),
      );
      editable(d, data, [
        "code",
        "label",
        "kind",
        "isRequired",
        "isConditional",
        "conditionDescription",
        "documentNature",
        "maximumAgeDays",
        "subject",
        "instructions",
        "sortOrder",
        "isActive",
      ]);
      result = d;
      break;
    }
    case "listDocuments":
    case "listDocumentHistory": {
      const o =
        method === "listDocuments"
          ? opts
          : { ...input(args[2]), contextType: a, contextId: b };
      return paged(
        s.documents
          .filter((d) => {
            try {
              authorizeDocument(s, u, d.contextType, d.contextId);
              return true;
            } catch {
              return false;
            }
          })
          .filter(
            (d) =>
              (!o.contextType || d.contextType === o.contextType) &&
              (!o.contextId || d.contextId === o.contextId) &&
              (!o.label || d.label === o.label) &&
              matches([d.label, d.originalFileName], o.search),
          )
          .map(({ storagePath: _, ...d }) => d),
        o,
      );
    }
    case "getDocument": {
      const { storagePath: _, ...d } = doc(s, a);
      return d;
    }
    case "getDocumentReadAccess": {
      const d = doc(s, a);
      return {
        fileName: d.originalFileName,
        contentType: d.contentType,
        url: null,
        expiresAtUtc: null,
      };
    }
    case "listActivities":
      return paged(
        s.activities.filter(
          (x) =>
            (!opts.from || x.occurredAtUtc >= String(opts.from)) &&
            (!opts.to || x.occurredAtUtc.slice(0, 10) <= String(opts.to)) &&
            (!opts.userId || x.createdByUserId === opts.userId) &&
            matches([x.activityType, x.description], opts.search),
        ),
        opts,
      );
    case "createActivity": {
      ensure(
        text(opts.description) && text(opts.activityType),
        "Indique tipo y descripción de actividad.",
      );
      if (opts.clientId) client(s, text(opts.clientId));
      if (opts.studentId) student(s, text(opts.studentId));
      if (opts.legalCaseId) legalCase(s, text(opts.legalCaseId));
      const x = {
        id: id(),
        occurredAtUtc: text(opts.occurredAtUtc) || now(),
        activityType: text(opts.activityType),
        description: text(opts.description),
        clientId: nullable(opts.clientId),
        studentId: nullable(opts.studentId),
        legalCaseId: nullable(opts.legalCaseId),
        isCorrected: false,
        correctionReason: null,
        createdByUserId: u.id,
      };
      s.activities.unshift(x);
      result = x;
      break;
    }
    case "listReports":
      return paged(s.reports, opts);
    case "generateReport": {
      ensure(
        /^\d{4}-\d{2}-\d{2}$/.test(a) &&
          /^\d{4}-\d{2}-\d{2}$/.test(b) &&
          a <= b,
        "Seleccione un rango válido.",
      );
      const activities = s.activities.filter(
        (x) =>
          x.occurredAtUtc.slice(0, 10) >= a &&
          x.occurredAtUtc.slice(0, 10) <= b,
      );
      const r = {
        id: id(),
        periodStart: a,
        periodEnd: b,
        status: "Draft" as const,
        printableHtml: `<article><img src="/umg.png" width="60" alt="UMG"><h1>Bufete Popular UMG</h1><h2>Informe de actividades</h2><p>${a} al ${b}</p>${activities.map((x) => `<p><b>${escape(x.activityType)}</b> · ${escape(x.occurredAtUtc)}<br>${escape(x.description)}</p>`).join("") || "<p>No se registraron actividades en este período.</p>"}</article>`,
        reviewedAtUtc: null,
        reviewedByUserId: null,
        sentAtUtc: null,
        sentByUserId: null,
        activityCount: activities.length,
        deliveries: [],
      };
      s.reports.unshift(r);
      result = r;
      break;
    }
    case "reviewReport": {
      const r = requireValue(s.reports.find((r) => r.id === a));
      ensure(r.status === "Draft", "El reporte ya fue revisado.");
      r.status = "Reviewed";
      r.reviewedAtUtc = now();
      r.reviewedByUserId = u.id;
      result = r;
      break;
    }
    case "sendReport":
      throw new DemoError(
        "El envío de correo no está configurado. Puede revisar, imprimir y descargar el reporte.",
      );
    case "listAudit":
      return paged(
        s.audit.filter(
          (x) =>
            (!opts.userId || x.userId === opts.userId) &&
            (!opts.entityType || x.entityType === opts.entityType),
        ),
        opts,
      );
    case "listRetentionCandidates":
      return paged([], opts);
    case "search":
      return paged(
        [
          ...s.clients
            .filter(
              (p) =>
                !isDeleted(s, "Client", p.client.id) &&
                matches([p.client.fullName, p.client.dpi], a),
            )
            .map((p) => ({
              id: p.client.id,
              resultType: "Client",
              displayName: p.client.fullName,
              secondaryText: p.client.receptionNumber,
              relatedCaseId: null,
              caseStatus: null,
              lastStep: null,
            })),
          ...s.students
            .filter(
              (p) =>
                !isDeleted(s, "Student", p.student.id) &&
                matches([p.student.fullName, p.student.studentCardNumber], a),
            )
            .map((p) => ({
              id: p.student.id,
              resultType: "Student",
              displayName: p.student.fullName,
              secondaryText: p.student.studentCardNumber,
              relatedCaseId: null,
              caseStatus: null,
              lastStep: null,
            })),
          ...visibleCases()
            .filter((c) =>
              matches([c.summary.caseNumber, c.summary.clientName], a),
            )
            .map((c) => ({
              id: c.summary.id,
              resultType: "LegalCase",
              displayName: c.summary.caseNumber,
              secondaryText: c.summary.clientName,
              relatedCaseId: c.summary.id,
              caseStatus: c.summary.status,
              lastStep: c.summary.lastStep?.title ?? null,
            })),
        ],
        { pageSize: 30 },
      );
    case "getDashboard": {
      const cs = visibleCases().map((c) => c.summary),
        active = cs.filter((c) => !["Closed", "Archived"].includes(c.status)),
        reqs = visibleCases()
          .filter((c) => !["Closed", "Archived"].includes(c.summary.status))
          .flatMap((c) => c.requirements),
        complete = reqs.filter((r) =>
          ["Accepted", "NotApplicable"].includes(r.status),
        ).length;
      const distribution = s.processes
        .map((p) => ({
          label: p.name,
          count: active.filter((c) => c.processTypeId === p.id).length,
        }))
        .filter((p) => p.count)
        .map((p) => ({
          ...p,
          value: active.length
            ? Math.round((p.count / active.length) * 100)
            : 0,
        }));
      const practiceTeam = s.students
        .filter(
          (p) => !isDeleted(s, "Student", p.student.id) && p.student.isActive,
        )
        .map((p) => ({
          studentId: p.student.id,
          fullName: p.student.fullName,
          photoDocumentId: p.student.photoDocumentId ?? null,
          activeCaseCount: active.filter((c) =>
            c.assignments.some(
              (x) => x.studentId === p.student.id && x.status === "Active",
            ),
          ).length,
        }))
        .filter((p) => p.activeCaseCount);
      return {
        activeCases: active.length,
        documentCollectionCases: active.filter(
          (c) => c.status === "DocumentCollection",
        ).length,
        activeStudents: practiceTeam.length,
        completedRequirements: complete,
        pendingRequirements: reqs.length - complete,
        totalRequirements: reqs.length,
        weeklyActivities: s.activities.filter(
          (x) => +new Date(x.occurredAtUtc) > Date.now() - 7 * 86400000,
        ).length,
        completionRate: reqs.length
          ? Math.round((complete / reqs.length) * 100)
          : 0,
        caseMovementChangePercentage: null,
        weeklyActivityChangePercentage: null,
        caseSeries: Array.from({ length: 6 }, (_, i) => {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() - 5 + i);
          return {
            label: d.toLocaleDateString("es-GT", { month: "short" }),
            value: cs.filter(
              (c) => c.openedAtUtc.slice(0, 7) === d.toISOString().slice(0, 7),
            ).length,
          };
        }),
        processDistribution: distribution,
        practiceTeam,
        recentCases: cs.slice(0, 5),
      };
    }
    default:
      throw new DemoError(
        "Esta operación no está disponible en esta instalación.",
        400,
      );
  }
  audit(
    s,
    u,
    method,
    a ||
      (result && typeof result === "object" && "id" in result
        ? String(result.id)
        : ""),
  );
  return result ?? null;
}

export function authorizeDocument(
  s: DemoState,
  u: UserSummary,
  contextType: string,
  contextId: string,
) {
  if (
    u.roles.includes("AdministradorGeneral") ||
    u.roles.includes("Secretaria")
  ) {
    if (contextType === "Client") client(s, contextId);
    else if (contextType === "Student") student(s, contextId);
    else if (contextType === "Enrollment") enrollment(s, contextId);
    else if (contextType === "LegalCase") legalCase(s, contextId);
    else if (contextType === "UserPhoto") member(s, contextId);
    else if (contextType === "Memorial")
      requireValue(
        s.cases.flatMap((c) => c.memorials).find((m) => m.id === contextId),
      );
    else if (contextType === "IncomeDeclaration")
      requireValue(
        s.clients
          .flatMap((p) => p.incomeDeclarations)
          .find((d) => d.id === contextId),
      );
    else if (contextType === "Timeline")
      requireValue(
        s.cases.flatMap((c) => c.timeline).find((t) => t.id === contextId),
      );
    else if (contextType === "Report")
      requireValue(s.reports.find((r) => r.id === contextId));
    else if (contextType === "CaseRequirement")
      requireValue(
        s.cases.flatMap((c) => c.requirements).find((r) => r.id === contextId),
      );
    else throw new DemoError("Tipo de propietario inválido.");
    return;
  }
  const own = s.students.find((p) => p.student.userAccountId === u.id);
  ensure(own, "No tiene un perfil académico.", 403);
  const assigned = s.cases.filter((c) =>
    c.summary.assignments.some(
      (x) => x.studentId === own.student.id && x.status === "Active",
    ),
  );
  const allowed =
    (contextType === "Student" && contextId === own.student.id) ||
    (contextType === "UserPhoto" &&
      (contextId === u.id || s.users.some((x) => x.id === contextId))) ||
    (contextType === "Enrollment" &&
      own.enrollments.some((e) => e.id === contextId)) ||
    (contextType === "LegalCase" &&
      assigned.some((c) => c.summary.id === contextId)) ||
    (contextType === "Memorial" &&
      assigned.some((c) => c.memorials.some((m) => m.id === contextId)));
  ensure(allowed, "No tiene acceso a este documento.", 403);
}
