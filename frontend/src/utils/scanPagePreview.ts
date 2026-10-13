import { PDFDocument, degrees } from "pdf-lib";

/** Read-only derivative; the original stays in storage and the server builds the final PDF. */
export async function scanPagePreview(blob: Blob, pageNumber: number, rotation: number): Promise<Blob> {
  const original = await PDFDocument.load(await blob.arrayBuffer());
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > original.getPageCount()) {
    throw new Error("La página solicitada no existe en el PDF original.");
  }
  const preview = await PDFDocument.create();
  const [page] = await preview.copyPages(original, [pageNumber - 1]);
  page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
  preview.addPage(page);
  const bytes = await preview.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
