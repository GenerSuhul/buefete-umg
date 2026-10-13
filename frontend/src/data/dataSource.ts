import type {
  Activity,
  AuditLog,
  CaseDetail,
  CaseStatus,
  CaseSummary,
  Client,
  ClientProfile,
  DashboardData,
  DocumentRecord,
  DocumentReadAccess,
  DeletedRecord,
  DeletedRecordType,
  CreateUserInput,
  PagedResult,
  ProcessType,
  RequirementDefinition,
  RetentionCandidate,
  Role,
  ScanSession,
  ScanPageSource,
  SearchResult,
  Student,
  StudentAccess,
  StudentAssignmentCandidate,
  StudentProfile,
  StudentRegistration,
  TimelineEntry,
  TokenResponse,
  UserSummary,
  UserWriteInput,
  WeeklyReport,
} from "../types/domain";
import { hasOperationFeedback, isOperationFeedbackHandled, withOperationFeedback } from "../components/ui/feedback/operationFeedback";
import { humanizeOperationError } from "../components/ui/feedback/feedbackBus";
import { readAuthSession, writeAuthSession } from "./authSession";
import mockData from "./testFixtures";
import { createDemoSource, demoEnabled } from "../demo/client";
const mockMode = process.env.NODE_ENV === "test";
const activities = mockData?.activities ?? [];
const auditLogs = mockData?.auditLogs ?? [];
const caseSummaries = mockData?.caseSummaries ?? [];
const cases = mockData?.cases ?? [];
const clientProfiles = mockData?.clientProfiles ?? [];
const clients = mockData?.clients ?? [];
const dashboard = mockData?.dashboard;
const documents = mockData?.documents ?? [];
const retentionCandidates = mockData?.retentionCandidates ?? [];
const studentProfiles = mockData?.studentProfiles ?? [];
const students = mockData?.students ?? [];
const users = mockData?.users ?? [];
const weeklyReports = mockData?.weeklyReports ?? [];
const mockDeletedRecords: DeletedRecord[] = [];

const mockDeleted = (type: DeletedRecordType, id: string) =>
  mockDeletedRecords.some((record) => record.type === type && record.id === id);

const addMockDeletedRecord = (
  type: DeletedRecordType,
  id: string,
  name: string,
  reference: string,
  reason?: string,
) => {
  if (mockDeleted(type, id)) return;
  mockDeletedRecords.unshift({
    id,
    type,
    name,
    reference,
    deletedAtUtc: new Date().toISOString(),
    deletedByUserId: users[0]?.id ?? null,
    deletedByName: users[0]?.fullName ?? null,
    reason: reason?.trim() || null,
  });
};

interface ListOptions {
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface UserListOptions extends ListOptions {
  lifecycle?: "current" | "deleted";
  personType?: "staff" | "student";
}

export interface DataSource {
  readonly mode: "mock" | "api";
  getPlatformHealth(): Promise<PlatformHealth>;
  login(email: string, password: string, tenantCode?: string): Promise<TokenResponse>;
  logout(): Promise<void>;
  getDashboard(): Promise<DashboardData>;
  listClients(options?: ListOptions): Promise<PagedResult<Client>>;
  getClient(id: string): Promise<ClientProfile>;
  createClient(input: Record<string, unknown>): Promise<Client>;
  updateClient(id: string, input: Record<string, unknown>): Promise<Client>;
  setClientAttention(id: string, isActive: boolean, concurrencyToken: string): Promise<Client>;
  deleteClient(id: string, reason?: string): Promise<void>;
  createIncomeDeclaration(
    clientId: string,
    _input: Record<string, unknown>,
  ): Promise<unknown>;
  getIncomeDeclarationPrint(id: string): Promise<Blob>;
  listStudents(options?: ListOptions): Promise<PagedResult<Student>>;
  listStudentAssignmentCandidates(caseId: string, search?: string): Promise<PagedResult<StudentAssignmentCandidate>>;
  getStudent(id: string): Promise<StudentProfile>;
  registerStudent(input: Record<string, unknown>): Promise<StudentRegistration>;
  provisionStudentAccess(
    studentId: string,
    input: Record<string, unknown>,
  ): Promise<StudentAccess>;
  updateStudent(id: string, input: Record<string, unknown>): Promise<Student>;
  setStudentActive(id: string, isActive: boolean): Promise<Student>;
  deleteStudent(id: string, reason?: string): Promise<void>;
  createEnrollment(
    studentId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  changeEnrollmentStatus(
    enrollmentId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  updateStudentRequirement(
    enrollmentId: string,
    requirementId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  issueClinicCard(
    enrollmentId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  listCases(
    options?: ListOptions & { status?: CaseStatus },
  ): Promise<PagedResult<CaseSummary>>;
  getCase(id: string): Promise<CaseDetail>;
  updateCase(id: string, input: { status: CaseStatus; stage: string; concurrencyToken: string }): Promise<CaseDetail>;
  listProcessTypes(): Promise<ProcessType[]>;
  createProcessType(
    input: Omit<ProcessType, "id" | "requirements">,
  ): Promise<ProcessType>;
  updateProcessType(
    id: string,
    input: Omit<ProcessType, "id" | "requirements">,
  ): Promise<ProcessType>;
  createRequirement(
    input: Omit<RequirementDefinition, "id">,
  ): Promise<RequirementDefinition>;
  updateRequirement(
    id: string,
    input: Omit<RequirementDefinition, "id">,
  ): Promise<RequirementDefinition>;
  openCase(input: {
    clientId: string;
    processTypeId: string;
    initialStage?: string | null;
    counterparties?: Array<Record<string, unknown>>;
  }): Promise<CaseDetail>;
  assignStudent(
    caseId: string,
    studentId: string,
    isPrimary: boolean,
  ): Promise<unknown>;
  endAssignment(caseId: string, assignmentId: string, reason: string): Promise<void>;
  addTimelineEntry(
    caseId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  updateCaseRequirement(
    caseId: string,
    requirementId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  addCounterparty(
    caseId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  updateCounterparty(
    caseId: string,
    counterpartyId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  createMemorial(
    caseId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  addMemorialVersion(
    caseId: string,
    memorialId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  reviewMemorial(
    caseId: string,
    memorialId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  presentMemorial(
    caseId: string,
    memorialId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  addCourtNotification(
    caseId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  closeCase(caseId: string, input: Record<string, unknown>): Promise<void>;
  reopenCase(caseId: string, reason: string): Promise<void>;
  deleteCase(id: string, reason?: string): Promise<void>;
  listDeletedRecords(options?: ListOptions & { type?: DeletedRecordType }): Promise<PagedResult<DeletedRecord>>;
  restoreDeletedRecord(type: DeletedRecordType, id: string): Promise<void>;
  listDocuments(
    options?: ListOptions & { contextType?: string; contextId?: string },
  ): Promise<PagedResult<DocumentRecord>>;
  getDocument(id: string): Promise<DocumentRecord>;
  listDocumentHistory(
    contextType: string,
    contextId: string,
    options?: Pick<ListOptions, "page" | "pageSize"> & { label?: string },
  ): Promise<PagedResult<DocumentRecord>>;
  uploadDocument(input: {
    file: File;
    contextType: string;
    contextId: string;
    label: string;
    replaceDocumentId?: string | null;
    source?: "Upload" | "Scanner";
  }): Promise<DocumentRecord>;
  downloadDocument(id: string): Promise<Blob>;
  getDocumentReadAccess(id: string): Promise<DocumentReadAccess>;
  listActivities(
    options?: ListOptions & { from?: string; to?: string; userId?: string },
  ): Promise<PagedResult<Activity>>;
  createActivity(
    input: Omit<
      Activity,
      "id" | "isCorrected" | "correctionReason" | "createdByUserId"
    >,
  ): Promise<Activity>;
  listReports(options?: Pick<ListOptions, "page" | "pageSize">): Promise<PagedResult<WeeklyReport>>;
  generateReport(start: string, end: string): Promise<WeeklyReport>;
  reviewReport(id: string): Promise<WeeklyReport>;
  sendReport(
    id: string,
    recipients: string[],
    subject: string,
    message?: string,
  ): Promise<WeeklyReport>;
  listUsers(options?: UserListOptions): Promise<PagedResult<UserSummary>>;
  listRoles(): Promise<Role[]>;
  createUser(input: CreateUserInput): Promise<UserSummary>;
  updateUser(id: string, input: UserWriteInput): Promise<UserSummary>;
  deactivateUser(id: string): Promise<void>;
  setUserAccess(id: string, isActive: boolean): Promise<UserSummary>;
  restoreUser(id: string): Promise<UserSummary>;
  purgeUser(id: string): Promise<void>;
  resetUserPassword(id: string, password: string): Promise<void>;
  setUserPhoto(id: string, file: File): Promise<UserSummary>;
  getCurrentUser(): Promise<UserSummary>;
  updateOwnProfile(input: {
    fullName: string;
    email: string;
  }): Promise<UserSummary>;
  setOwnPhoto(file: File): Promise<UserSummary>;
  changeOwnPassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
  createScanSession(input: {
    contextType: string;
    contextId: string;
    label: string;
    replaceDocumentId?: string | null;
    acquisitionProvider: string;
    deviceId?: string | null;
    deviceName?: string | null;
    resolutionDpi?: number | null;
    colorMode?: string | null;
    duplex?: boolean | null;
  }): Promise<ScanSession>;
  listScanDrafts(): Promise<ScanSession[]>;
  getScanSession(id: string): Promise<ScanSession>;
  addScanPage(
    id: string,
    file: File,
    input: {
      clientPageId: string;
      source: ScanPageSource;
      widthPixels?: number | null;
      heightPixels?: number | null;
    },
  ): Promise<ScanSession>;
  openScanPage(id: string, pageId: string): Promise<Blob>;
  reorderScanPages(id: string, pageIds: string[]): Promise<ScanSession>;
  rotateScanPage(
    id: string,
    pageId: string,
    rotationDegrees: number,
  ): Promise<ScanSession>;
  removeScanPage(id: string, pageId: string): Promise<ScanSession>;
  saveScanDraft(id: string): Promise<ScanSession>;
  captureScanSession(
    id: string,
    file: File,
    pageCount?: number,
  ): Promise<ScanSession>;
  previewScanSession(id: string): Promise<Blob>;
  completeScanSession(id: string): Promise<DocumentRecord>;
  cancelScanSession(id: string): Promise<ScanSession>;
  reportScanFailure(id: string, code: string, message: string): Promise<ScanSession>;
  listAudit(
    options?: ListOptions & { entityType?: string; userId?: string },
  ): Promise<PagedResult<AuditLog>>;
  listRetentionCandidates(
    options?: ListOptions,
  ): Promise<PagedResult<RetentionCandidate>>;
  search(term: string): Promise<PagedResult<SearchResult>>;
}

export interface PlatformHealth {
  status: "Healthy" | "Degraded" | "Unhealthy";
  checks: Array<{
    name: string;
    status: "Healthy" | "Degraded" | "Unhealthy";
  }>;
}

const delayMs = 0;
const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));
const clone = <T>(value: T): T => structuredClone(value);
const mockScanSessions = new Map<string, ScanSession>();
const mockRoles: Role[] = [
  {
    id: "role-admin",
    name: "AdministradorGeneral",
    description: "Acceso total",
    isSystem: true,
    isActive: true,
    permissions: ["*"],
  },
  {
    id: "role-secretary",
    name: "Secretaria",
    description: "Operación del bufete",
    isSystem: true,
    isActive: true,
    permissions: [],
  },
  {
    id: "role-student",
    name: "Alumno",
    description: "Casos asignados",
    isSystem: true,
    isActive: true,
    permissions: [],
  },
];
const mockProcessTypes: ProcessType[] = [
  {
    id: "process-alimony",
    code: "FIJACION_PENSION",
    name: "Juicio oral de fijación de pensión alimenticia",
    description: "Catálogo parcial confirmado por el cliente.",
    isActive: true,
    requirements: [],
  },
  {
    id: "process-alimony-adjustment",
    code: "AUMENTO_DISMINUCION_PENSION",
    name: "Juicio oral de aumento o disminución de pensión alimenticia",
    description: "Catálogo parcial confirmado por el cliente.",
    isActive: true,
    requirements: [],
  },
  {
    id: "process-divorce",
    code: "DIVORCIO_CAUSAL",
    name: "Juicio oral de divorcio por causal determinada",
    description: "Catálogo parcial confirmado por el cliente.",
    isActive: true,
    requirements: [],
  },
  {
    id: "process-paternity",
    code: "PATERNIDAD_FILIACION",
    name: "Juicio oral de paternidad y filiación",
    description: "Catálogo parcial confirmado por el cliente.",
    isActive: true,
    requirements: [],
  },
  {
    id: "process-custody",
    code: "GUARDA_CUSTODIA",
    name: "Juicio oral de guarda y custodia",
    description: "Catálogo parcial confirmado por el cliente.",
    isActive: true,
    requirements: [],
  },
  {
    id: "process-pension-collection",
    code: "COBRO_PENSIONES",
    name: "Juicio ejecutivo de cobro de pensiones alimenticias atrasadas",
    description: "Catálogo parcial confirmado por el cliente.",
    isActive: true,
    requirements: [],
  },
  {
    id: "process-name-change",
    code: "CAMBIO_NOMBRE",
    name: "Cambio de nombre en vía judicial",
    description: "Tipo confirmado; requisitos pendientes de entrega.",
    isActive: true,
    requirements: [],
  },
];

function page<T>(items: T[], options: ListOptions = {}): PagedResult<T> {
  const currentPage = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? 25);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    totalCount: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function includes(value: string | null | undefined, term: string) {
  return (
    value
      ?.toLocaleLowerCase("es-GT")
      .includes(term.toLocaleLowerCase("es-GT")) ?? false
  );
}

class MockDataSource implements DataSource {
  readonly mode = "mock" as const;

  async getPlatformHealth(): Promise<PlatformHealth> {
    return { status: "Healthy", checks: [] };
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    await wait();
    if (email.trim().toLowerCase() !== users[0].email.toLowerCase() || password !== "demo-local")
      throw new Error("Usuario o contraseña incorrectos.");
    return {
      accessToken: "mock-access-token",
      accessTokenExpiresAtUtc: new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshToken: "mock-refresh-token",
      refreshTokenExpiresAtUtc: new Date(
        Date.now() + 7 * 86_400_000,
      ).toISOString(),
      user: {
        id: users[0].id,
        username: users[0].username,
        email: users[0].email,
        fullName: users[0].fullName,
        photoDocumentId: null,
        roles: users[0].roles,
        permissions: ["*"],
      },
    };
  }

  async logout() {
    await wait();
  }
  async getDashboard() {
    await wait();
    if (!dashboard)
      throw new Error("Los datos de prueba no están disponibles.");
    return clone(dashboard);
  }

  async listClients(options: ListOptions = {}) {
    await wait();
    const available = clients.filter((item) => !mockDeleted("Client", item.id) && item.isActive === (options.isActive ?? true));
    const filtered = options.search
      ? available.filter(
          (item) =>
            includes(item.fullName, options.search!) ||
            includes(item.receptionNumber, options.search!) ||
            includes(item.dpi, options.search!),
        )
      : available;
    return clone(page(filtered, options));
  }

  async getClient(id: string) {
    await wait();
    const result = !mockDeleted("Client", id)
      ? clientProfiles.find((item) => item.client.id === id)
      : undefined;
    if (!result) throw new Error("Cliente no encontrado.");
    return clone(result);
  }
  async createClient(input: Record<string, unknown>) {
    await wait();
    const created = {
      id: crypto.randomUUID(),
      receptionNumber: `REC-${Date.now()}`,
      concurrencyToken: crypto.randomUUID(),
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      ...input,
    } as unknown as Client;
    clients.unshift(created);
    clientProfiles.unshift({ client: created, incomeDeclarations: [], cases: [] });
    return clone(created);
  }
  async updateClient(id: string, input: Record<string, unknown>) {
    await wait();
    const client = clients.find((item) => item.id === id);
    if (!client) throw new Error("Cliente no encontrado.");
    Object.assign(client, input);
    client.concurrencyToken = crypto.randomUUID();
    return clone(client);
  }
  async setClientAttention(id: string, isActive: boolean, concurrencyToken: string) {
    const client = clients.find(item => item.id === id);
    if (!client || client.concurrencyToken !== concurrencyToken) throw new Error("Actualice la ficha antes de guardar.");
    return this.updateClient(id, { isActive });
  }
  async deleteClient(id: string, reason?: string) {
    await wait();
    const client = clients.find((item) => item.id === id);
    if (!client) throw new Error("Cliente no encontrado.");
    addMockDeletedRecord("Client", id, client.fullName, client.receptionNumber, reason);
  }
  async createIncomeDeclaration() {
    await wait();
    return {};
  }
  async getIncomeDeclarationPrint() {
    await wait();
    return new Blob(["<h1>Declaración jurada</h1>"], { type: "text/html" });
  }

  async listStudents(options: ListOptions = {}) {
    await wait();
    const available = students.filter((item) => !mockDeleted("Student", item.id));
    const filtered = options.search
      ? available.filter(
          (item) =>
            includes(item.fullName, options.search!) ||
            includes(item.studentCardNumber, options.search!) ||
            includes(item.email, options.search!),
        )
      : available;
    return clone(page(filtered, options));
  }
  async listStudentAssignmentCandidates(caseId: string, search = "") {
    const assigned = cases.find((item) => item.summary.id === caseId)?.summary.assignments ?? [];
    const assignedIds = new Set(assigned.filter((item) => item.status === "Active").map((item) => item.studentId));
    const items = students
      .filter((student) => !mockDeleted("Student", student.id))
      .filter((student) => student.isActive && !assignedIds.has(student.id))
      .filter((student) => studentProfiles.find((profile) => profile.student.id === student.id)?.enrollments.some((enrollment) => enrollment.status === "Approved"))
      .filter((student) => !search || includes(student.fullName, search) || includes(student.studentCardNumber, search) || includes(student.email, search))
      .map(({ id, photoDocumentId = null, fullName, studentCardNumber }) => ({ id, photoDocumentId, fullName, studentCardNumber }));
    return clone(page(items, { page: 1, pageSize: 100 }));
  }

  async getStudent(id: string) {
    await wait();
    const result = !mockDeleted("Student", id)
      ? studentProfiles.find((item) => item.student.id === id)
      : undefined;
    if (!result) throw new Error("Alumno no encontrado.");
    return clone(result);
  }
  async createStudent(input: Record<string, unknown>) {
    await wait();
    const created = {
      id: crypto.randomUUID(),
      userAccountId: null,
      concurrencyToken: crypto.randomUUID(),
      isActive: true,
      ...input,
    } as unknown as Student;
    students.unshift(created);
    return clone(created);
  }
  async registerStudent(input: Record<string, unknown>) {
    const studentInput = input.student as Record<string, unknown>;
    const student = await this.createStudent(studentInput);
    const access = {
      userAccountId: crypto.randomUUID(),
      username: student.email,
      email: student.email,
      isActive: true,
    };
    student.userAccountId = access.userAccountId;
    return {
      student,
      enrollment: {
        id: crypto.randomUUID(),
        studentId: student.id,
        requirements: [],
        ...(input.enrollment as object),
      } as unknown as StudentRegistration["enrollment"],
      access,
    };
  }
  async provisionStudentAccess(
    studentId: string,
    _input: Record<string, unknown>,
  ) {
    await wait();
    const student = students.find((item) => item.id === studentId);
    if (!student) throw new Error("Alumno no encontrado.");
    const access = {
      userAccountId: crypto.randomUUID(),
      username: student.email,
      email: student.email,
      isActive: true,
    };
    student.userAccountId = access.userAccountId;
    return clone(access);
  }
  async updateStudent(id: string, input: Record<string, unknown>) {
    await wait();
    const student = students.find((item) => item.id === id);
    if (!student) throw new Error("Alumno no encontrado.");
    Object.assign(student, input);
    student.concurrencyToken = crypto.randomUUID();
    return clone(student);
  }
  async setStudentActive(id: string, isActive: boolean) {
    await wait();
    const student = students.find((item) => item.id === id);
    if (!student) throw new Error("Alumno no encontrado.");
    student.isActive = isActive;
    return clone(student);
  }
  async deleteStudent(id: string, reason?: string) {
    await wait();
    const student = students.find((item) => item.id === id);
    if (!student) throw new Error("Alumno no encontrado.");
    addMockDeletedRecord("Student", id, student.fullName, student.studentCardNumber, reason);
  }
  async createEnrollment() {
    await wait();
    return {};
  }
  async changeEnrollmentStatus(enrollmentId: string, input: Record<string, unknown>) {
    await wait();
    const enrollment = studentProfiles.flatMap((profile) => profile.enrollments).find((item) => item.id === enrollmentId);
    if (!enrollment) throw new Error("Inscripción no encontrada.");
    Object.assign(enrollment, input);
    return clone(enrollment);
  }
  async updateStudentRequirement(enrollmentId: string, requirementId: string, input: Record<string, unknown>) {
    await wait();
    const enrollment = studentProfiles.flatMap((profile) => profile.enrollments).find((item) => item.id === enrollmentId);
    const requirement = enrollment?.requirements.find((item) => item.id === requirementId);
    if (!requirement) throw new Error("Requisito no encontrado.");
    Object.assign(requirement, input);
    return clone(requirement);
  }
  async issueClinicCard(enrollmentId: string, input: Record<string, unknown>) {
    await wait();
    const enrollment = studentProfiles.flatMap((profile) => profile.enrollments).find((item) => item.id === enrollmentId);
    if (!enrollment) throw new Error("Inscripción no encontrada.");
    Object.assign(enrollment, {
      clinicCardNumber: input.cardNumber,
      clinicCardIssuedDate: input.issuedDate,
      clinicCardExpirationDate: input.expirationDate,
      clinicCardDeliveredAtUtc: input.markDelivered ? new Date().toISOString() : null,
    });
    return clone(enrollment);
  }

  async listCases(options: ListOptions & { status?: CaseStatus } = {}) {
    await wait();
    const available = caseSummaries.filter((item) => !mockDeleted("LegalCase", item.id));
    let filtered = options.status
      ? available.filter((item) => item.status === options.status)
      : available;
    if (options.search)
      filtered = filtered.filter(
        (item) =>
          includes(item.caseNumber, options.search!) ||
          includes(item.clientName, options.search!) ||
          includes(item.processTypeName, options.search!),
      );
    return clone(page(filtered, options));
  }

  async getCase(id: string) {
    await wait();
    const result = !mockDeleted("LegalCase", id)
      ? cases.find((item) => item.summary.id === id)
      : undefined;
    if (!result) throw new Error("Expediente no encontrado.");
    return clone(result);
  }
  async updateCase(id: string, input: { status: CaseStatus; stage: string; concurrencyToken: string }) {
    await wait();
    const result = cases.find((item) => item.summary.id === id);
    if (!result) throw new Error("Expediente no encontrado.");
    result.summary.status = input.status;
    result.summary.stage = input.stage;
    result.summary.concurrencyToken = crypto.randomUUID();
    return clone(result);
  }
  async listProcessTypes() {
    await wait();
    return clone(mockProcessTypes);
  }
  async createProcessType(input: Omit<ProcessType, "id" | "requirements">) {
    await wait();
    const item: ProcessType = {
      id: crypto.randomUUID(),
      requirements: [],
      ...input,
    };
    mockProcessTypes.push(item);
    return clone(item);
  }
  async updateProcessType(
    id: string,
    input: Omit<ProcessType, "id" | "requirements">,
  ) {
    await wait();
    const item = mockProcessTypes.find((value) => value.id === id);
    if (!item) throw new Error("Tipo de proceso no encontrado.");
    Object.assign(item, input);
    return clone(item);
  }
  async createRequirement(input: Omit<RequirementDefinition, "id">) {
    await wait();
    const requirement = { id: crypto.randomUUID(), ...input };
    const process = mockProcessTypes.find(
      (value) => value.id === input.processTypeId,
    );
    if (process) process.requirements.push(requirement);
    return clone(requirement);
  }
  async updateRequirement(
    id: string,
    input: Omit<RequirementDefinition, "id">,
  ) {
    await wait();
    const requirement = mockProcessTypes
      .flatMap((value) => value.requirements)
      .find((value) => value.id === id);
    if (!requirement) throw new Error("Requisito no encontrado.");
    Object.assign(requirement, input);
    return clone(requirement);
  }
  async openCase(input: {
    clientId: string;
    processTypeId: string;
    initialStage?: string | null;
  }) {
    await wait();
    const client = clients.find((item) => item.id === input.clientId);
    const processType = mockProcessTypes.find(
      (item) => item.id === input.processTypeId,
    );
    if (!client || !processType)
      throw new Error("Datos del expediente no válidos.");
    const summary: CaseSummary = {
      id: crypto.randomUUID(),
      concurrencyToken: crypto.randomUUID(),
      caseNumber: `BJ-${new Date().getFullYear()}-${String(caseSummaries.length + 1).padStart(4, "0")}`,
      clientId: client.id,
      clientName: client.fullName,
      processTypeId: processType.id,
      processTypeName: processType.name,
      status: "DocumentCollection",
      stage: input.initialStage ?? "Recolección documental",
      openedAtUtc: new Date().toISOString(),
      closedAtUtc: null,
      lastStep: null,
      assignments: [],
    };
    const detail: CaseDetail = {
      summary,
      requirements: [],
      counterparties: [],
      timeline: [],
      memorials: [],
      presentations: [],
      courtNotifications: [],
    };
    caseSummaries.unshift(summary);
    cases.unshift(detail);
    return clone(detail);
  }
  async assignStudent(caseId: string, studentId: string, isPrimary: boolean) {
    await wait();
    const detail = cases.find((item) => item.summary.id === caseId);
    const student = students.find((item) => item.id === studentId);
    if (!detail || !student) throw new Error("No se pudo asignar.");
    detail.summary.assignments.push({
      id: crypto.randomUUID(),
      studentId,
      studentName: student.fullName,
      isPrimary,
      status: "Active",
      assignedAtUtc: new Date().toISOString(),
      endedAtUtc: null,
      endReason: null,
    });
    return {};
  }
  async endAssignment(caseId: string, assignmentId: string, reason: string) {
    await wait();
    const detail = cases.find((item) => item.summary.id === caseId);
    const assignment = detail?.summary.assignments.find((item) => item.id === assignmentId);
    if (!assignment || assignment.status !== "Active") throw new Error("No se encontró la asignación activa.");
    assignment.status = "Cancelled";
    assignment.endedAtUtc = new Date().toISOString();
    const profileCase = studentProfiles.flatMap((profile) => profile.cases).find((item) => item.assignmentId === assignmentId);
    if (profileCase) {
      profileCase.assignmentStatus = "Cancelled";
      profileCase.endedAtUtc = assignment.endedAtUtc;
      profileCase.endReason = reason;
    }
  }
  async addTimelineEntry(caseId: string, input: Record<string, unknown>) {
    await wait();
    const detail = cases.find((item) => item.summary.id === caseId);
    if (!detail) throw new Error("Expediente no encontrado.");
    const entry = {
      id: crypto.randomUUID(),
      createdByUserId: users[0].id,
      performedByStudentId: null,
      documentId: null,
      ...input,
    } as unknown as TimelineEntry;
    detail.timeline.push(entry);
    detail.summary.lastStep = entry;
    return clone(entry);
  }
  async updateCaseRequirement() {
    await wait();
    return {};
  }
  async addCounterparty() {
    await wait();
    return {};
  }
  async updateCounterparty() {
    await wait();
    return {};
  }
  async createMemorial() {
    await wait();
    return {};
  }
  async addMemorialVersion() {
    await wait();
    return {};
  }
  async reviewMemorial() {
    await wait();
    return {};
  }
  async presentMemorial() {
    await wait();
  }
  async addCourtNotification() {
    await wait();
  }
  async closeCase() {
    await wait();
  }
  async reopenCase() {
    await wait();
  }
  async deleteCase(id: string, reason?: string) {
    await wait();
    const legalCase = caseSummaries.find((item) => item.id === id);
    if (!legalCase) throw new Error("Expediente no encontrado.");
    addMockDeletedRecord("LegalCase", id, legalCase.clientName, legalCase.caseNumber, reason);
  }
  async listDeletedRecords(options: ListOptions & { type?: DeletedRecordType } = {}) {
    await wait();
    let filtered = options.type
      ? mockDeletedRecords.filter((record) => record.type === options.type)
      : mockDeletedRecords;
    const search = options.search;
    if (search)
      filtered = filtered.filter((record) => includes(record.name, search) || includes(record.reference, search));
    return clone(page(filtered, options));
  }
  async restoreDeletedRecord(type: DeletedRecordType, id: string) {
    await wait();
    const index = mockDeletedRecords.findIndex((record) => record.type === type && record.id === id);
    if (index < 0) throw new Error("El registro ya no está disponible para restauración.");
    mockDeletedRecords.splice(index, 1);
  }

  async listDocuments(
    options: ListOptions & { contextType?: string; contextId?: string } = {},
  ) {
    await wait();
    let filtered = options.contextType
      ? documents.filter((item) => item.contextType === options.contextType)
      : documents;
    if (options.contextId)
      filtered = filtered.filter(
        (item) => item.contextId === options.contextId,
      );
    if (options.search)
      filtered = filtered.filter(
        (item) =>
          includes(item.originalFileName, options.search!) ||
          includes(item.label, options.search!),
      );
    return clone(page(filtered, options));
  }

  async getDocument(id: string) {
    await wait();
    const document = documents.find((item) => item.id === id);
    if (!document) throw new Error("Documento no encontrado.");
    return clone(document);
  }

  async listDocumentHistory(
    contextType: string,
    contextId: string,
    options: Pick<ListOptions, "page" | "pageSize"> & { label?: string } = {},
  ) {
    await wait();
    const normalizedLabel = options.label?.trim().toLocaleLowerCase();
    return clone(page(
      documents.filter(
        (item) => item.contextType === contextType && item.contextId === contextId &&
          (!normalizedLabel || item.label.toLocaleLowerCase() === normalizedLabel),
      ),
      options,
    ));
  }

  async uploadDocument(input: {
    file: File;
    contextType: string;
    contextId: string;
    label: string;
    replaceDocumentId?: string | null;
    source?: "Upload" | "Scanner";
  }) {
    await wait();
    const record: DocumentRecord = {
      id: crypto.randomUUID(),
      originalFileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      sha256: "mock-sha256-upload",
      source: input.source ?? "Upload",
      contextType: input.contextType as DocumentRecord["contextType"],
      contextId: input.contextId,
      label: input.label,
      versionNumber: 1,
      previousVersionId: null,
      isCurrent: true,
      createdAtUtc: new Date().toISOString(),
      createdByUserId: users[0].id,
    };
    documents.unshift(record);
    return clone(record);
  }

  async downloadDocument(id: string) {
    await wait();
    const document = documents.find((item) => item.id === id);
    if (!document) throw new Error("Documento no encontrado.");
    return new Blob([`Vista de ${document.originalFileName}`], {
      type: document.contentType,
    });
  }

  async getDocumentReadAccess(id: string): Promise<DocumentReadAccess> {
    await wait();
    const document = documents.find((item) => item.id === id);
    if (!document) throw new Error("Documento no encontrado.");
    return {
      fileName: document.originalFileName,
      contentType: document.contentType,
      url: null,
      expiresAtUtc: null,
    };
  }

  async listActivities(options: ListOptions = {}) {
    await wait();
    return clone(page(activities, options));
  }

  async createActivity(
    input: Omit<
      Activity,
      "id" | "isCorrected" | "correctionReason" | "createdByUserId"
    >,
  ) {
    await wait();
    const activity: Activity = {
      ...input,
      id: crypto.randomUUID(),
      isCorrected: false,
      correctionReason: null,
      createdByUserId: users[0].id,
    };
    activities.unshift(activity);
    return clone(activity);
  }

  async listReports(options: Pick<ListOptions, "page" | "pageSize"> = {}) {
    await wait();
    return clone(page(weeklyReports, options));
  }
  async generateReport(start: string, end: string) {
    await wait();
    const report: WeeklyReport = {
      id: crypto.randomUUID(),
      periodStart: start,
      periodEnd: end,
      status: "Draft",
      printableHtml: "<h1>Reporte semanal</h1>",
      reviewedAtUtc: null,
      reviewedByUserId: null,
      sentAtUtc: null,
      sentByUserId: null,
      activityCount: activities.length,
      deliveries: [],
    };
    weeklyReports.unshift(report);
    return clone(report);
  }
  async reviewReport(id: string) {
    await wait();
    const report = weeklyReports.find((item) => item.id === id);
    if (!report) throw new Error("Reporte no encontrado.");
    report.status = "Reviewed";
    report.reviewedAtUtc = new Date().toISOString();
    report.reviewedByUserId = users[0].id;
    return clone(report);
  }
  async sendReport(id: string, recipients: string[], subject: string) {
    await wait();
    const report = weeklyReports.find((item) => item.id === id);
    if (!report) throw new Error("Reporte no encontrado.");
    report.status = "Sent";
    report.sentAtUtc = new Date().toISOString();
    report.sentByUserId = users[0].id;
    report.deliveries.push({
      id: crypto.randomUUID(),
      recipients: recipients.join(", "),
      subject,
      status: "Sent",
      attemptedAtUtc: new Date().toISOString(),
      errorMessage: null,
    });
    return clone(report);
  }

  async listUsers(options: UserListOptions = {}) {
    await wait();
    const filtered = users.filter((item) =>
      (options.lifecycle === "deleted" ? item.isDeleted : !item.isDeleted) &&
      (options.personType === "student" ? item.roles.includes("Alumno") : options.personType === "staff" ? !item.roles.includes("Alumno") : true) &&
      (!options.search || includes(item.fullName, options.search) || includes(item.email, options.search)));
    return clone(page(filtered, options));
  }
  async listRoles() {
    await wait();
    return clone(mockRoles);
  }
  async createUser(input: CreateUserInput) {
    await wait();
    const created: UserSummary = {
      id: crypto.randomUUID(),
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      isActive: input.isActive,
      isDeleted: false,
      participationStartDate: input.participationStartDate,
      participationEndDate: input.participationEndDate,
      photoDocumentId: null,
      roles: mockRoles
        .filter((role) => input.roleIds.includes(role.id))
        .map((role) => role.name),
      accessStatus: "Active",
    };
    users.unshift(created);
    return clone(created);
  }
  async updateUser(id: string, input: UserWriteInput) {
    await wait();
    const user = users.find((item) => item.id === id);
    if (!user) throw new Error("Usuario no encontrado.");
    Object.assign(user, input, {
      accessStatus: input.isActive ? "Active" : "Suspended",
      roles: mockRoles
        .filter((role) => input.roleIds.includes(role.id))
        .map((role) => role.name),
    });
    return clone(user);
  }
  async deactivateUser(id: string) {
    await wait();
    const user = users.find((item) => item.id === id);
    if (user) { user.isActive = false; user.isDeleted = true; user.accessStatus = "Deleted"; }
  }
  async setUserAccess(id: string, isActive: boolean) {
    await wait();
    const user = users.find((item) => item.id === id);
    if (!user || user.isDeleted) throw new Error("La cuenta no está disponible.");
    user.isActive = isActive;
    user.accessStatus = isActive ? "Active" : "Suspended";
    return clone(user);
  }
  async restoreUser(id: string) {
    await wait();
    const user = users.find((item) => item.id === id);
    if (!user || !user.isDeleted) throw new Error("La cuenta no está en eliminados.");
    user.isDeleted = false;
    user.isActive = false;
    user.accessStatus = "Suspended";
    return clone(user);
  }
  async purgeUser(id: string) {
    await wait();
    const index = users.findIndex((item) => item.id === id && item.isDeleted);
    if (index < 0) throw new Error("La cuenta no está en eliminados.");
    users.splice(index, 1);
  }
  async resetUserPassword() {
    await wait();
  }
  async setUserPhoto(id: string, file: File) {
    const document = await this.uploadDocument({
      file,
      contextType: "UserPhoto",
      contextId: id,
      label: "Fotografía de perfil",
    });
    const user = users.find((item) => item.id === id);
    if (!user) throw new Error("Usuario no encontrado.");
    user.photoDocumentId = document.id;
    return clone(user);
  }
  async getCurrentUser() {
    await wait();
    return clone(users[0]);
  }
  async updateOwnProfile(input: { fullName: string; email: string }) {
    await wait();
    Object.assign(users[0], input);
    return clone(users[0]);
  }
  async setOwnPhoto(file: File) {
    return this.setUserPhoto(users[0].id, file);
  }
  async changeOwnPassword() {
    await wait();
  }
  async createScanSession(input: {
    contextType: string;
    contextId: string;
    label: string;
    replaceDocumentId?: string | null;
    acquisitionProvider: string;
    deviceId?: string | null;
    deviceName?: string | null;
    resolutionDpi?: number | null;
    colorMode?: string | null;
    duplex?: boolean | null;
  }) {
    await wait();
    const now = new Date().toISOString();
    const session: ScanSession = {
      id: crypto.randomUUID(),
      status: "Created",
      contextType: input.contextType as DocumentRecord["contextType"],
      contextId: input.contextId,
      label: input.label,
      replaceDocumentId: input.replaceDocumentId ?? null,
      acquisitionProvider: input.acquisitionProvider,
      deviceId: input.deviceId ?? null,
      deviceName: input.deviceName ?? null,
      resolutionDpi: input.resolutionDpi ?? null,
      colorMode: input.colorMode ?? null,
      duplex: input.duplex ?? null,
      expiresAtUtc: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      capturedAtUtc: null,
      previewedAtUtc: null,
      capturedFileName: null,
      capturedContentType: null,
      capturedSizeBytes: null,
      capturedSha256: null,
      pageCount: 0,
      documentId: null,
      completedAtUtc: null,
      cancelledAtUtc: null,
      failureCode: null,
      failureMessage: null,
      createdByUserId: users[0].id,
      createdAtUtc: now,
      lastSavedAtUtc: now,
      pages: [],
    };
    mockScanSessions.set(session.id, session);
    return clone(session);
  }
  async listScanDrafts() {
    await wait();
    return clone(
      [...mockScanSessions.values()].filter(
        (item) => item.status === "Created" || item.status === "Captured",
      ),
    );
  }
  async getScanSession(id: string) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    return clone(session);
  }
  async addScanPage(
    id: string,
    file: File,
    input: {
      clientPageId: string;
      source: ScanPageSource;
      widthPixels?: number | null;
      heightPixels?: number | null;
    },
  ) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.pages.push({
      id: crypto.randomUUID(),
      clientPageId: input.clientPageId,
      position: session.pages.length,
      source: input.source,
      status: "Ready",
      originalFileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      sha256: "mock",
      sourcePageNumber: null,
      widthPixels: input.widthPixels ?? null,
      heightPixels: input.heightPixels ?? null,
      rotationDegrees: 0,
      createdAtUtc: new Date().toISOString(),
      createdByUserId: users[0].id,
    });
    session.status = "Captured";
    session.pageCount = session.pages.length;
    session.capturedAtUtc = new Date().toISOString();
    session.lastSavedAtUtc = new Date().toISOString();
    return clone(session);
  }
  async openScanPage() {
    await wait();
    return new Blob(["mock-page"], { type: "image/jpeg" });
  }
  async reorderScanPages(id: string, pageIds: string[]) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.pages = pageIds.map((pageId, position) => ({
      ...session.pages.find((page) => page.id === pageId)!,
      position,
    }));
    session.lastSavedAtUtc = new Date().toISOString();
    return clone(session);
  }
  async rotateScanPage(id: string, pageId: string, rotationDegrees: number) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    const page = session.pages.find((item) => item.id === pageId);
    if (!page) throw new Error("Página no encontrada.");
    page.rotationDegrees = rotationDegrees;
    session.lastSavedAtUtc = new Date().toISOString();
    return clone(session);
  }
  async removeScanPage(id: string, pageId: string) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.pages = session.pages
      .filter((page) => page.id !== pageId)
      .map((page, position) => ({ ...page, position }));
    session.pageCount = session.pages.length;
    session.lastSavedAtUtc = new Date().toISOString();
    return clone(session);
  }
  async saveScanDraft(id: string) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.lastSavedAtUtc = new Date().toISOString();
    return clone(session);
  }
  async captureScanSession(id: string, file: File, pageCount = 1) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    Object.assign(session, {
      status: "Captured",
      capturedAtUtc: new Date().toISOString(),
      capturedFileName: file.name,
      capturedContentType: file.type,
      capturedSizeBytes: file.size,
      pageCount,
    });
    return clone(session);
  }
  async previewScanSession(id: string) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.previewedAtUtc = new Date().toISOString();
    return new Blob(["preview"], {
      type: session.capturedContentType ?? "image/png",
    });
  }
  async completeScanSession(id: string) {
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.status = "Completed";
    session.completedAtUtc = new Date().toISOString();
    const file = new File(["scan"], session.capturedFileName ?? "scan.png", {
      type: session.capturedContentType ?? "image/png",
    });
    const document = await this.uploadDocument({
      file,
      contextType: session.contextType,
      contextId: session.contextId,
      label: session.label,
      source: "Scanner",
    });
    session.documentId = document.id;
    return document;
  }
  async cancelScanSession(id: string) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.status = "Cancelled";
    session.cancelledAtUtc = new Date().toISOString();
    return clone(session);
  }
  async reportScanFailure(id: string, code: string, message: string) {
    await wait();
    const session = mockScanSessions.get(id);
    if (!session) throw new Error("Sesión no encontrada.");
    session.status = "Failed";
    session.failureCode = code;
    session.failureMessage = message;
    return clone(session);
  }
  async listAudit(
    options: ListOptions & { entityType?: string; userId?: string } = {},
  ) {
    await wait();
    let filtered = options.entityType
      ? auditLogs.filter((item) => item.entityType === options.entityType)
      : auditLogs;
    if (options.userId)
      filtered = filtered.filter((item) => item.userId === options.userId);
    return clone(page(filtered, options));
  }
  async listRetentionCandidates(options: ListOptions = {}) {
    await wait();
    return clone(page(retentionCandidates, options));
  }

  async search(term: string) {
    await wait();
    const results: SearchResult[] = [
      ...clients
        .filter((item) => includes(item.fullName, term))
        .map((item) => ({
          id: item.id,
          resultType: "Client" as const,
          displayName: item.fullName,
          secondaryText: item.receptionNumber,
          relatedCaseId:
            caseSummaries.find((legalCase) => legalCase.clientId === item.id)
              ?.id ?? null,
          caseStatus:
            caseSummaries.find((legalCase) => legalCase.clientId === item.id)
              ?.status ?? null,
          lastStep:
            caseSummaries.find((legalCase) => legalCase.clientId === item.id)
              ?.lastStep?.title ?? null,
        })),
      ...students
        .filter((item) => includes(item.fullName, term))
        .map((item) => ({
          id: item.id,
          resultType: "Student" as const,
          displayName: item.fullName,
          secondaryText: item.studentCardNumber,
          relatedCaseId:
            caseSummaries.find((legalCase) =>
              legalCase.assignments.some(
                (assignment) => assignment.studentId === item.id,
              ),
            )?.id ?? null,
          caseStatus: null,
          lastStep: null,
        })),
      ...caseSummaries
        .filter(
          (item) =>
            includes(item.caseNumber, term) ||
            includes(item.processTypeName, term),
        )
        .map((item) => ({
          id: item.id,
          resultType: "LegalCase" as const,
          displayName: item.caseNumber,
          secondaryText: `${item.clientName} · ${item.processTypeName}`,
          relatedCaseId: item.id,
          caseStatus: item.status,
          lastStep: item.lastStep?.title ?? null,
        })),
    ];
    return clone(page(results));
  }
}

const baseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5103/api/v1"
).replace(/\/$/, "");
const readinessUrl = new URL(
  "../../health/ready",
  `${new URL(baseUrl, typeof window === "undefined" ? "http://127.0.0.1:5173" : window.location.origin).toString()}/`,
).toString();

class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  private get session(): TokenResponse | null {
    return readAuthSession();
  }

  setSession(value: TokenResponse | null) {
    writeAuthSession(value);
  }

  currentUserId() {
    return this.session?.user.id ?? null;
  }

  async request<T>(
    path: string,
    init: RequestInit = {},
    anonymous = false,
    retried = false,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("X-Sede-Code")) headers.set("X-Sede-Code", this.session?.user.tenantCode ?? "peten");
    if (!(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (!anonymous && this.session?.accessToken)
      headers.set("Authorization", `Bearer ${this.session.accessToken}`);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch (cause) {
      throw new Error(humanizeOperationError(cause));
    }
    if (
      response.status === 401 &&
      !anonymous &&
      !retried &&
      (await this.refreshSession())
    ) {
      return this.request<T>(path, init, false, true);
    }
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as {
        detail?: string;
        title?: string;
      } | null;
      const message = problem?.detail ?? problem?.title ?? "No se pudo completar la solicitud.";
      const userMessage = humanizeOperationError(new Error(message));
      if (userMessage !== message) console.error("API operation failed", { path, status: response.status, message });
      throw new Error(userMessage);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async requestBlob(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<Blob> {
    const headers = new Headers(init.headers);
    headers.set("X-Sede-Code", this.session?.user.tenantCode ?? "peten");
    if (this.session?.accessToken)
      headers.set("Authorization", `Bearer ${this.session.accessToken}`);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch (cause) {
      throw new Error(humanizeOperationError(cause));
    }
    if (response.status === 401 && !retried && (await this.refreshSession()))
      return this.requestBlob(path, init, true);
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as {
        detail?: string;
        title?: string;
      } | null;
      const message = problem?.detail ?? problem?.title ?? "No se pudo completar la solicitud.";
      const userMessage = humanizeOperationError(new Error(message));
      if (userMessage !== message) console.error("API document request failed", { path, status: response.status, message });
      throw new Error(userMessage);
    }
    return response.blob();
  }

  private async refreshSession() {
    if (this.refreshPromise) return this.refreshPromise;
    const current = this.session;
    if (!current?.refreshToken) return false;
    this.refreshPromise = fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sede-Code": current.user.tenantCode ?? "peten" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
      .then(async (response) => {
        if ([400, 401, 403].includes(response.status)) {
          this.setSession(null);
          window.dispatchEvent(new Event("bufete:session-expired"));
          return false;
        }
        if (!response.ok)
          throw new Error("El servidor no pudo renovar la sesión en este momento.");
        this.setSession((await response.json()) as TokenResponse);
        return true;
      })
      .catch((cause: unknown) => {
        throw new Error(humanizeOperationError(cause));
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }
}

export const platformApi = new ApiClient();

class ApiDataSource implements DataSource {
  readonly mode = "api" as const;
  private readonly api = platformApi;
  private readonly reportCache: WeeklyReport[] = [];
  async getPlatformHealth(): Promise<PlatformHealth> {
    let response: Response;
    try {
      response = await fetch(readinessUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
    } catch (cause) {
      throw new Error(humanizeOperationError(cause));
    }
    if (!response.ok) throw new Error("Los servicios no están disponibles.");
    return response.json() as Promise<PlatformHealth>;
  }
  async login(email: string, password: string, tenantCode = "peten") {
    const result = await this.api.request<TokenResponse>(
      "/auth/login",
      { method: "POST", headers: { "X-Sede-Code": tenantCode.trim().toLowerCase() }, body: JSON.stringify({ email, password }) },
      true,
    );
    this.api.setSession(result);
    return result;
  }
  async logout() {
    const session = readAuthSession();
    if (session) {
      await this.api
        .request<void>("/auth/revoke", {
          method: "POST",
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        })
        .catch(() => undefined);
    }
    this.api.setSession(null);
  }
  async getDashboard() {
    return this.api.request<DashboardData>("/dashboard");
  }
  listClients(options: ListOptions = {}) {
    return this.api.request<PagedResult<Client>>(`/clients?${query(options)}`);
  }
  getClient(id: string) {
    return this.api.request<ClientProfile>(`/clients/${id}/profile`);
  }
  createClient(input: Record<string, unknown>) {
    return this.api.request<Client>("/clients", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateClient(id: string, input: Record<string, unknown>) {
    return this.api.request<Client>(`/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  setClientAttention(id: string, isActive: boolean, concurrencyToken: string) {
    return this.api.request<Client>(`/clients/${id}/attention`, {
      method: "PUT", body: JSON.stringify({ isActive, concurrencyToken }),
    });
  }
  deleteClient(id: string, reason?: string) {
    return this.api.request<void>(`/clients/${id}`, { method: "DELETE", body: JSON.stringify({ reason: reason || null }) });
  }
  createIncomeDeclaration(clientId: string, input: Record<string, unknown>) {
    return this.api.request(`/clients/${clientId}/income-declarations`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  getIncomeDeclarationPrint(id: string) {
    return this.api.requestBlob(`/clients/income-declarations/${id}/print`);
  }
  listStudents(options: ListOptions = {}) {
    return this.api.request<PagedResult<Student>>(
      `/students?${query(options)}`,
    );
  }
  listStudentAssignmentCandidates(caseId: string, search = "") {
    const parameters = new URLSearchParams({ caseId });
    if (search.trim()) parameters.set("search", search.trim());
    parameters.set("page", "1");
    parameters.set("pageSize", "50");
    return this.api.request<PagedResult<StudentAssignmentCandidate>>(`/students/assignment-candidates?${parameters}`);
  }
  getStudent(id: string) {
    return this.api.request<StudentProfile>(`/students/${id}/profile`);
  }
  registerStudent(input: Record<string, unknown>) {
    return this.api.request<StudentRegistration>("/students/registration", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  provisionStudentAccess(studentId: string, input: Record<string, unknown>) {
    return this.api.request<StudentAccess>(`/students/${studentId}/access`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateStudent(id: string, input: Record<string, unknown>) {
    return this.api.request<Student>(`/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  setStudentActive(id: string, isActive: boolean) {
    return this.api.request<Student>(`/students/${id}/active`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    });
  }
  deleteStudent(id: string, reason?: string) {
    return this.api.request<void>(`/students/${id}`, { method: "DELETE", body: JSON.stringify({ reason: reason || null }) });
  }
  createEnrollment(studentId: string, input: Record<string, unknown>) {
    return this.api.request(`/students/${studentId}/enrollments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  changeEnrollmentStatus(enrollmentId: string, input: Record<string, unknown>) {
    return this.api.request(`/students/enrollments/${enrollmentId}/status`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  updateStudentRequirement(
    enrollmentId: string,
    requirementId: string,
    input: Record<string, unknown>,
  ) {
    return this.api.request(
      `/students/enrollments/${enrollmentId}/requirements/${requirementId}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  }
  issueClinicCard(enrollmentId: string, input: Record<string, unknown>) {
    return this.api.request(
      `/students/enrollments/${enrollmentId}/clinic-card`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  }
  listCases(options: ListOptions & { status?: CaseStatus } = {}) {
    return this.api.request<PagedResult<CaseSummary>>(
      `/cases?${query(options)}`,
    );
  }
  getCase(id: string) {
    return this.api.request<CaseDetail>(`/cases/${id}`);
  }
  updateCase(id: string, input: { status: CaseStatus; stage: string; concurrencyToken: string }) {
    return this.api.request<CaseDetail>(`/cases/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  listProcessTypes() {
    return this.api.request<ProcessType[]>("/catalogs/process-types");
  }
  createProcessType(input: Omit<ProcessType, "id" | "requirements">) {
    return this.api.request<ProcessType>("/catalogs/process-types", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateProcessType(
    id: string,
    input: Omit<ProcessType, "id" | "requirements">,
  ) {
    return this.api.request<ProcessType>(`/catalogs/process-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  createRequirement(input: Omit<RequirementDefinition, "id">) {
    return this.api.request<RequirementDefinition>("/catalogs/requirements", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateRequirement(id: string, input: Omit<RequirementDefinition, "id">) {
    return this.api.request<RequirementDefinition>(
      `/catalogs/requirements/${id}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  }
  openCase(input: {
    clientId: string;
    processTypeId: string;
    initialStage?: string | null;
    counterparties?: Array<Record<string, unknown>>;
  }) {
    return this.api.request<CaseDetail>("/cases", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  assignStudent(caseId: string, studentId: string, isPrimary: boolean) {
    return this.api.request(`/cases/${caseId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ studentId, isPrimary }),
    });
  }
  endAssignment(caseId: string, assignmentId: string, reason: string) {
    return this.api.request<void>(`/cases/${caseId}/assignments/${assignmentId}/end`, {
      method: "PUT",
      body: JSON.stringify({ status: "Cancelled", reason }),
    });
  }
  addTimelineEntry(caseId: string, input: Record<string, unknown>) {
    return this.api.request(`/cases/${caseId}/timeline`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateCaseRequirement(
    caseId: string,
    requirementId: string,
    input: Record<string, unknown>,
  ) {
    return this.api.request(`/cases/${caseId}/requirements/${requirementId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  addCounterparty(caseId: string, input: Record<string, unknown>) {
    return this.api.request(`/cases/${caseId}/counterparties`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateCounterparty(
    caseId: string,
    counterpartyId: string,
    input: Record<string, unknown>,
  ) {
    return this.api.request(`/cases/${caseId}/counterparties/${counterpartyId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  createMemorial(caseId: string, input: Record<string, unknown>) {
    return this.api.request(`/cases/${caseId}/memorials`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  addMemorialVersion(
    caseId: string,
    memorialId: string,
    input: Record<string, unknown>,
  ) {
    return this.api.request(
      `/cases/${caseId}/memorials/${memorialId}/versions`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }
  reviewMemorial(
    caseId: string,
    memorialId: string,
    input: Record<string, unknown>,
  ) {
    return this.api.request(
      `/cases/${caseId}/memorials/${memorialId}/reviews`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }
  presentMemorial(
    caseId: string,
    memorialId: string,
    input: Record<string, unknown>,
  ) {
    return this.api.request(
      `/cases/${caseId}/memorials/${memorialId}/presentation`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }
  addCourtNotification(caseId: string, input: Record<string, unknown>) {
    return this.api.request(`/cases/${caseId}/court-notifications`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  closeCase(caseId: string, input: Record<string, unknown>) {
    return this.api.request<void>(`/cases/${caseId}/close`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  reopenCase(caseId: string, reason: string) {
    return this.api.request<void>(`/cases/${caseId}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }
  deleteCase(id: string, reason?: string) {
    return this.api.request<void>(`/cases/${id}`, { method: "DELETE", body: JSON.stringify({ reason: reason || null }) });
  }
  listDeletedRecords(options: ListOptions & { type?: DeletedRecordType } = {}) {
    return this.api.request<PagedResult<DeletedRecord>>(`/deleted-records?${query(options)}`);
  }
  restoreDeletedRecord(type: DeletedRecordType, id: string) {
    return this.api.request<void>(`/deleted-records/${type}/${id}/restore`, { method: "POST" });
  }
  listDocuments(
    options: ListOptions & { contextType?: string; contextId?: string } = {},
  ) {
    return this.api.request<PagedResult<DocumentRecord>>(
      `/documents?${query(options)}`,
    );
  }
  getDocument(id: string) {
    return this.api.request<DocumentRecord>(`/documents/${id}`);
  }
  listDocumentHistory(
    contextType: string,
    contextId: string,
    options: Pick<ListOptions, "page" | "pageSize"> & { label?: string } = {},
  ) {
    return this.api.request<PagedResult<DocumentRecord>>(
      `/documents/context/${encodeURIComponent(contextType)}/${encodeURIComponent(contextId)}/history?${query(options)}`,
    );
  }
  uploadDocument(input: {
    file: File;
    contextType: string;
    contextId: string;
    label: string;
    replaceDocumentId?: string | null;
    source?: "Upload" | "Scanner";
  }) {
    const form = new FormData();
    form.set("file", input.file);
    form.set("source", input.source ?? "Upload");
    form.set("contextType", input.contextType);
    form.set("contextId", input.contextId);
    form.set("label", input.label);
    if (input.replaceDocumentId)
      form.set("replaceDocumentId", input.replaceDocumentId);
    return this.api.request<DocumentRecord>("/documents", {
      method: "POST",
      body: form,
    });
  }
  downloadDocument(id: string) {
    return this.api.requestBlob(`/documents/${id}/content`);
  }
  getDocumentReadAccess(id: string) {
    return this.api.request<DocumentReadAccess>(`/documents/${id}/access`);
  }
  listActivities(
    options: ListOptions & { from?: string; to?: string; userId?: string } = {},
  ) {
    return this.api.request<PagedResult<Activity>>(
      `/activities?${query(options)}`,
    );
  }
  createActivity(
    input: Omit<
      Activity,
      "id" | "isCorrected" | "correctionReason" | "createdByUserId"
    >,
  ) {
    return this.api.request<Activity>("/activities", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  async listReports(options: Pick<ListOptions, "page" | "pageSize"> = {}) {
    const reports = await this.api.request<PagedResult<WeeklyReport>>(`/reports?${query(options)}`);
    this.reportCache.splice(0, this.reportCache.length, ...reports.items);
    return reports;
  }
  async generateReport(start: string, end: string) {
    const report = await this.api.request<WeeklyReport>("/reports/weekly", {
      method: "POST",
      body: JSON.stringify({ start, end }),
    });
    this.reportCache.unshift(report);
    return report;
  }
  async reviewReport(id: string) {
    const report = await this.api.request<WeeklyReport>(
      `/reports/${id}/review`,
      { method: "POST" },
    );
    this.updateReportCache(report);
    return report;
  }
  async sendReport(
    id: string,
    recipients: string[],
    subject: string,
    message?: string,
  ) {
    const report = await this.api.request<WeeklyReport>(`/reports/${id}/send`, {
      method: "POST",
      body: JSON.stringify({ recipients, subject, message }),
    });
    this.updateReportCache(report);
    return report;
  }
  listUsers(options: UserListOptions = {}) {
    return this.api.request<PagedResult<UserSummary>>(
      `/users?${query(options)}`,
    );
  }
  listRoles() {
    return this.api.request<Role[]>("/roles");
  }
  createUser(input: CreateUserInput) {
    return this.api.request<UserSummary>("/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateUser(id: string, input: UserWriteInput) {
    return this.api.request<UserSummary>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  deactivateUser(id: string) {
    return this.api.request<void>(`/users/${id}`, { method: "DELETE" });
  }
  setUserAccess(id: string, isActive: boolean) {
    return this.api.request<UserSummary>(`/users/${id}/access`, { method: "PUT", body: JSON.stringify({ isActive }) });
  }
  restoreUser(id: string) {
    return this.api.request<UserSummary>(`/users/${id}/restore`, { method: "POST" });
  }
  purgeUser(id: string) {
    return this.api.request<void>(`/users/${id}/permanent`, { method: "DELETE" });
  }
  resetUserPassword(id: string, password: string) {
    return this.api.request<void>(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword: password }),
    });
  }
  async setUserPhoto(id: string, file: File) {
    const document = await this.uploadDocument({
      file,
      contextType: "UserPhoto",
      contextId: id,
      label: "Fotografía de perfil",
    });
    return this.api.request<UserSummary>(`/users/${id}/photo`, {
      method: "PUT",
      body: JSON.stringify({ documentId: document.id }),
    });
  }
  getCurrentUser() {
    return this.api.request<UserSummary>("/auth/me");
  }
  updateOwnProfile(input: { fullName: string; email: string }) {
    return this.api.request<UserSummary>("/users/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }
  async setOwnPhoto(file: File) {
    const userId = this.api.currentUserId();
    if (!userId) throw new Error("No existe una sesión activa.");
    const document = await this.uploadDocument({
      file,
      contextType: "UserPhoto",
      contextId: userId,
      label: "Fotografía de perfil",
    });
    return this.api.request<UserSummary>("/users/me/photo", {
      method: "PUT",
      body: JSON.stringify({ documentId: document.id }),
    });
  }
  changeOwnPassword(currentPassword: string, newPassword: string) {
    return this.api.request<void>("/users/me/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }
  createScanSession(input: {
    contextType: string;
    contextId: string;
    label: string;
    replaceDocumentId?: string | null;
    acquisitionProvider: string;
    deviceId?: string | null;
    deviceName?: string | null;
    resolutionDpi?: number | null;
    colorMode?: string | null;
    duplex?: boolean | null;
  }) {
    return this.api.request<ScanSession>("/scan-sessions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  listScanDrafts() {
    return this.api.request<ScanSession[]>("/scan-sessions");
  }
  getScanSession(id: string) {
    return this.api.request<ScanSession>(`/scan-sessions/${id}`);
  }
  addScanPage(
    id: string,
    file: File,
    input: {
      clientPageId: string;
      source: ScanPageSource;
      widthPixels?: number | null;
      heightPixels?: number | null;
    },
  ) {
    const form = new FormData();
    form.set("file", file);
    form.set("clientPageId", input.clientPageId);
    form.set("source", input.source);
    if (input.widthPixels) form.set("widthPixels", String(input.widthPixels));
    if (input.heightPixels)
      form.set("heightPixels", String(input.heightPixels));
    return this.api.request<ScanSession>(`/scan-sessions/${id}/pages`, {
      method: "POST",
      body: form,
    });
  }
  openScanPage(id: string, pageId: string) {
    return this.api.requestBlob(`/scan-sessions/${id}/pages/${pageId}/content`);
  }
  reorderScanPages(id: string, pageIds: string[]) {
    return this.api.request<ScanSession>(`/scan-sessions/${id}/pages/order`, {
      method: "PUT",
      body: JSON.stringify({ pageIds }),
    });
  }
  rotateScanPage(id: string, pageId: string, rotationDegrees: number) {
    return this.api.request<ScanSession>(
      `/scan-sessions/${id}/pages/${pageId}/rotation`,
      { method: "PUT", body: JSON.stringify({ rotationDegrees }) },
    );
  }
  removeScanPage(id: string, pageId: string) {
    return this.api.request<ScanSession>(
      `/scan-sessions/${id}/pages/${pageId}`,
      { method: "DELETE" },
    );
  }
  saveScanDraft(id: string) {
    return this.api.request<ScanSession>(`/scan-sessions/${id}/draft`, {
      method: "POST",
    });
  }
  captureScanSession(id: string, file: File, pageCount = 1) {
    const form = new FormData();
    form.set("file", file);
    form.set("pageCount", String(pageCount));
    return this.api.request<ScanSession>(`/scan-sessions/${id}/capture`, {
      method: "POST",
      body: form,
    });
  }
  previewScanSession(id: string) {
    return this.api.requestBlob(`/scan-sessions/${id}/preview`);
  }
  completeScanSession(id: string) {
    return this.api.request<DocumentRecord>(`/scan-sessions/${id}/complete`, {
      method: "POST",
    });
  }
  cancelScanSession(id: string) {
    return this.api.request<ScanSession>(`/scan-sessions/${id}/cancel`, {
      method: "POST",
    });
  }
  reportScanFailure(id: string, code: string, message: string) {
    return this.api.request<ScanSession>(`/scan-sessions/${id}/failure`, {
      method: "POST",
      body: JSON.stringify({ code, message }),
    });
  }
  listAudit(
    options: ListOptions & { entityType?: string; userId?: string } = {},
  ) {
    return this.api.request<PagedResult<AuditLog>>(`/audit?${query(options)}`);
  }
  listRetentionCandidates(options: ListOptions = {}) {
    return this.api.request<PagedResult<RetentionCandidate>>(
      `/retention/candidates?${query(options)}`,
    );
  }
  search(term: string) {
    return this.api.request<PagedResult<SearchResult>>(
      `/search?${query({ term })}`,
    );
  }

  private updateReportCache(report: WeeklyReport) {
    const index = this.reportCache.findIndex((item) => item.id === report.id);
    if (index >= 0) this.reportCache[index] = report;
    else this.reportCache.unshift(report);
  }
}

function query(values: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(
    values as Record<string, unknown>,
  )) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  if (!params.has("page")) params.set("page", "1");
  if (!params.has("pageSize")) params.set("pageSize", "25");
  return params.toString();
}

const source: DataSource = mockMode
  ? new MockDataSource()
  : demoEnabled ? createDemoSource() : new ApiDataSource();

export const dataSource: DataSource = new Proxy(source, {
  get(target, property) {
    const member = Reflect.get(target, property, target);
    if (typeof member !== "function") return member;
    return (...args: unknown[]) => {
      const invoke = () => Promise.resolve(member.apply(target, args));
      return typeof property === "string" && hasOperationFeedback(property) && !isOperationFeedbackHandled(args)
        ? withOperationFeedback(property, args, invoke)
        : member.apply(target, args);
    };
  },
});
