import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FeedbackProvider } from "../components/ui/Feedback";
import { AuthProvider } from "../context/AuthContext";
import { LoginPage } from "./LoginPage";

function LoginHarness() {
  return <FeedbackProvider><AuthProvider><MemoryRouter initialEntries={["/acceso"]}><Routes><Route path="/acceso" element={<LoginPage />} /><Route path="/" element={<h1>Resumen operativo</h1>} /></Routes></MemoryRouter></AuthProvider></FeedbackProvider>;
}

describe("experiencia de acceso", () => {
  it("confirma el acceso correcto y entra al sistema", async () => {
    render(<LoginHarness />);
    expect(screen.getByRole("heading", { name: /Bufete Popular UMG Petén/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ingresar al sistema/i }));
    expect(await screen.findByText("Acceso concedido")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Resumen operativo" })).toBeInTheDocument();
  });

  it("muestra un error humano y mantiene el formulario utilizable", async () => {
    render(<LoginHarness />);
    const password = screen.getByLabelText("Contraseña");
    fireEvent.change(password, { target: { value: "incorrecta" } });
    fireEvent.click(screen.getByRole("button", { name: /Ingresar al sistema/i }));
    expect(await screen.findByText("No fue posible iniciar sesión")).toBeInTheDocument();
    expect(screen.getByText("Verifica tu correo electrónico y contraseña.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ingresar al sistema/i })).toBeEnabled();
  });
});
