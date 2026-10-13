import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { platformApi } from "./dataSource";
import { writeAuthSession } from "./authSession";
import type { TokenResponse } from "../types/domain";

const session: TokenResponse = {
  accessToken: "test-access", accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
  refreshToken: "test-refresh", refreshTokenExpiresAtUtc: "2099-01-02T00:00:00Z",
  user: { id: "test-id", username: "admin", email: "admin@example.test", fullName: "Administrador",
    photoDocumentId: null, roles: ["Administrador"], permissions: ["users.read"], tenantCode: "sede-a", tenantName: "Sede A", isPlatformAdmin: false },
};

describe("vinculación de solicitudes a la sede de la sesión", () => {
  beforeEach(() => writeAuthSession(session));
  afterEach(() => { writeAuthSession(null); vi.unstubAllGlobals(); });

  it("envía token y sede para los contratos JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await platformApi.request("/users");
    const headers = fetcher.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-Sede-Code")).toBe("sede-a");
    expect(headers.get("Authorization")).toBe("Bearer test-access");
  });

  it("mantiene la sede también al recuperar archivos", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("file", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await platformApi.requestBlob("/documents/test/content");
    expect((fetcher.mock.calls[0][1].headers as Headers).get("X-Sede-Code")).toBe("sede-a");
  });

  it("permite iniciar sesión en otra sede sin reutilizar la anterior", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await platformApi.request("/auth/login", { method: "POST", headers: { "X-Sede-Code": "sede-b" } }, true);
    const headers = fetcher.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-Sede-Code")).toBe("sede-b");
    expect(headers.has("Authorization")).toBe(false);
  });

  it("renueva la sesión en la misma sede y reintenta la operación", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await platformApi.request("/users");
    expect(fetcher.mock.calls[1][0]).toContain("/auth/refresh");
    expect(fetcher.mock.calls[1][1].headers["X-Sede-Code"]).toBe("sede-a");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
