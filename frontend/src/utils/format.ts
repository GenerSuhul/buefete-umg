import type {
  CaseStatus,
  EnrollmentStatus,
  RequirementStatus,
} from "../types/domain";

const dateFormatter = new Intl.DateTimeFormat("es-GT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("es-GT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined) {
  return value
    ? dateFormatter.format(
        new Date(value.includes("T") ? value : `${value}T12:00:00`),
      )
    : "Sin fecha";
}

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Sin registro";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const labels: Record<string, string> = {
  DocumentCollection: "Recolección documental",
  Active: "Activo",
  Suspended: "Suspendido",
  Closed: "Cerrado",
  Archived: "Archivado",
  Pending: "Pendiente",
  Submitted: "Presentado",
  Accepted: "Aceptado",
  Observed: "Observado",
  Expired: "Vencido",
  NotApplicable: "No aplica",
  Draft: "Borrador",
  Admitted: "Admitido",
  UnderReview: "En revisión",
  Approved: "Aprobado",
  Rejected: "Rechazado",
  Completed: "Completado",
  Received: "Recibido",
  RequiresCorrection: "Requiere corrección",
  Corrected: "Corregido",
  ApprovedForSignature: "Listo para firma",
  Presented: "Presentado",
  CivilFamilyCases: "Procuración civil y familia",
  ExternalInternship: "Pasantía externa",
  AdHonoremSecretariat: "Secretaría ad honorem",
  Upload: "Carga",
  Scanner: "Escáner",
  Generated: "Generado",
  Client: "Cliente",
  Student: "Alumno",
  Enrollment: "Inscripción",
  LegalCase: "Expediente",
  CaseRequirement: "Requisito",
  Timeline: "Seguimiento",
  Memorial: "Memorial",
  Report: "Reporte",
  UserPhoto: "Fotografía",
  Reviewed: "Revisado",
  Sent: "Enviado",
  SendFailed: "Envío fallido",
};

export function translate(value: string) {
  return labels[value] ?? value;
}

export function statusTone(
  status: CaseStatus | RequirementStatus | EnrollmentStatus | string,
): "success" | "warning" | "danger" | "info" | "neutral" | "blue" {
  if (["Active", "Accepted", "Approved", "Completed", "Sent"].includes(status))
    return "success";
  if (
    [
      "Pending",
      "DocumentCollection",
      "UnderReview",
      "Submitted",
      "Draft",
      "RequiresCorrection",
    ].includes(status)
  )
    return "warning";
  if (
    ["Suspended", "Observed", "Expired", "Rejected", "SendFailed"].includes(
      status,
    )
  )
    return "danger";
  if (["Closed", "Archived", "NotApplicable"].includes(status))
    return "neutral";
  return "info";
}
