import { describe, expect, it } from "vitest";
import { canEvaluateRequirement, requirementEvidenceHint, requirementStatusOptions } from "./requirementFlow";

describe("acciones según la evidencia del requisito", () => {
  const document = { kind: "Document" as const, documentId: null, dataValue: null, isConditional: false };

  it("no ofrece revisión de un documento obligatorio sin archivo", () => {
    expect(canEvaluateRequirement(document)).toBe(false);
    expect(requirementStatusOptions(document)).toEqual(["Pending"]);
    expect(requirementEvidenceHint(document)).not.toContain("No aplica");
  });

  it("permite evaluar no aplicación de un documento condicional sin archivo", () => {
    const conditional = { ...document, isConditional: true };
    expect(canEvaluateRequirement(conditional)).toBe(true);
    expect(requirementStatusOptions(conditional)).toEqual(["Pending", "NotApplicable"]);
    expect(requirementEvidenceHint(conditional)).toContain("No aplica");
  });

  it("ofrece revisión después de adjuntar el documento", () => {
    expect(requirementStatusOptions({ ...document, documentId: "document-id" })).toEqual([
      "Pending", "Submitted", "Accepted", "Observed",
    ]);
  });

  it("exige un dato no vacío antes de ofrecer aceptación", () => {
    const data = { ...document, kind: "Data" as const, dataValue: "  " };
    expect(requirementStatusOptions(data)).toEqual(["Pending"]);
    expect(requirementStatusOptions({ ...data, dataValue: "Fecha registrada" })).toContain("Accepted");
  });

  it("exige evaluar la condición antes de ofrecer aceptación", () => {
    const condition = { ...document, kind: "Condition" as const, conditionMet: null };
    expect(requirementStatusOptions(condition)).toEqual(["Pending"]);
    expect(requirementStatusOptions({ ...condition, conditionMet: false })).toContain("Accepted");
  });
});
