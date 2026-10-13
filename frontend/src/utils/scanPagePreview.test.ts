// Native Blob has arrayBuffer; jsdom's Blob intentionally does not implement it.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { scanPagePreview } from "./scanPagePreview";

describe("vista individual del escaneo", () => {
  it("extrae la página seleccionada y suma la rotación sin alterar el original", async () => {
    const original = await PDFDocument.create();
    original.addPage([200, 300]);
    original.addPage([400, 500]).setRotation(degrees(90));
    const blob = new Blob([new Uint8Array(await original.save())], { type: "application/pdf" });
    const preview = await PDFDocument.load(await (await scanPagePreview(blob, 2, 90)).arrayBuffer());
    expect(preview.getPageCount()).toBe(1);
    expect(preview.getPage(0).getWidth()).toBe(400);
    expect(preview.getPage(0).getRotation().angle).toBe(180);
    expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(2);
  });
  it("rechaza una página inexistente en lugar de mostrar otra", async () => {
    const original = await PDFDocument.create(); original.addPage();
    const blob = new Blob([new Uint8Array(await original.save())]);
    await expect(scanPagePreview(blob, 2, 0)).rejects.toThrow("no existe");
  });
});
