import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("el consumidor nativo usa el contrato pages para leer, ordenar, girar y quitar", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.resetModules();
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })));
  vi.stubGlobal("fetch", fetcher);
  const { dataSource } = await import("./dataSource");
  await dataSource.openScanPage("session", "page");
  await dataSource.reorderScanPages("session", ["page"]);
  await dataSource.rotateScanPage("session", "page", 90);
  await dataSource.removeScanPage("session", "page");
  expect(fetcher.mock.calls.map(call => [String(call[0]).split("/scan-sessions")[1], call[1]?.method ?? "GET"]))
    .toEqual([["/session/pages/page/content", "GET"], ["/session/pages/order", "PUT"], ["/session/pages/page/rotation", "PUT"], ["/session/pages/page", "DELETE"]]);
});
