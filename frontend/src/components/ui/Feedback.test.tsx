import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { FeedbackProvider, useConfirm, useNotify } from "./Feedback";
import { humanizeOperationError } from "./feedback/feedbackBus";

function FeedbackHarness({ operation }: { operation: () => Promise<string> }) {
  const notify = useNotify();
  const confirm = useConfirm();
  return <>
    <button type="button" onClick={() => void notify.track(operation(), {
      loading: { title: "Guardando usuario…" },
      success: (name) => ({ title: "Usuario creado", message: `${name} ya puede acceder al sistema.` }),
      error: { title: "No se pudo crear el usuario" },
    }).catch(() => undefined)}>Crear</button>
    <button type="button" onClick={async () => { if (await confirm({ title: "Desactivar usuario", message: "Ana perderá el acceso.", confirmLabel: "Desactivar", tone: "danger" })) notify.success("Usuario desactivado"); }}>Desactivar</button>
  </>;
}

describe("sistema global de feedback", () => {
  it("evoluciona un único toast de loading a success", async () => {
    render(<FeedbackProvider><FeedbackHarness operation={() => Promise.resolve("Ana López")} /></FeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    expect(await screen.findByText("Usuario creado")).toBeInTheDocument();
    expect(screen.getByText("Ana López ya puede acceder al sistema.")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("convierte el fallo en un mensaje humano", async () => {
    render(<FeedbackProvider><FeedbackHarness operation={() => Promise.reject(new Error("Request failed with status code 500"))} /></FeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    expect(await screen.findByText("No se pudo crear el usuario")).toBeInTheDocument();
    expect(screen.getByText("El servidor no pudo completar la operación. Inténtalo nuevamente.")).toBeInTheDocument();
  });

  it("exige confirmación antes de una acción destructiva", async () => {
    const operation = vi.fn(() => Promise.resolve("Ana"));
    render(<FeedbackProvider><FeedbackHarness operation={operation} /></FeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(await screen.findByRole("dialog", { name: "Desactivar usuario" })).toBeInTheDocument();
    expect(screen.queryByText("Usuario desactivado")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Desactivar" }).at(-1)!);
    await waitFor(() => expect(screen.getByText("Usuario desactivado")).toBeInTheDocument());
  });

  it.each([
    ["Request failed with status code 403", "No tienes permisos para realizar esta acción."],
    ["Request failed with status code 409", "Ya existe un registro con estos datos. Revisa la información ingresada."],
    ["Failed to fetch", "No se pudo conectar con el servidor. Verifica la conexión e inténtalo nuevamente."],
    ["El archivo supera 25 MB", "El archivo supera el tamaño permitido."],
  ])("traduce errores técnicos de API: %s", (technical, expected) => {
    expect(humanizeOperationError(new Error(technical))).toBe(expected);
  });
});
