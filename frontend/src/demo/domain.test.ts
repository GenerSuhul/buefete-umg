import { describe, expect, it } from "vitest";
import { operate } from "./domain";
import { emptyState } from "./model";
import type { CaseDetail, Client, StudentRegistration } from "../types/domain";

const person = {
  fullName: "Persona de prueba",
  residenceAddress: "Dirección ficticia",
  receptionDate: "2026-10-09",
  receptionPlace: "Petén",
  assistanceRequested: "Cambio de nombre",
  dpi: "0000 00000 0000",
};
function setup() {
  const state = emptyState("licenciado@demo.umg.gt");
  return {
    state,
    user: state.users[0],
    run: (method: string, ...args: unknown[]) =>
      operate(state, state.users[0], method, args),
  };
}
describe("Dominio aislado de demo", () => {
  it("crea, edita y reutiliza usuario atendido en expediente con sus requisitos", () => {
    const { run } = setup(),
      c = run("createClient", person) as Client;
    run("updateClient", c.id, {
      fullName: "Nombre corregido",
      concurrencyToken: c.concurrencyToken,
    });
    const opened = run("openCase", {
      clientId: c.id,
      processTypeId: "CAMBIO_NOMBRE",
    }) as CaseDetail;
    expect(opened.summary.clientName).toBe("Nombre corregido");
    expect(opened.requirements).toHaveLength(2);
    expect(() =>
      run(
        "updateCaseRequirement",
        opened.summary.id,
        opened.requirements[0].id,
        { status: "Accepted" },
      ),
    ).toThrow(/evidencia/);
  });
  it("rechaza IDs de otra sede y registra histórico", () => {
    const a = setup(),
      b = setup(),
      c = a.run("createClient", person) as Client;
    expect(() => b.run("getClient", c.id)).toThrow(/sede/);
    expect(a.state.audit).toHaveLength(1);
    expect(b.state.clients).toHaveLength(0);
  });
  it("inscripción, evidencia y aprobación preceden la asignación", () => {
    const { run } = setup(),
      c = run("createClient", person) as Client,
      legal = run("openCase", {
        clientId: c.id,
        processTypeId: "CAMBIO_NOMBRE",
      }) as CaseDetail;
    const r = run("registerStudent", {
      student: {
        fullName: "Alumno ficticio",
        email: "alumno@example.test",
        studentCardNumber: "1690-26-00001",
        dpi: "0000000000000",
        registrationDate: "2026-10-09",
        residenceAddress: "Prueba",
      },
      enrollment: { modality: "CivilFamilyCases", initialStatus: "Submitted" },
      access: { password: "Ejemplo26" },
    }) as StudentRegistration;
    expect(() =>
      run("assignStudent", legal.summary.id, r.student.id, true),
    ).toThrow(/aprobada/);
    expect(() =>
      run("changeEnrollmentStatus", r.enrollment.id, { status: "Approved" }),
    ).toThrow(/siguiente estado/);
    run("changeEnrollmentStatus", r.enrollment.id, { status: "Admitted" });
    run("changeEnrollmentStatus", r.enrollment.id, { status: "UnderReview" });
    expect(() =>
      run("changeEnrollmentStatus", r.enrollment.id, { status: "Approved" }),
    ).toThrow(/requisitos/);
    expect(r.enrollment.requirements).toHaveLength(9);
  });
  it("eliminación lógica y restauración preservan la ficha", () => {
    const { run } = setup(),
      c = run("createClient", person) as Client;
    run("deleteClient", c.id, "Prueba");
    expect(() => run("getClient", c.id)).toThrow();
    run("restoreDeletedRecord", "Client", c.id);
    expect((run("getClient", c.id) as { client: Client }).client.fullName).toBe(
      person.fullName,
    );
  });
  it("secretaría no administra accesos ni elimina registros", () => {
    const { state } = setup(),
      u = { ...state.users[0], roles: ["Secretaria"] };
    expect(() => operate(state, u, "listUsers", [])).toThrow(/permiso/);
    const c = operate(state, u, "createClient", [person]) as Client;
    expect(() => operate(state, u, "deleteClient", [c.id])).toThrow(
      /administrador/,
    );
  });
});
