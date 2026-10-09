import type {
  Activity,
  AuditLog,
  CaseDetail,
  ClientProfile,
  DeletedRecord,
  DocumentRecord,
  ProcessType,
  RequirementDefinition,
  Role,
  ScanSession,
  StudentProfile,
  UserSummary,
  WeeklyReport,
} from "../types/domain";
import catalogs from "./catalogs.json";

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const rootId = "6dcbdcf0-2b1c-40ec-a956-8769abb38e68";
export interface DemoState {
  version: 1;
  clients: ClientProfile[];
  students: StudentProfile[];
  cases: CaseDetail[];
  users: UserSummary[];
  passwords: Record<string, string>;
  processes: ProcessType[];
  studentDefinitions: RequirementDefinition[];
  documents: Array<DocumentRecord & { storagePath: string }>;
  scans: Array<
    ScanSession & { capturePath?: string; pagePaths: Record<string, string> }
  >;
  activities: Activity[];
  reports: WeeklyReport[];
  deleted: DeletedRecord[];
  audit: AuditLog[];
}
export const roles: Role[] = [
  {
    id: "admin",
    name: "AdministradorGeneral",
    description: "Administración de la sede",
    isSystem: true,
    isActive: true,
    permissions: ["*"],
  },
  {
    id: "secretary",
    name: "Secretaria",
    description: "Operación de la sede",
    isSystem: true,
    isActive: true,
    permissions: [
      "dashboard.read",
      "clients.read",
      "clients.write",
      "students.read",
      "students.write",
      "cases.read",
      "cases.write",
      "documents.read",
      "documents.write",
      "activities.read",
      "activities.write",
      "reports.generate",
      "reports.review",
      "reports.send",
    ],
  },
  {
    id: "student",
    name: "Alumno",
    description: "Práctica y casos propios",
    isSystem: true,
    isActive: true,
    permissions: [
      "dashboard.read",
      "students.self.read",
      "cases.assigned.read",
      "documents.read",
    ],
  },
];
export function emptyState(
  adminEmail: string,
  name = "Licenciado Demo",
): DemoState {
  return {
    version: 1,
    clients: [],
    students: [],
    cases: [],
    users: [
      {
        id: rootId,
        username: "licenciado.demo",
        email: adminEmail,
        fullName: name,
        isActive: true,
        isDeleted: false,
        participationStartDate: null,
        participationEndDate: null,
        photoDocumentId: null,
        roles: ["AdministradorGeneral"],
        accessStatus: "Active",
      },
    ],
    passwords: {},
    processes: structuredClone(catalogs.processes) as ProcessType[],
    studentDefinitions: structuredClone(
      catalogs.student,
    ) as RequirementDefinition[],
    documents: [],
    scans: [],
    activities: [],
    reports: [],
    deleted: [],
    audit: [],
  };
}
export function requireValue<T>(
  value: T | null | undefined,
  message = "Registro no encontrado en esta sede.",
): T {
  if (value === undefined || value === null) throw new DemoError(message, 404);
  return value;
}
export class DemoError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DemoError(message, status);
}
export function paged<T>(items: T[], options: Record<string, unknown> = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(options.pageSize) || 25));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalCount: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}
export const matches = (value: unknown, search: unknown) =>
  !search ||
  String(value ?? "")
    .toLocaleLowerCase("es")
    .includes(String(search).toLocaleLowerCase("es"));
export function audit(
  state: DemoState,
  user: UserSummary,
  action: string,
  entityId: string,
) {
  state.audit.unshift({
    id: id(),
    userId: user.id,
    username: user.username,
    occurredAtUtc: now(),
    action,
    entityType: "Demo",
    entityId,
    changesJson: null,
    traceId: id(),
    ipAddress: null,
  });
}
