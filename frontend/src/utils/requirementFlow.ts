import type { RequirementStatus } from "../types/domain";

type RequirementEvidence = {
  kind: "Document" | "Data" | "Condition";
  documentId: string | null;
  dataValue: string | null;
  conditionMet?: boolean | null;
  isConditional: boolean;
};

export function hasRequirementEvidence(requirement: RequirementEvidence): boolean {
  switch (requirement.kind) {
    case "Document": return Boolean(requirement.documentId);
    case "Data": return Boolean(requirement.dataValue?.trim());
    case "Condition": return requirement.conditionMet !== null && requirement.conditionMet !== undefined;
  }
}

export function canEvaluateRequirement(requirement: RequirementEvidence): boolean {
  return requirement.kind !== "Document" || hasRequirementEvidence(requirement) || requirement.isConditional;
}

export function requirementStatusOptions(requirement: RequirementEvidence): RequirementStatus[] {
  const options: RequirementStatus[] = ["Pending"];
  if (hasRequirementEvidence(requirement)) options.push("Submitted", "Accepted", "Observed");
  if (requirement.isConditional) options.push("NotApplicable");
  return options;
}

export function requirementEvidenceHint(requirement: RequirementEvidence): string | null {
  if (hasRequirementEvidence(requirement)) return null;
  if (requirement.kind === "Document") return requirement.isConditional
    ? "Adjunte el documento para presentarlo o revisarlo. Si no corresponde, seleccione «No aplica»."
    : "Adjunte el documento para poder presentarlo o revisarlo.";
  if (requirement.kind === "Data") return "Complete el dato antes de marcar el requisito como presentado o aceptado.";
  return "Evalúe la condición antes de cambiar su estado.";
}
