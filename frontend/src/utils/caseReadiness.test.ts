import { describe, expect, it } from "vitest";
import type { CaseDetail } from "../types/domain";
import { assessCaseReadiness } from "./caseReadiness";

const base: CaseDetail = {
  summary: {
    id: "case-1", caseNumber: "EXP-1", clientId: "client-1", clientName: "Cliente",
    processTypeId: "process-1", processTypeName: "Proceso", status: "DocumentCollection",
    stage: "Recepción", openedAtUtc: "2026-10-03T00:00:00Z", closedAtUtc: null,
    lastStep: null, assignments: [], concurrencyToken: "token-1",
  },
  requirements: [{
    id: "requirement-1", requirementDefinitionId: "definition-1", label: "DPI",
    kind: "Document", isRequired: true, isConditional: false, status: "Pending",
    documentId: null, dataValue: null, conditionMet: null, documentIssueDate: null,
    notes: null, isExpired: false,
  }],
  counterparties: [], timeline: [], memorials: [], presentations: [], courtNotifications: [],
};

describe("semáforo de preparación del expediente", () => {
  it("señala documentación, responsable y seguimiento faltantes", () => {
    expect(assessCaseReadiness(base).issues.map((issue) => issue.id)).toEqual([
      "requirements", "assignment", "timeline",
    ]);
  });

  it("no considera cubierto un documento aceptado sin archivo o vencido", () => {
    const withInvalidEvidence = {
      ...base,
      requirements: [{ ...base.requirements[0], status: "Accepted" as const }],
    };
    expect(assessCaseReadiness(withInvalidEvidence).issues[0].id).toBe("requirements");
    withInvalidEvidence.requirements[0].documentId = "document-1";
    withInvalidEvidence.requirements[0].isExpired = true;
    expect(assessCaseReadiness(withInvalidEvidence).issues[0].id).toBe("requirements");
  });

  it("acepta no aplicación condicional y requiere asignación primaria activa", () => {
    const complete: CaseDetail = {
      ...base,
      requirements: [{ ...base.requirements[0], isRequired: false, isConditional: true, status: "NotApplicable" }],
      summary: { ...base.summary, assignments: [{
        id: "assignment-1", studentId: "student-1", studentName: "Alumno", isPrimary: true,
        status: "Active", assignedAtUtc: "2026-10-03T00:00:00Z", endedAtUtc: null, endReason: null,
      }] },
      timeline: [{
        id: "step-1", type: "GeneralAction", occurredAtUtc: "2026-10-03T00:00:00Z",
        title: "Paso", description: null, performedByStudentId: null, documentId: null,
        createdByUserId: null,
      }],
    };
    expect(assessCaseReadiness(complete)).toEqual({ state: "ready", issues: [] });
    complete.summary.assignments[0].status = "Completed";
    expect(assessCaseReadiness(complete).issues.map((issue) => issue.id)).toEqual(["assignment"]);
  });

  it("un caso cerrado no solicita cargas ni actuaciones", () => {
    expect(assessCaseReadiness({ ...base, summary: { ...base.summary, status: "Closed" } })).toEqual({
      state: "inactive", issues: [],
    });
  });

  it("la ausencia de catálogo no se presenta como completitud", () => {
    expect(assessCaseReadiness({ ...base, requirements: [] }).issues[0].id).toBe("catalog");
  });
});
