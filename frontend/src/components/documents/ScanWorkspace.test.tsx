import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ScanWorkspace } from "./ScanWorkspace";
const mocks = vi.hoisted(() => ({ openPage: vi.fn(), drafts: vi.fn(), save: vi.fn() }));
vi.mock("../../data/dataSource", () => ({ dataSource: { listScanDrafts: mocks.drafts, openScanPage: mocks.openPage, saveScanDraft: mocks.save } }));
vi.mock("../../data/scannerAgent", () => ({ getScannerAgentHealth: async () => ({ ready: false }), listScannerDevices: async () => [], acquireFromScanner: vi.fn() }));
const session = {
  id: "draft", label: "Documento QA", contextType: "Enrollment", contextId: "enrollment", status: "Captured",
  acquisitionProvider: "BrowserImport", createdAtUtc: "2026-10-12T18:00:00Z", pageCount: 1,
  pages: [{ id: "page", position: 0, contentType: "image/png", originalFileName: "qa.png", status: "Ready", sha256: "hash", rotationDegrees: 0, source: "Scanner", sizeBytes: 30 }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.drafts.mockResolvedValue([session]); mocks.save.mockResolvedValue({ ...session });
  vi.stubGlobal("URL", { createObjectURL: () => "blob:page", revokeObjectURL: vi.fn() });
});
it("un fallo de lectura no deja el lienzo vacío ni informa que se perdió la captura; permite reintentar", async () => {
  mocks.openPage.mockRejectedValue(new Error("404"));
  render(<ScanWorkspace open initialForm={{ contextType: "Enrollment", contextId: "enrollment", label: "Documento QA", replaceDocumentId: "" }} onClose={() => {}} onCompleted={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /Documento QA/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("La captura sigue guardada");
  mocks.openPage.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
  fireEvent.click(screen.getByRole("button", { name: "Reintentar página" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  await waitFor(() => expect(document.querySelector(".scan-canvas img")).toHaveAttribute("src", "blob:page"));
  const calls = mocks.openPage.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  expect(mocks.openPage).toHaveBeenCalledTimes(calls);
});
