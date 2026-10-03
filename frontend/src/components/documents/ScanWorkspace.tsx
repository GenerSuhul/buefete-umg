import {
  Download,
  FilePlus2,
  GripVertical,
  MonitorUp,
  RefreshCw,
  RotateCw,
  Save,
  ScanLine,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dataSource } from "../../data/dataSource";
import {
  acquireFromScanner,
  getScannerAgentHealth,
  listScannerDevices,
} from "../../data/scannerAgent";
import type { LocalScannerDevice } from "../../data/scannerAgent";
import type {
  DocumentRecord,
  ScanPage,
  ScanPageSource,
  ScanSession,
} from "../../types/domain";
import { formatBytes, formatDateTime, translate } from "../../utils/format";
import { Badge, Button, Field, Modal, ReadOnlyValue, Select } from "../ui";
import { RelationLookup, type LookupOption } from "../domain/Shared";

type DocumentContext = DocumentRecord["contextType"];
type ContextOption = { id: string; label: string };
type ContextMap = Partial<Record<DocumentContext, ContextOption[]>>;
interface ScanWorkspaceProps {
  open: boolean;
  onClose: () => void;
  contexts?: ContextMap;
  loadContexts?: (contextType: "Client" | "Student" | "LegalCase", search: string, selectedId?: string) => Promise<LookupOption[]>;
  initialForm: {
    contextType: DocumentContext;
    contextId: string;
    label: string;
    replaceDocumentId: string;
  };
  contextLocked?: boolean;
  onCompleted: (document: DocumentRecord) => Promise<void> | void;
}

function PageImage({
  sessionId,
  page,
  active,
  onSelect,
}: {
  sessionId: string;
  page: ScanPage;
  active: boolean;
  onSelect: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let currentUrl: string | null = null;
    dataSource
      .openScanPage(sessionId, page.id)
      .then((blob) => {
        if (disposed) return;
        currentUrl = URL.createObjectURL(blob);
        setUrl(currentUrl);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [page.id, page.sha256, sessionId]);
  return (
    <button
      type="button"
      className={`scan-page-thumb${active ? " active" : ""}`}
      onClick={onSelect}
    >
      <span>{page.position + 1}</span>
      {url && page.contentType.startsWith("image/") ? (
        <img
          src={url}
          alt={`Página ${page.position + 1}`}
          style={{ transform: `rotate(${page.rotationDegrees}deg)` }}
          loading="lazy"
        />
      ) : (
        <strong>
          PDF
          <br />
          p. {page.sourcePageNumber ?? page.position + 1}
        </strong>
      )}
      <small>
        {page.source === "Scanner"
          ? "Escáner"
          : page.source === "PdfImport"
            ? "PDF"
            : "Archivo"}
      </small>
    </button>
  );
}

export function ScanWorkspace({
  open,
  onClose,
  contexts,
  loadContexts,
  initialForm,
  contextLocked = false,
  onCompleted,
}: ScanWorkspaceProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initialForm);
  const [session, setSession] = useState<ScanSession | null>(null);
  const [drafts, setDrafts] = useState<ScanSession[]>([]);
  const [devices, setDevices] = useState<LocalScannerDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [resolutionDpi, setResolutionDpi] = useState(300);
  const [colorMode, setColorMode] = useState<
    "Color" | "Grayscale" | "BlackAndWhite"
  >("Color");
  const [duplex, setDuplex] = useState(false);
  const [useFeeder, setUseFeeder] = useState(true);
  const [agentReady, setAgentReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedContextLabel, setSelectedContextLabel] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const replacementLabels = useRef(new Map<string, string>());

  const loadReplacementDocuments = useCallback(async (term: string) => {
    if (!form.contextId) return [];
    const result = await dataSource.listDocuments({
      contextType: form.contextType,
      contextId: form.contextId,
      search: term,
      pageSize: 20,
    });
    result.items.forEach((item) => replacementLabels.current.set(item.id, item.label));
    const options = result.items.map((item) => ({
      value: item.id,
      label: `${item.label} · v${item.versionNumber}`,
    }));
    if (!form.replaceDocumentId || options.some((item) => item.value === form.replaceDocumentId))
      return options;
    try {
      const selected = await dataSource.getDocument(form.replaceDocumentId);
      replacementLabels.current.set(selected.id, selected.label);
      return [{ value: selected.id, label: `${selected.label} · v${selected.versionNumber}` }, ...options];
    } catch {
      return options;
    }
  }, [form.contextId, form.contextType, form.replaceDocumentId]);

  const activePages = useMemo(
    () =>
      session?.pages
        .filter((page) => page.status === "Ready")
        .sort((a, b) => a.position - b.position) ?? [],
    [session],
  );
  const selectedPage =
    activePages.find((page) => page.id === selectedPageId) ??
    activePages[0] ??
    null;

  const initialize = useCallback(async () => {
    setForm(initialForm);
    setSession(null);
    setError(null);
    setNotice(null);
    setPreviewUrl(null);
    setSelectedPageId(null);
    const [savedDrafts, ready] = await Promise.all([
      dataSource.listScanDrafts().catch(() => []),
      getScannerAgentHealth()
        .then((health) => health.ready)
        .catch(() => false),
    ]);
    setDrafts(savedDrafts);
    setAgentReady(ready);
    const found = ready ? await listScannerDevices().catch(() => []) : [];
    setDevices(found);
    setDeviceId(found[0]?.id ?? "");
  }, [initialForm]);

  useEffect(() => {
    if (open) void initialize();
  }, [initialize, open]);

  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    if (!session || !selectedPage) {
      setSelectedUrl(null);
      return;
    }
    dataSource
      .openScanPage(session.id, selectedPage.id)
      .then((blob) => {
        if (disposed) return;
        url = URL.createObjectURL(blob);
        setSelectedUrl(url);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo abrir la página.",
        ),
      );
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedPage, session]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const ensureSession = async (
    providerName: string,
    selectedDevice?: LocalScannerDevice,
  ) => {
    if (session) return session;
    if (!form.contextId || !form.label.trim())
      throw new Error(
        "Seleccione el registro y escriba la etiqueta documental.",
      );
    const created = await dataSource.createScanSession({
      contextType: form.contextType,
      contextId: form.contextId,
      label: form.label.trim(),
      replaceDocumentId: form.replaceDocumentId || null,
      acquisitionProvider: providerName,
      deviceId: selectedDevice?.id ?? null,
      deviceName: selectedDevice?.name ?? null,
      resolutionDpi,
      colorMode,
      duplex,
    });
    setSession(created);
    return created;
  };

  const uploadPages = async (
    files: File[],
    source: ScanPageSource,
    providerName = "BrowserImport",
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    let current = session;
    let uploadedCount = 0;
    try {
      current = await ensureSession(providerName);
      for (const file of files) {
        const actualSource =
          file.type === "application/pdf" ? "PdfImport" : source;
        current = await dataSource.addScanPage(current.id, file, {
          clientPageId: crypto.randomUUID(),
          source: actualSource,
        });
        uploadedCount += 1;
        setSession(current);
      }
      setSession(current);
      setSelectedPageId(
        current.pages.filter((page) => page.status === "Ready").at(-1)?.id ??
          null,
      );
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setNotice(`${files.length} archivo(s) agregado(s).`);
    } catch (caught) {
      if (current) setSession(current);
      const detail =
        caught instanceof Error
          ? caught.message
          : "No se pudieron incorporar las páginas.";
      setError(
        uploadedCount > 0
          ? `Se agregaron ${uploadedCount} de ${files.length} archivo(s). Revise las páginas incorporadas antes de reintentar. ${detail}`
          : detail,
      );
    } finally {
      setBusy(false);
    }
  };

  const scanWithAgent = async () => {
    const selectedDevice = devices.find((device) => device.id === deviceId);
    if (!selectedDevice) return;
    setBusy(true);
    setError(null);
    let activeSession = session;
    try {
      const providerName = `NAPS2-${selectedDevice.driver}`;
      const current = await ensureSession(providerName, selectedDevice);
      activeSession = current;
      const file = await acquireFromScanner({
        deviceId,
        resolutionDpi,
        colorMode,
        duplex,
        useFeeder,
      });
      const updated = await dataSource.addScanPage(current.id, file, {
        clientPageId: crypto.randomUUID(),
        source: "Scanner",
      });
      setSession(updated);
      setSelectedPageId(updated.pages.at(-1)?.id ?? null);
      setPreviewUrl(null);
      setNotice(
        `${updated.pages.length - current.pages.length} página(s) digitalizada(s) con ${selectedDevice.name}.`,
      );
    } catch (caught) {
      const message = caught instanceof Error
        ? caught.message
        : "La adquisición no pudo completarse.";
      if (activeSession) {
        try {
          const failed = await dataSource.reportScanFailure(
            activeSession.id,
            "AGENT_ACQUISITION_FAILED",
            message,
          );
          setSession(failed);
        } catch {
          // El error original es el que debe orientar la recuperación del usuario.
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const updateSession = async (action: () => Promise<ScanSession>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setSession(updated);
      setPreviewUrl(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar el borrador.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reorder = async (sourceId: string, targetId: string) => {
    if (!session || sourceId === targetId) return;
    const ids = activePages.map((page) => page.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await updateSession(() => dataSource.reorderScanPages(session.id, ids));
  };

  const preview = async () => {
    if (!session || !activePages.length) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await dataSource.previewScanSession(session.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setSession(await dataSource.getScanSession(session.id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo generar la vista previa final.",
      );
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!session || !previewUrl) return;
    setBusy(true);
    setError(null);
    let document: DocumentRecord;
    try {
      document = await dataSource.completeScanSession(session.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo confirmar el documento.",
      );
      setBusy(false);
      return;
    }

    try {
      await onCompleted(document);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `El PDF quedó guardado en Archivo digital, pero no se pudo actualizar la vista relacionada. ${caught.message}`
          : "El PDF quedó guardado en Archivo digital, pero no se pudo actualizar la vista relacionada.",
      );
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!session || !activePages.length) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setSession(await dataSource.saveScanDraft(session.id));
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `No se pudo guardar el borrador. Reintente o descarte la sesión. ${caught.message}`
          : "No se pudo guardar el borrador. Reintente o descarte la sesión.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const configured = contexts?.[form.contextType]?.find((item) => item.id === form.contextId)?.label;
    if (configured) {
      setSelectedContextLabel(configured);
      return;
    }
    if (!open || !form.contextId || !loadContexts || !["Client", "Student", "LegalCase"].includes(form.contextType)) {
      setSelectedContextLabel(form.contextId ? "Registro relacionado" : "");
      return;
    }
    let active = true;
    loadContexts(form.contextType as "Client" | "Student" | "LegalCase", "", form.contextId)
      .then((items) => { if (active) setSelectedContextLabel(items.find((item) => item.value === form.contextId)?.label ?? "Registro no disponible"); })
      .catch(() => { if (active) setSelectedContextLabel("Registro no disponible"); });
    return () => { active = false; };
  }, [contexts, form.contextId, form.contextType, loadContexts, open]);
  return (
    <Modal
      size="xl"
      open={open}
      onClose={close}
      title={
        session ? `Digitalización · ${session.label}` : "Digitalizar documento"
      }
      description={
        session
          ? "Revise, ordene y confirme las páginas."
          : "Seleccione el destino y agregue las páginas del documento."
      }
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={close}>
            {session?.pages.length ? "Guardar y salir" : "Cancelar"}
          </Button>
          {session && (
            <Button
              variant="secondary"
              disabled={busy || !activePages.length}
              onClick={preview}
            >
              <MonitorUp size={16} />
              Generar vista previa
            </Button>
          )}
          {session && (
            <Button disabled={busy || !previewUrl} onClick={complete}>
              Confirmar PDF
            </Button>
          )}
        </>
      }
    >
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="operation-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </div>
      )}
      {!session ? (
        <div className="scan-start-layout">
          <section className="scan-form-section">
            <div className="scan-form-section__heading">
              <span>
                <FilePlus2 size={20} />
              </span>
              <div>
                <h3>1. Documento y destino</h3>
                <small>Defina dónde se guardará el documento.</small>
              </div>
            </div>
            <div className="form-grid">
              {contextLocked ? (
                <ReadOnlyValue
                  label="Tipo de registro"
                  value={
                    form.contextType === "Client"
                      ? "Usuario"
                      : form.contextType === "Student"
                        ? "Alumno"
                        : form.contextType === "LegalCase"
                          ? "Expediente"
                          : form.contextType === "CaseRequirement"
                            ? "Requisito del expediente"
                            : "Registro relacionado"
                  }
                />
              ) : (
                <Field label="Tipo de registro">
                  <Select
                    value={form.contextType}
                    onChange={(event) => {
                      const contextType = event.target.value as DocumentContext;
                      setForm({
                        ...form,
                        contextType,
                        contextId: "",
                        replaceDocumentId: "",
                      });
                    }}
                  >
                    <option value="Client">Usuario</option>
                    <option value="Student">Alumno</option>
                    <option value="LegalCase">Expediente</option>
                  </Select>
                </Field>
              )}
              {contextLocked ? (
                <ReadOnlyValue
                  label="Registro relacionado"
                  value={selectedContextLabel || "Cargando…"}
                />
              ) : loadContexts ? (
                <RelationLookup label="Registro relacionado" required value={form.contextId} onChange={(contextId) => setForm({ ...form, contextId, replaceDocumentId: "" })} load={(term) => loadContexts(form.contextType as "Client" | "Student" | "LegalCase", term, form.contextId)} />
              ) : (
                <Field label="Registro relacionado">
                  <Select value={form.contextId} onChange={(event) => setForm({ ...form, contextId: event.target.value, replaceDocumentId: "" })}>
                    {contexts?.[form.contextType]?.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </Select>
                </Field>
              )}
              <Field
                label="Etiqueta documental *"
                hint="Ej. DPI, certificación de nacimiento o memorial"
              >
                <input
                  required
                  value={form.label}
                  onChange={(event) =>
                    setForm({ ...form, label: event.target.value })
                  }
                />
              </Field>
              <RelationLookup
                label="Nueva versión de"
                value={form.replaceDocumentId}
                onChange={(replaceDocumentId) => setForm((current) => ({
                  ...current,
                  replaceDocumentId,
                  label: replacementLabels.current.get(replaceDocumentId) ?? current.label,
                }))}
                load={loadReplacementDocuments}
                emptyLabel="Documento nuevo"
              />
            </div>
          </section>
          <section className="scan-form-section">
            <div className="scan-form-section__heading">
              <span>
                <ScanLine size={20} />
              </span>
              <div>
                <h3>2. Escáner y calidad</h3>
                <small>Seleccione el equipo y la calidad de captura.</small>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Resolución">
                <Select
                  value={resolutionDpi}
                  onChange={(event) =>
                    setResolutionDpi(Number(event.target.value))
                  }
                >
                  <option value="150">150 DPI</option>
                  <option value="200">200 DPI</option>
                  <option value="300">300 DPI · recomendado</option>
                  <option value="600">600 DPI</option>
                </Select>
              </Field>
              <Field label="Color">
                <Select
                  value={colorMode}
                  onChange={(event) =>
                    setColorMode(event.target.value as typeof colorMode)
                  }
                >
                  <option value="Color">Color</option>
                  <option value="Grayscale">Escala de grises</option>
                  <option value="BlackAndWhite">Blanco y negro</option>
                </Select>
              </Field>
            </div>
            <div className="scan-choice-row">
              <label className="choice-card">
                <input
                  type="checkbox"
                  checked={useFeeder}
                  onChange={(event) => setUseFeeder(event.target.checked)}
                />
                <span>
                  <strong>Alimentador ADF</strong>
                  <small>Varias hojas consecutivas</small>
                </span>
              </label>
              <label className="choice-card">
                <input
                  type="checkbox"
                  checked={duplex}
                  onChange={(event) => setDuplex(event.target.checked)}
                />
                <span>
                  <strong>Doble cara</strong>
                  <small>Si el dispositivo lo admite</small>
                </span>
              </label>
            </div>
            {agentReady && devices.length > 0 && (
              <div className="scanner-action">
                <Field label="Escáner disponible">
                  <Select
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}
                  >
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} · {device.driver}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  disabled={busy || !form.contextId || !form.label.trim()}
                  onClick={scanWithAgent}
                >
                  <ScanLine size={16} />
                  Escanear
                </Button>
              </div>
            )}
            {!agentReady && (
              <div className="wizard-inline-note">
                <strong>Escaneo no disponible</strong>
                <span>
                  Abra el asistente de escaneo en esta computadora e inténtelo
                  nuevamente.
                </span>
              </div>
            )}
            {agentReady && devices.length === 0 && (
              <div className="wizard-inline-note">
                <strong>No hay escáneres disponibles</strong>
                <span>Compruebe que el equipo esté encendido y conectado.</span>
              </div>
            )}
            <Button
              variant="secondary"
              disabled={busy || !form.contextId || !form.label.trim()}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} />
              Importar PDF o imágenes
            </Button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/tiff,image/webp"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) void uploadPages(files, "Upload");
                event.target.value = "";
              }}
            />
          </section>
          {drafts.length > 0 && (
            <section className="scan-form-section scan-drafts">
              <div className="scan-form-section__heading">
                <span>
                  <Save size={20} />
                </span>
                <div>
                  <h3>Borradores recuperables</h3>
                  <small>
                    Continúe una sesión sin repetir páginas ya cargadas.
                  </small>
                </div>
              </div>
              {drafts.map((draft) => (
                <button
                  type="button"
                  key={draft.id}
                  onClick={() => {
                    setSession(draft);
                    setForm({
                      contextType: draft.contextType as DocumentContext,
                      contextId: draft.contextId,
                      label: draft.label,
                      replaceDocumentId: draft.replaceDocumentId ?? "",
                    });
                    setSelectedPageId(draft.pages[0]?.id ?? null);
                  }}
                >
                  <strong>{draft.label}</strong>
                  <span>
                    {draft.pages.length} páginas ·{" "}
                    {formatDateTime(draft.lastSavedAtUtc ?? draft.createdAtUtc)}
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      ) : (
        <div className="scan-workspace">
          <aside className="scan-pages-panel">
            <header>
              <div>
                <strong>Páginas</strong>
                <small>{activePages.length} en el PDF</small>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInput.current?.click()}
              >
                <FilePlus2 size={15} />
                Agregar
              </Button>
            </header>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/tiff,image/webp"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) void uploadPages(files, "Upload");
                event.target.value = "";
              }}
            />
            <div className="scan-thumbnails">
              {activePages.map((page) => (
                <div
                  key={page.id}
                  draggable
                  onDragStart={() => setDraggedPageId(page.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedPageId) void reorder(draggedPageId, page.id);
                    setDraggedPageId(null);
                  }}
                >
                  <GripVertical size={15} aria-hidden="true" />
                  <PageImage
                    sessionId={session.id}
                    page={page}
                    active={selectedPage?.id === page.id}
                    onSelect={() => setSelectedPageId(page.id)}
                  />
                </div>
              ))}
            </div>
          </aside>
          <main className="scan-stage">
            <header>
              <div>
                <strong>
                  {selectedPage
                    ? `Página ${selectedPage.position + 1}`
                    : "Sin páginas"}
                </strong>
                <small>
                  {selectedPage
                    ? `${selectedPage.originalFileName} · ${formatBytes(selectedPage.sizeBytes)}`
                    : "Agregue una captura o archivo"}
                </small>
              </div>
              {selectedPage && (
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      updateSession(() =>
                        dataSource.rotateScanPage(
                          session.id,
                          selectedPage.id,
                          (selectedPage.rotationDegrees + 90) % 360,
                        ),
                      )
                    }
                  >
                    <RotateCw size={15} />
                    Girar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      updateSession(() =>
                        dataSource.removeScanPage(session.id, selectedPage.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                    Quitar
                  </Button>
                </div>
              )}
            </header>
            <div className="scan-canvas">
              {selectedUrl &&
                selectedPage?.contentType.startsWith("image/") && (
                  <img
                    src={selectedUrl}
                    alt={`Página ${selectedPage.position + 1}`}
                    style={{
                      transform: `rotate(${selectedPage.rotationDegrees}deg)`,
                    }}
                  />
                )}
              {selectedUrl &&
                selectedPage?.contentType === "application/pdf" && (
                  <iframe
                    src={`${selectedUrl}#page=${selectedPage.sourcePageNumber ?? 1}`}
                    title={`Página ${selectedPage.position + 1}`}
                  />
                )}
              {!selectedPage && <p>La sesión aún no contiene páginas.</p>}
            </div>
          </main>
          <aside className="scan-session-panel">
            <Badge tone="success">Borrador guardado</Badge>
            <h3>{session.label}</h3>
            <ReadOnlyValue
              label="Destino"
              value={selectedContextLabel || translate(session.contextType)}
            />
            <ReadOnlyValue
              label="Fuente inicial"
              value={translate(session.acquisitionProvider)}
            />
            <ReadOnlyValue
              label="Último guardado"
              value={formatDateTime(
                session.lastSavedAtUtc ?? session.createdAtUtc,
              )}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                updateSession(() => dataSource.saveScanDraft(session.id))
              }
            >
              <Save size={15} />
              Guardar borrador
            </Button>
            {previewUrl && (
              <div className="scan-final-preview">
                <strong>PDF listo para confirmar</strong>
                <iframe src={previewUrl} title="Vista previa del PDF final" />
                <a
                  className="button button--secondary"
                  href={previewUrl}
                  download={`${session.label}.pdf`}
                >
                  <Download size={15} />
                  Descargar prueba
                </a>
              </div>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={15} />
              Más páginas
            </Button>
            {agentReady && devices.length > 0 && (
              <Button disabled={busy} onClick={scanWithAgent}>
                <RefreshCw size={15} />
                Escanear más
              </Button>
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
