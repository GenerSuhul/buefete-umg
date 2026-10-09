import "server-only";
import { get, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { degrees, PDFDocument } from "pdf-lib";
import type { DocumentRecord, ScanSession, UserSummary } from "../types/domain";
import { authorizeDocument } from "./domain";
import { audit, ensure, id, now, requireValue, type DemoState } from "./model";

export interface UploadedFile {
  __file: true;
  name: string;
  type: string;
  data: string;
}
function validateFile(file: UploadedFile) {
  ensure(
    file?.__file &&
      typeof file.data === "string" &&
      file.data.length <= 4 * 1024 * 1024,
    "Adjunte un archivo de hasta 3 MB.",
  );
  const bytes = Buffer.from(file.data, "base64");
  ensure(
    bytes.length > 0 && bytes.length <= 3 * 1024 * 1024,
    "El archivo está vacío o supera 3 MB.",
  );
  const signature =
    file.type === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : file.type === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : file.type === "image/webp"
            ? bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP"
            : false;
  ensure(signature, "Use un PDF, PNG, JPEG o WEBP válido.");
  return bytes;
}
async function saveFile(tenantId: string, file: UploadedFile) {
  const bytes = validateFile(file),
    pathname = `demo/${tenantId}/${id()}`;
  const stored = await put(pathname, bytes, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return {
    path: stored.pathname,
    bytes,
    sha: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function loadFile(path: string) {
  const response = await get(path, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  ensure(response, "No se encontró el archivo almacenado.", 404);
  return Buffer.from(await new Response(response.stream).arrayBuffer());
}
export async function upload(
  s: DemoState,
  u: UserSummary,
  tenantId: string,
  input: {
    file: UploadedFile;
    contextType: DocumentRecord["contextType"];
    contextId: string;
    label: string;
    replaceDocumentId?: string;
    source?: DocumentRecord["source"];
  },
) {
  authorizeDocument(s, u, input.contextType, input.contextId);
  ensure(
    u.roles.includes("AdministradorGeneral") ||
      u.roles.includes("Secretaria") ||
      (input.contextType === "UserPhoto" && input.contextId === u.id),
    "No tiene permiso para adjuntar en este registro.",
    403,
  );
  ensure(input.label?.trim(), "Indique la descripción del documento.");
  const previous = input.replaceDocumentId
    ? s.documents.find((d) => d.id === input.replaceDocumentId)
    : undefined;
  if (input.replaceDocumentId)
    ensure(
      previous &&
        previous.contextType === input.contextType &&
        previous.contextId === input.contextId &&
        previous.isCurrent,
      "La versión anterior no pertenece a este registro.",
    );
  const stored = await saveFile(tenantId, input.file);
  if (previous) previous.isCurrent = false;
  const record = {
    id: id(),
    originalFileName: input.file.name.slice(0, 200),
    contentType: input.file.type,
    sizeBytes: stored.bytes.length,
    sha256: stored.sha,
    source: input.source ?? "Upload",
    contextType: input.contextType,
    contextId: input.contextId,
    label: input.label.trim().slice(0, 300),
    versionNumber: previous ? previous.versionNumber + 1 : 1,
    previousVersionId: previous?.id ?? null,
    isCurrent: true,
    createdAtUtc: now(),
    createdByUserId: u.id,
    storagePath: stored.path,
  };
  s.documents.unshift(record);
  audit(s, u, "Documento almacenado", record.id);
  const { storagePath: _, ...dto } = record;
  return dto;
}
export async function download(
  s: DemoState,
  u: UserSummary,
  documentId: string,
) {
  const d = requireValue(s.documents.find((d) => d.id === documentId));
  authorizeDocument(s, u, d.contextType, d.contextId);
  return {
    __blob: true,
    type: d.contentType,
    data: (await loadFile(d.storagePath)).toString("base64"),
  };
}
type Scan = DemoState["scans"][number];
async function assembled(scan: Scan) {
  if (scan.capturePath) return loadFile(scan.capturePath);
  ensure(scan.pages.length, "Agregue páginas antes de previsualizar.");
  const pdf = await PDFDocument.create();
  for (const page of [...scan.pages].sort((a, b) => a.position - b.position)) {
    const bytes = await loadFile(requireValue(scan.pagePaths[page.id]));
    if (page.contentType === "application/pdf") {
      const source = await PDFDocument.load(bytes),
        pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach((p) => {
        p.setRotation(
          degrees((p.getRotation().angle + page.rotationDegrees) % 360),
        );
        pdf.addPage(p);
      });
    } else {
      ensure(
        ["image/png", "image/jpeg"].includes(page.contentType),
        "Para el escáner use PDF, PNG o JPEG.",
      );
      const image =
        page.contentType === "image/png"
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
      const p = pdf.addPage([image.width, image.height]);
      p.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
      p.setRotation(degrees(page.rotationDegrees));
    }
  }
  return Buffer.from(await pdf.save());
}
export async function scanOperation(
  s: DemoState,
  u: UserSummary,
  tenantId: string,
  method: string,
  args: unknown[],
) {
  ensure(
    u.roles.includes("AdministradorGeneral") || u.roles.includes("Secretaria"),
    "No tiene permiso para digitalizar documentos.",
    403,
  );
  if (method === "createScanSession") {
    const data = args[0] as Partial<ScanSession>;
    authorizeDocument(s, u, String(data.contextType), String(data.contextId));
    const scan: Scan = {
      id: id(),
      status: "Created",
      contextType: data.contextType!,
      contextId: data.contextId!,
      label: data.label || "Documento digitalizado",
      replaceDocumentId: data.replaceDocumentId ?? null,
      acquisitionProvider: data.acquisitionProvider ?? "Upload",
      deviceId: data.deviceId ?? null,
      deviceName: data.deviceName ?? null,
      resolutionDpi: data.resolutionDpi ?? null,
      colorMode: data.colorMode ?? null,
      duplex: data.duplex ?? null,
      expiresAtUtc: new Date(Date.now() + 30 * 86400000).toISOString(),
      capturedAtUtc: null,
      previewedAtUtc: null,
      capturedFileName: null,
      capturedContentType: null,
      capturedSizeBytes: null,
      capturedSha256: null,
      pageCount: 0,
      documentId: null,
      completedAtUtc: null,
      cancelledAtUtc: null,
      failureCode: null,
      failureMessage: null,
      createdByUserId: u.id,
      createdAtUtc: now(),
      lastSavedAtUtc: now(),
      pages: [],
      pagePaths: {},
    };
    s.scans.push(scan);
    return scanDto(scan);
  }
  if (method === "listScanDrafts")
    return s.scans
      .filter(
        (x) =>
          ["Created", "Captured"].includes(x.status) &&
          x.createdByUserId === u.id,
      )
      .map(scanDto);
  const scan = requireValue(s.scans.find((x) => x.id === args[0]));
  authorizeDocument(s, u, scan.contextType, scan.contextId);
  if (method === "getScanSession") return scanDto(scan);
  ensure(
    ["Created", "Captured", "Failed"].includes(scan.status),
    "La sesión de digitalización ya finalizó.",
  );
  switch (method) {
    case "addScanPage": {
      const file = args[1] as UploadedFile,
        data = args[2] as Record<string, unknown>;
      ensure(
        ["application/pdf", "image/jpeg", "image/png"].includes(file.type),
        "Use PDF, PNG o JPEG.",
      );
      ensure(
        scan.pages.length < 40,
        "La demo permite hasta 40 archivos por sesión.",
      );
      const stored = await saveFile(tenantId, file),
        pageId = id();
      scan.pagePaths[pageId] = stored.path;
      scan.pages.push({
        id: pageId,
        clientPageId: String(data.clientPageId),
        position: scan.pages.length,
        source: data.source as "Upload",
        status: "Ready",
        originalFileName: file.name,
        contentType: file.type,
        sizeBytes: stored.bytes.length,
        sha256: stored.sha,
        sourcePageNumber: null,
        widthPixels:
          typeof data.widthPixels === "number" ? data.widthPixels : null,
        heightPixels:
          typeof data.heightPixels === "number" ? data.heightPixels : null,
        rotationDegrees: 0,
        createdAtUtc: now(),
        createdByUserId: u.id,
      });
      scan.status = "Captured";
      scan.capturedAtUtc = now();
      scan.pageCount = scan.pages.length;
      scan.previewedAtUtc = null;
      break;
    }
    case "openScanPage": {
      const p = requireValue(scan.pages.find((p) => p.id === args[1]));
      return {
        __blob: true,
        type: p.contentType,
        data: (await loadFile(scan.pagePaths[p.id])).toString("base64"),
      };
    }
    case "reorderScanPages": {
      const ids = args[1] as string[];
      ensure(
        Array.isArray(ids) &&
          ids.length === scan.pages.length &&
          new Set(ids).size === ids.length &&
          ids.every((key) => scan.pages.some((p) => p.id === key)),
        "La lista de páginas no es válida.",
      );
      scan.pages = ids.map((key, position) => ({
        ...scan.pages.find((p) => p.id === key)!,
        position,
      }));
      scan.previewedAtUtc = null;
      break;
    }
    case "rotateScanPage": {
      const p = requireValue(scan.pages.find((p) => p.id === args[1]));
      ensure([0, 90, 180, 270].includes(Number(args[2])), "Rotación inválida.");
      p.rotationDegrees = Number(args[2]);
      scan.previewedAtUtc = null;
      break;
    }
    case "removeScanPage":
      scan.pages = scan.pages
        .filter((p) => p.id !== args[1])
        .map((p, position) => ({ ...p, position }));
      scan.pageCount = scan.pages.length;
      scan.previewedAtUtc = null;
      break;
    case "captureScanSession": {
      const file = args[1] as UploadedFile;
      const stored = await saveFile(tenantId, file);
      scan.capturePath = stored.path;
      scan.status = "Captured";
      scan.capturedAtUtc = now();
      scan.capturedFileName = file.name;
      scan.capturedContentType = file.type;
      scan.capturedSizeBytes = stored.bytes.length;
      scan.capturedSha256 = stored.sha;
      scan.pageCount = Number(args[2]) || 1;
      scan.previewedAtUtc = null;
      break;
    }
    case "previewScanSession": {
      const bytes = await assembled(scan);
      scan.previewedAtUtc = now();
      return {
        __blob: true,
        type: scan.capturePath ? scan.capturedContentType : "application/pdf",
        data: bytes.toString("base64"),
      };
    }
    case "completeScanSession": {
      ensure(
        scan.previewedAtUtc,
        "Previsualice las páginas antes de aceptar el documento.",
      );
      const bytes = await assembled(scan);
      const document = await upload(s, u, tenantId, {
        file: {
          __file: true,
          name: scan.capturedFileName ?? "digitalizado.pdf",
          type: scan.capturePath
            ? scan.capturedContentType!
            : "application/pdf",
          data: bytes.toString("base64"),
        },
        contextType: scan.contextType,
        contextId: scan.contextId,
        label: scan.label,
        replaceDocumentId: scan.replaceDocumentId ?? undefined,
        source: "Scanner",
      });
      scan.status = "Completed";
      scan.completedAtUtc = now();
      scan.documentId = document.id;
      return document;
    }
    case "saveScanDraft":
      break;
    case "cancelScanSession":
      scan.status = "Cancelled";
      scan.cancelledAtUtc = now();
      break;
    case "reportScanFailure":
      scan.status = "Failed";
      scan.failureCode = String(args[1]);
      scan.failureMessage = String(args[2]).slice(0, 500);
      break;
    default:
      ensure(false, "Acción de digitalización desconocida.");
  }
  scan.lastSavedAtUtc = now();
  audit(s, u, method, scan.id);
  return scanDto(scan);
}
function scanDto({ capturePath: _, pagePaths: __, ...scan }: Scan) {
  return scan;
}
