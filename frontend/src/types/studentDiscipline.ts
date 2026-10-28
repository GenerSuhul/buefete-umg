export type StudentDisciplineKind = 'WrittenWarning' | 'SixMonthSuspension' | 'PermanentSuspension';
export interface StudentDiscipline {
  id: string; dpi: string; studentName: string; kind: StudentDisciplineKind;
  reason: string; startsOn: string | null; endsOn: string | null;
  documentId: string | null; sourceTenantCode: string; issuedByName: string;
  createdAtUtc: string; revokedAtUtc: string | null; revocationReason: string | null;
  isBlocking: boolean;
}
export interface CreateStudentDiscipline {
  kind: StudentDisciplineKind; reason: string; startsOn: string | null;
  endsOn: string | null; documentId: string | null;
}
