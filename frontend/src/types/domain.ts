export type Id = string;

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AuthenticatedUser {
  id: Id;
  username: string;
  email: string;
  fullName: string;
  photoDocumentId: Id | null;
  roles: string[];
  permissions: string[];
}

export interface TokenResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: AuthenticatedUser;
}

export type DeletedRecordType = "Client" | "Student" | "LegalCase";

export interface DeletedRecord {
  id: Id;
  type: DeletedRecordType;
  name: string;
  reference: string;
  deletedAtUtc: string;
  deletedByUserId: Id | null;
  deletedByName: string | null;
  reason: string | null;
}

export type CaseStatus = 'DocumentCollection' | 'Active' | 'Suspended' | 'Closed' | 'Archived';
export type RequirementStatus = 'Pending' | 'Submitted' | 'Accepted' | 'Observed' | 'Expired' | 'NotApplicable';
export type EnrollmentStatus = 'Draft' | 'Submitted' | 'Admitted' | 'UnderReview' | 'Observed' | 'Approved' | 'Rejected' | 'Completed';
export type MemorialStatus = 'Received' | 'UnderReview' | 'RequiresCorrection' | 'Corrected' | 'ApprovedForSignature' | 'Presented';
export type TimelineType = 'CaseOpened' | 'RequirementUpdated' | 'Assignment' | 'Memorial' | 'MemorialReview' | 'Presentation' | 'CourtNotification' | 'GeneralAction' | 'StatusChange' | 'Closure' | 'Reopening';

export interface TimelineEntry {
  id: Id;
  type: TimelineType;
  occurredAtUtc: string;
  title: string;
  description: string | null;
  performedByStudentId: Id | null;
  documentId: Id | null;
  createdByUserId: Id | null;
}

export interface CaseAssignment {
  id: Id;
  studentId: Id;
  studentName: string;
  studentPhotoDocumentId?: Id | null;
  isPrimary: boolean;
  status: 'Active' | 'Completed' | 'Reassigned' | 'Cancelled';
  assignedAtUtc: string;
  endedAtUtc: string | null;
  endReason: string | null;
}

export interface CaseSummary {
  id: Id;
  caseNumber: string;
  clientId: Id;
  clientName: string;
  processTypeId: Id;
  processTypeName: string;
  status: CaseStatus;
  stage: string;
  openedAtUtc: string;
  closedAtUtc: string | null;
  lastStep: TimelineEntry | null;
  assignments: CaseAssignment[];
  concurrencyToken: Id;
}

export interface CaseRequirement {
  id: Id;
  requirementDefinitionId: Id;
  label: string;
  kind: 'Document' | 'Data' | 'Condition';
  isRequired: boolean;
  isConditional: boolean;
  status: RequirementStatus;
  documentId: Id | null;
  dataValue: string | null;
  conditionMet: boolean | null;
  documentIssueDate: string | null;
  notes: string | null;
  isExpired: boolean;
}

export interface Counterparty {
  id: Id;
  fullName: string;
  dpi: string | null;
  residenceAddress: string | null;
  workAddress: string | null;
  phone: string | null;
  notes: string | null;
}

export interface MemorialReview {
  id: Id;
  outcome: 'RequiresChanges' | 'Approved';
  observations: string;
  reviewedDocumentId: Id | null;
  reviewedAtUtc: string;
  reviewedByUserId: Id | null;
}

export interface MemorialVersion {
  id: Id;
  versionNumber: number;
  documentId: Id;
  submittedByStudentId: Id | null;
  notes: string | null;
  reviews: MemorialReview[];
}

export interface Memorial {
  id: Id;
  title: string;
  status: MemorialStatus;
  versions: MemorialVersion[];
}

export interface CasePresentation {
  id: Id;
  memorialId: Id;
  memorialTitle: string;
  memorialVersionId: Id;
  presentedAtUtc: string;
  result: string;
  presentedDocumentId: Id | null;
  receiptDocumentId: Id | null;
  createdByUserId: Id | null;
}

export interface CourtNotification {
  id: Id;
  notifiedAtUtc: string;
  description: string;
  documentId: Id;
  newStage: string | null;
  createdByUserId: Id | null;
}

export interface CaseDetail {
  summary: CaseSummary;
  requirements: CaseRequirement[];
  counterparties: Counterparty[];
  timeline: TimelineEntry[];
  memorials: Memorial[];
  presentations: CasePresentation[];
  courtNotifications: CourtNotification[];
}

export interface Client {
  id: Id;
  receptionNumber: string;
  fullName: string;
  birthDate: string | null;
  ageAtReception: number | null;
  birthPlace: string | null;
  nationality: string | null;
  sex: string | null;
  maritalStatus: string | null;
  dpi: string | null;
  residenceAddress: string;
  education: string | null;
  occupation: string | null;
  workplace: string | null;
  workAddress: string | null;
  workPhone: string | null;
  phone: string | null;
  mobilePhone: string | null;
  salaryAmount: number | null;
  salaryFrequency: string | null;
  childrenCount: number;
  assistanceRequested: string;
  claimedAgainstPersonName: string | null;
  claimedAgainstPersonAddress: string | null;
  receptionPlace: string;
  receptionDate: string;
  signatureDocumentId: Id | null;
  isActive: boolean;
  createdAtUtc: string;
  concurrencyToken: Id;
}

export interface IncomeDeclaration {
  id: Id;
  clientId: Id;
  fullName: string;
  declaredAge: number | null;
  maritalStatus: string | null;
  sex: string | null;
  dpi: string | null;
  occupation: string | null;
  nationality: string | null;
  residenceAddress: string;
  phone: string | null;
  mobilePhone: string | null;
  workplace: string | null;
  workAddress: string | null;
  salaryAmount: number | null;
  salaryFrequency: string | null;
  place: string;
  declarationDate: string;
  declaresLimitedResources: boolean;
  generatedDocumentId: Id | null;
  signedDocumentId: Id | null;
}

export interface ClientProfile {
  client: Client;
  incomeDeclarations: IncomeDeclaration[];
  cases: Array<Pick<CaseSummary, 'id' | 'caseNumber' | 'status' | 'stage'> & {
    processType: string;
    lastStep: string | null;
    lastStepAtUtc: string | null;
  }>;
}

export interface Student {
  id: Id;
  userAccountId: Id | null;
  photoDocumentId?: Id | null;
  fullName: string;
  birthDate: string | null;
  ageAtRegistration: number | null;
  studentCardNumber: string;
  dpi: string;
  semester: number | null;
  studyShift: string | null;
  workplace: string | null;
  workPhone: string | null;
  immediateSupervisor: string | null;
  jobTitle: string | null;
  residenceAddress: string;
  mobilePhone: string | null;
  homePhone: string | null;
  email: string;
  registrationDate: string;
  isActive: boolean;
  concurrencyToken: Id;
}

export interface StudentAssignmentCandidate {
  id: Id;
  photoDocumentId: Id | null;
  fullName: string;
  studentCardNumber: string;
}

export interface StudentAccess {
  userAccountId: Id;
  username: string;
  email: string;
  isActive: boolean;
}

export interface StudentRegistration {
  student: Student;
  enrollment: Enrollment;
  access: StudentAccess;
}

export interface StudentRequirement {
  id: Id;
  requirementDefinitionId: Id;
  label: string;
  kind: 'Document' | 'Data' | 'Condition';
  isRequired?: boolean;
  isConditional: boolean;
  status: RequirementStatus;
  documentId: Id | null;
  dataValue: string | null;
  documentIssueDate: string | null;
  notes: string | null;
}

export interface Enrollment {
  id: Id;
  studentId: Id;
  modality: 'CivilFamilyCases' | 'ExternalInternship' | 'AdHonoremSecretariat';
  status: EnrollmentStatus;
  siteName: string | null;
  siteAddress: string | null;
  shift: string | null;
  practiceDays: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  submittedAtUtc: string | null;
  admittedAtUtc: string | null;
  resolvedAtUtc: string | null;
  resolutionNotes: string | null;
  resolutionDocumentId: Id | null;
  clinicCardNumber: string | null;
  clinicCardIssuedDate: string | null;
  clinicCardExpirationDate: string | null;
  clinicCardDeliveredAtUtc: string | null;
  requirements: StudentRequirement[];
}

export interface StudentProfile {
  student: Student;
  enrollments: Enrollment[];
  cases: Array<{
    assignmentId: Id;
    caseId: Id;
    caseNumber: string;
    clientName: string;
    processType: string;
    status: CaseStatus;
    stage: string;
    isPrimary: boolean;
    assignmentStatus: CaseAssignment["status"];
    assignedAtUtc: string;
    endedAtUtc: string | null;
    endReason: string | null;
    lastStep: string | null;
    lastStepAtUtc: string | null;
  }>;
}

export interface DocumentRecord {
  id: Id;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  source: 'Upload' | 'Scanner' | 'Generated';
  contextType: 'Client' | 'IncomeDeclaration' | 'Student' | 'Enrollment' | 'LegalCase' | 'CaseRequirement' | 'Timeline' | 'Memorial' | 'Report' | 'UserPhoto';
  contextId: Id;
  label: string;
  versionNumber: number;
  previousVersionId: Id | null;
  isCurrent: boolean;
  pageCount?: number | null;
  createdAtUtc: string;
  createdByUserId: Id | null;
}

export interface DocumentReadAccess {
  fileName: string;
  contentType: string;
  url: string | null;
  expiresAtUtc: string | null;
}

export interface Activity {
  id: Id;
  occurredAtUtc: string;
  activityType: string;
  description: string;
  clientId: Id | null;
  studentId: Id | null;
  legalCaseId: Id | null;
  isCorrected: boolean;
  correctionReason: string | null;
  createdByUserId: Id | null;
}

export interface WeeklyReport {
  id: Id;
  periodStart: string;
  periodEnd: string;
  status: 'Draft' | 'Reviewed' | 'Sent' | 'SendFailed';
  printableHtml: string;
  reviewedAtUtc: string | null;
  reviewedByUserId: Id | null;
  sentAtUtc: string | null;
  sentByUserId: Id | null;
  activityCount: number;
  deliveries: Array<{
    id: Id;
    recipients: string;
    subject: string;
    status: 'Pending' | 'Sent' | 'Failed';
    attemptedAtUtc: string;
    errorMessage: string | null;
  }>;
}

export interface AuditLog {
  id: Id;
  userId: Id | null;
  username: string | null;
  occurredAtUtc: string;
  action: string;
  entityType: string;
  entityId: string;
  changesJson: string | null;
  traceId: string | null;
  ipAddress: string | null;
}

export interface UserSummary {
  id: Id;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isDeleted: boolean;
  participationStartDate: string | null;
  participationEndDate: string | null;
  photoDocumentId: Id | null;
  roles: string[];
  accessStatus: "Active" | "Suspended" | "Scheduled" | "Expired" | "Locked" | "Deleted";
}

export interface Role {
  id: Id;
  name: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface UserWriteInput {
  email: string;
  fullName: string;
  isActive: boolean;
  participationStartDate: string | null;
  participationEndDate: string | null;
  roleIds: string[];
}

export interface CreateUserInput extends UserWriteInput {
  username: string;
  password: string;
  studentId: string | null;
}

export type ScanSessionStatus = 'Created' | 'Captured' | 'Completed' | 'Cancelled' | 'Failed' | 'Expired';

export type ScanPageSource = 'Scanner' | 'Upload' | 'PdfImport';
export type ScanPageStatus = 'Ready' | 'Removed' | 'Failed';

export interface ScanPage {
  id: Id;
  clientPageId: Id;
  position: number;
  source: ScanPageSource;
  status: ScanPageStatus;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  sourcePageNumber: number | null;
  widthPixels: number | null;
  heightPixels: number | null;
  rotationDegrees: number;
  createdAtUtc: string;
  createdByUserId: Id | null;
}

export interface ScanSession {
  id: Id;
  status: ScanSessionStatus;
  contextType: DocumentRecord['contextType'];
  contextId: Id;
  label: string;
  replaceDocumentId: Id | null;
  acquisitionProvider: string;
  deviceId: string | null;
  deviceName: string | null;
  resolutionDpi: number | null;
  colorMode: string | null;
  duplex: boolean | null;
  expiresAtUtc: string;
  capturedAtUtc: string | null;
  previewedAtUtc: string | null;
  capturedFileName: string | null;
  capturedContentType: string | null;
  capturedSizeBytes: number | null;
  capturedSha256: string | null;
  pageCount: number | null;
  documentId: Id | null;
  completedAtUtc: string | null;
  cancelledAtUtc: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdByUserId: Id | null;
  createdAtUtc: string;
  lastSavedAtUtc: string | null;
  pages: ScanPage[];
}

export interface RetentionCandidate {
  caseId: Id;
  caseNumber: string;
  clientName: string;
  retentionStartsAtUtc: string;
  eligibleAtUtc: string;
  documentCount: number;
  timelineEntryCount: number;
  reason: string;
}

export interface SearchResult {
  id: Id;
  resultType: 'Client' | 'Student' | 'LegalCase';
  displayName: string;
  secondaryText: string | null;
  relatedCaseId: Id | null;
  caseStatus: string | null;
  lastStep: string | null;
}

export interface DashboardData {
  activeCases: number;
  documentCollectionCases: number;
  activeStudents: number;
  completedRequirements: number;
  pendingRequirements: number;
  totalRequirements: number;
  weeklyActivities: number;
  completionRate: number;
  caseMovementChangePercentage: number | null;
  weeklyActivityChangePercentage: number | null;
  caseSeries: Array<{ label: string; value: number }>;
  processDistribution: Array<{ label: string; value: number; count: number }>;
  practiceTeam: Array<{
    studentId: Id;
    fullName: string;
    photoDocumentId: Id | null;
    activeCaseCount: number;
  }>;
  recentCases: CaseSummary[];
}

export interface ProcessType {
  id: Id;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  requirements: RequirementDefinition[];
}

export interface RequirementDefinition {
  id: Id;
  scope: 'LegalProcess' | 'StudentEnrollment';
  processTypeId: Id | null;
  code: string;
  label: string;
  kind: 'Document' | 'Data' | 'Condition';
  isRequired: boolean;
  isConditional: boolean;
  conditionDescription: string | null;
  documentNature: 'Original' | 'Copy' | 'Photocopy' | 'CertifiedCopy' | 'NotApplicable';
  maximumAgeDays: number | null;
  subject: string | null;
  instructions: string | null;
  sortOrder: number;
  isActive: boolean;
}
