import { describe, expect, it } from "vitest";
import type { StudentProfile } from "../types/domain";
import { canAssignStudent, enrollmentStatusDescription, hasInconsistentActiveAssignment } from "./enrollmentFlow";

describe("descripción de la inscripción", () => {
  it("no presenta una inscripción aprobada como pendiente de revisión", () => {
    expect(enrollmentStatusDescription("Approved", null)).toBe("La inscripción fue aprobada.");
  });

  it("conserva la resolución registrada", () => {
    expect(enrollmentStatusDescription("Rejected", "Falta evidencia")).toBe("Falta evidencia");
  });

  it("no ofrece asignar casos a un alumno con inscripción borrador y detecta una asignación histórica inconsistente", () => {
    const profile = {
      student: { isActive: true },
      enrollments: [{ status: "Draft" }],
      cases: [{ assignmentStatus: "Active" }],
    } as StudentProfile;
    expect(canAssignStudent(profile)).toBe(false);
    expect(hasInconsistentActiveAssignment(profile)).toBe(true);
  });
});
