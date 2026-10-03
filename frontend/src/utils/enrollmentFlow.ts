import type { EnrollmentStatus, StudentProfile } from "../types/domain";

const descriptions: Record<EnrollmentStatus, string> = {
  Draft: "La solicitud aún no se ha presentado.",
  Submitted: "Solicitud presentada; pendiente de admisión.",
  Admitted: "Solicitud admitida; pendiente de revisión.",
  UnderReview: "La documentación está en revisión.",
  Observed: "La solicitud tiene observaciones pendientes.",
  Approved: "La inscripción fue aprobada.",
  Rejected: "La solicitud no fue aprobada.",
  Completed: "La práctica fue completada.",
};

export function enrollmentStatusDescription(status: EnrollmentStatus, resolutionNotes: string | null): string {
  return resolutionNotes?.trim() || descriptions[status];
}

export function canAssignStudent(profile: StudentProfile): boolean {
  return profile.student.isActive && profile.enrollments.some((item) => item.status === "Approved");
}

export function hasInconsistentActiveAssignment(profile: StudentProfile): boolean {
  return !canAssignStudent(profile) && profile.cases.some((item) => item.assignmentStatus === "Active");
}
