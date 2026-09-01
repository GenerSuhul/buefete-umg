import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAuthSession, updateAuthSessionUser, writeAuthSession } from "./authSession";
import type { TokenResponse } from "../types/domain";

const session: TokenResponse = {
  accessToken: "access-token",
  accessTokenExpiresAtUtc: "2026-09-01T18:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAtUtc: "2026-09-08T18:00:00Z",
  user: {
    id: "40000000-0000-0000-0000-000000000001",
    username: "admin",
    email: "admin@example.test",
    fullName: "Administrador",
    photoDocumentId: null,
    roles: ["Administrador"],
    permissions: ["users.read"],
  },
};

describe("authSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
    writeAuthSession(null);
  });

  afterEach(() => {
    sessionStorage.clear();
    writeAuthSession(null);
  });

  it("descarta una sesión corrupta sin romper el inicio de la aplicación", () => {
    sessionStorage.setItem("bufete_umg_session", "{datos inválidos");

    expect(readAuthSession()).toBeNull();
    expect(sessionStorage.getItem("bufete_umg_session")).toBeNull();
  });

  it("rechaza objetos que no cumplen el contrato de autenticación", () => {
    sessionStorage.setItem("bufete_umg_session", JSON.stringify({ accessToken: "incompleto" }));

    expect(readAuthSession()).toBeNull();
  });

  it("conserva tokens al actualizar el resumen del usuario", () => {
    writeAuthSession(session);

    updateAuthSessionUser({
      fullName: "Administradora General",
      email: "general@example.test",
      photoDocumentId: "50000000-0000-0000-0000-000000000001",
    });

    expect(readAuthSession()).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        fullName: "Administradora General",
        email: "general@example.test",
        photoDocumentId: "50000000-0000-0000-0000-000000000001",
      },
    });
  });
});
