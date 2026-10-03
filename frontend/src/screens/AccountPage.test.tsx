import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedbackProvider } from "../components/ui/Feedback";
import { AuthProvider } from "../context/AuthContext";
import { AccountPage } from "./AccountPage";

function renderAccount() {
  return render(
    <FeedbackProvider>
      <AuthProvider>
        <MemoryRouter>
          <AccountPage />
        </MemoryRouter>
      </AuthProvider>
    </FeedbackProvider>,
  );
}

describe("módulo de cuenta", () => {
  it("presenta identidad, edición, seguridad y permisos en secciones claras", async () => {
    renderAccount();

    expect(await screen.findByRole("heading", { name: "Lic. Mónica Estrada" })).toBeInTheDocument();
    expect(screen.getByLabelText("Secciones de la cuenta")).toBeInTheDocument();
    expect(await screen.findByLabelText("Nombre completo")).toHaveValue("Lic. Mónica Estrada");
    expect(screen.getByLabelText(/^Usuario/)).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: /Seguridad/i }));
    expect(screen.getByRole("heading", { name: "Seguridad de la cuenta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /Acceso y permisos/i }));
    expect(screen.getByRole("heading", { name: "Acceso y permisos" })).toBeInTheDocument();
    expect(screen.getByText("Acceso administrativo completo")).toBeInTheDocument();
  });

  it("mantiene deshabilitado el guardado cuando no hay cambios", async () => {
    renderAccount();
    expect(await screen.findByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Mónica Estrada" } });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  });
});
