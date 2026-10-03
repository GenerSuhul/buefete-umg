import type { CaseDetail } from "../types/domain";
import { hasRequirementEvidence } from "./requirementFlow";

export type CaseReadinessIssue = {
  id: "catalog" | "requirements" | "assignment" | "timeline";
  title: string;
  detail: string;
  target: "requirements" | "assign" | "timeline" | null;
};

export type CaseReadiness = {
  state: "inactive" | "attention" | "ready";
  issues: CaseReadinessIssue[];
};

export function assessCaseReadiness(legalCase: CaseDetail): CaseReadiness {
  if (legalCase.summary.status === "Closed" || legalCase.summary.status === "Archived")
    return { state: "inactive", issues: [] };

  const issues: CaseReadinessIssue[] = [];
  if (legalCase.requirements.length === 0) {
    issues.push({
      id: "catalog",
      title: "Sin lista de requisitos",
      detail: "Este tipo de proceso aún no tiene requisitos configurados. Verifique el catálogo antes de considerar completa su papelería.",
      target: null,
    });
  } else {
    const unresolved = legalCase.requirements.filter((item) => {
      if (!item.isRequired && !item.isConditional) return false;
      if (item.isConditional && item.status === "NotApplicable") return false;
      return item.status !== "Accepted" || item.isExpired || !hasRequirementEvidence(item);
    });
    if (unresolved.length > 0) {
      issues.push({
        id: "requirements",
        title: `${unresolved.length} requisito${unresolved.length === 1 ? "" : "s"} por resolver`,
        detail: unresolved.slice(0, 2).map((item) => item.label).join(" · ") + (unresolved.length > 2 ? " · …" : ""),
        target: "requirements",
      });
    }
  }

  if (!legalCase.summary.assignments.some((item) => item.isPrimary && item.status === "Active")) {
    issues.push({
      id: "assignment",
      title: "Sin alumno responsable activo",
      detail: "Asigne un alumno habilitado o revise la asignación existente.",
      target: "assign",
    });
  }

  if (!legalCase.timeline.some((item) => item.type !== "CaseOpened")) {
    issues.push({
      id: "timeline",
      title: "Sin seguimiento posterior a la apertura",
      detail: "Registre la siguiente actuación cuando ocurra; la apertura por sí sola no acredita avance.",
      target: "timeline",
    });
  }

  return { state: issues.length ? "attention" : "ready", issues };
}
