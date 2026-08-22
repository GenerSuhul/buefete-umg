import {
  Download,
  ExternalLink,
  FileText,
  HardDriveUpload,
  ScanLine,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterBar, Pagination } from "../components/domain/Shared";
import { ScanWorkspace } from "../components/documents/ScanWorkspace";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  FilePicker,
  FileThumbnail,
  LoadingState,
  Modal,
  PageHeader,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAsyncData } from "../hooks/useAsyncData";
import type { DocumentRecord } from "../types/domain";
import { formatBytes, formatDateTime, translate } from "../utils/format";

type BaseContext = "Client" | "Student" | "LegalCase";

const initialDocumentForm = {
  contextType: "Client" as BaseContext,
  contextId: "",
  label: "",
  replaceDocumentId: "",
};

export function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const queryHandled = useRef(false);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentRecord | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loader = useMemo(
    () => () => dataSource.listDocuments({ search, pageSize: 100 }),
    [search],
  );
  const { data, error, loading, reload } = useAsyncData(loader, [search]);
  const contexts = useAsyncData(async () => {
    const [clients, students, cases] = await Promise.all([
      dataSource.listClients({ pageSize: 100 }),
      dataSource.listStudents({ pageSize: 100 }),
      dataSource.listCases({ pageSize: 100 }),
    ]);
    return {
      Client: clients.items.map((item) => ({
        id: item.id,
        label: `${item.fullName} · ${item.receptionNumber}`,
      })),
      Student: students.items.map((item) => ({
        id: item.id,
        label: `${item.fullName} · ${item.studentCardNumber}`,
      })),
      LegalCase: cases.items.map((item) => ({
        id: item.id,
        label: `${item.caseNumber} · ${item.clientName}`,
      })),
    };
  }, []);

  useEffect(() => {
    if (!documentForm.contextId && contexts.data?.[documentForm.contextType][0])
      setDocumentForm((current) => ({
        ...current,
        contextId: contexts.data![current.contextType][0].id,
      }));
  }, [contexts.data, documentForm.contextId, documentForm.contextType]);

  useEffect(() => {
    if (queryHandled.current || !contexts.data) return;
    const contextType = searchParams.get("contextType") as BaseContext | null;
    const contextId = searchParams.get("contextId");
    const mode = searchParams.get("mode");
    if (
      contextType &&
      contextId &&
      ["Client", "Student", "LegalCase"].includes(contextType)
    ) {
      setDocumentForm({ ...initialDocumentForm, contextType, contextId });
      if (mode === "upload") setUploadOpen(true);
      if (mode === "scan") setScanOpen(true);
    }
    queryHandled.current = true;
  }, [contexts.data, searchParams]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const setContextType = (contextType: BaseContext) => {
    setDocumentForm((current) => ({
      ...current,
      contextType,
      contextId: contexts.data?.[contextType][0]?.id ?? "",
      replaceDocumentId: "",
    }));
  };

  const openUpload = () => {
    setDocumentForm({
      ...initialDocumentForm,
      contextId: contexts.data?.Client[0]?.id ?? "",
    });
    setSelectedFile(null);
    setOperationError(null);
    setUploadOpen(true);
  };

  const openScan = () => {
    setDocumentForm({
      ...initialDocumentForm,
      contextId: contexts.data?.Client[0]?.id ?? "",
    });
    setOperationError(null);
    setScanOpen(true);
  };

  const upload = async () => {
    if (!selectedFile || !documentForm.contextId || !documentForm.label.trim())
      return;
    setBusy(true);
    setOperationError(null);
    try {
      await dataSource.uploadDocument({
        file: selectedFile,
        contextType: documentForm.contextType,
        contextId: documentForm.contextId,
        label: documentForm.label.trim(),
        replaceDocumentId: documentForm.replaceDocumentId || null,
      });
      setUploadOpen(false);
      setNotice("Documento guardado.");
      await reload();
    } catch (caught) {
      setOperationError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar el documento.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (document: DocumentRecord) => {
    setPreviewDocument(document);
    setPreviewLoading(true);
    setOperationError(null);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const access = await dataSource.getDocumentReadAccess(document.id);
      if (access.url) setPreviewUrl(access.url);
      else {
        const blob = await dataSource.downloadDocument(document.id);
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (caught) {
      setOperationError(
        caught instanceof Error
          ? caught.message
          : "No se pudo abrir el documento.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const versions =
    data?.items.filter(
      (item) =>
        item.contextType === documentForm.contextType &&
        item.contextId === documentForm.contextId,
    ) ?? [];
  const contextFields = (
    <div className="form-grid">
      <Field label="Tipo de registro">
        <select
          value={documentForm.contextType}
          onChange={(event) =>
            setContextType(event.target.value as BaseContext)
          }
        >
          <option value="Client">Cliente</option>
          <option value="Student">Alumno</option>
          <option value="LegalCase">Expediente</option>
        </select>
      </Field>
      <Field label="Registro relacionado">
        <select
          value={documentForm.contextId}
          onChange={(event) =>
            setDocumentForm({
              ...documentForm,
              contextId: event.target.value,
              replaceDocumentId: "",
            })
          }
        >
          {contexts.data?.[documentForm.contextType].map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Etiqueta">
        <input
          value={documentForm.label}
          onChange={(event) =>
            setDocumentForm({ ...documentForm, label: event.target.value })
          }
          placeholder="Ej. DPI o certificación de nacimiento"
        />
      </Field>
      <Field label="Nueva versión de">
        <select
          value={documentForm.replaceDocumentId}
          onChange={(event) =>
            setDocumentForm({
              ...documentForm,
              replaceDocumentId: event.target.value,
            })
          }
        >
          <option value="">Documento nuevo</option>
          {versions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · v{item.versionNumber}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Archivo digital"
        title="Documentos"
        description="Carga, escaneo, versiones y consulta segura en almacenamiento privado."
        actions={
          <>
            <Button variant="secondary" onClick={openScan}>
              <ScanLine size={18} />
              Escanear
            </Button>
            <Button onClick={openUpload}>
              <Upload size={18} />
              Subir archivo
            </Button>
          </>
        }
      />
      {notice && (
        <div className="operation-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </div>
      )}
      <div className="document-kpis">
        <Card>
          <span>
            <FileText />
          </span>
          <div>
            <strong>{data?.totalCount ?? 0}</strong>
            <small>documentos actuales</small>
          </div>
        </Card>
        <Card>
          <span>
            <ScanLine />
          </span>
          <div>
            <strong>
              {data?.items.filter((item) => item.source === "Scanner").length ??
                0}
            </strong>
            <small>adquiridos por escáner</small>
          </div>
        </Card>
        <Card>
          <span>
            <HardDriveUpload />
          </span>
          <div>
            <strong>
              {formatBytes(
                data?.items.reduce((sum, item) => sum + item.sizeBytes, 0) ?? 0,
              )}
            </strong>
            <small>en la vista actual</small>
          </div>
        </Card>
      </div>
      <Card className="directory-card">
        <FilterBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o etiqueta…"
        />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : data?.items.length ? (
          <>
            <div className="documents-grid">
              {data.items.map((document) => (
                <button
                  className="document-card"
                  type="button"
                  key={document.id}
                  onClick={() => openPreview(document)}
                >
                  <span className="document-card__preview">
                    {document.contentType.startsWith("image/") ? (
                      <FileThumbnail
                        documentId={document.id}
                        alt={document.label}
                      />
                    ) : (
                      <FileText size={29} />
                    )}
                    <small>
                      {document.contentType.includes("pdf") ? "PDF" : "IMG"}
                    </small>
                  </span>
                  <span className="document-card__body">
                    <strong>{document.label}</strong>
                    <small>{document.originalFileName}</small>
                    <span>
                      {translate(document.contextType)} · v
                      {document.versionNumber}
                    </span>
                  </span>
                  <span className="document-card__footer">
                    <Badge
                      tone={
                        document.source === "Scanner"
                          ? "blue"
                          : document.source === "Generated"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {translate(document.source)}
                    </Badge>
                    <small>
                      {formatBytes(document.sizeBytes)} ·{" "}
                      {formatDateTime(document.createdAtUtc)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              totalCount={data.totalCount}
            />
          </>
        ) : (
          <p className="muted-copy">Aún no hay documentos almacenados.</p>
        )}
      </Card>

      <Modal
        size="lg"
        open={uploadOpen}
        onClose={() => !busy && setUploadOpen(false)}
        title="Subir documento"
        description="Seleccione un PDF o una imagen de hasta 25 MB."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setUploadOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !selectedFile ||
                !documentForm.contextId ||
                !documentForm.label.trim()
              }
              onClick={upload}
            >
              {busy ? "Subiendo…" : "Guardar documento"}
            </Button>
          </>
        }
      >
        {operationError && (
          <div className="form-error" role="alert">
            {operationError}
          </div>
        )}
        <FilePicker
          label="Seleccionar documento"
          hint="PDF, JPG, PNG o WEBP · máximo 25 MB"
          file={selectedFile}
          onChange={setSelectedFile}
          required
        />
        {contextFields}
      </Modal>

      <ScanWorkspace
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        contexts={contexts.data ?? undefined}
        initialForm={documentForm}
        contextLocked={!!searchParams.get("contextId")}
        versions={versions}
        onCompleted={async () => {
          setNotice("Documento digitalizado y guardado.");
          await reload();
        }}
      />

      <Modal
        size="xl"
        open={!!previewDocument}
        onClose={() => {
          setPreviewDocument(null);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        title={previewDocument?.label ?? "Documento"}
        description={
          previewDocument
            ? `${previewDocument.originalFileName} · ${formatBytes(previewDocument.sizeBytes)}`
            : ""
        }
        footer={
          <>
            {previewUrl && (
              <a
                className="button button--secondary"
                href={previewUrl}
                download={previewDocument?.originalFileName}
              >
                <Download size={16} />
                Descargar
              </a>
            )}
            <Button
              variant="secondary"
              onClick={() => setPreviewDocument(null)}
            >
              Cerrar
            </Button>
          </>
        }
      >
        {previewLoading ? (
          <LoadingState />
        ) : operationError ? (
          <div className="form-error">{operationError}</div>
        ) : (
          previewUrl &&
          previewDocument &&
          (previewDocument.contentType.startsWith("image/") ? (
            <img
              className="document-preview"
              src={previewUrl}
              alt={previewDocument.label}
            />
          ) : (
            <iframe
              className="document-preview-frame"
              src={previewUrl}
              title={previewDocument.label}
            />
          ))
        )}
        {previewUrl && (
          <a
            className="document-open-link"
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} />
            Abrir en otra pestaña
          </a>
        )}
      </Modal>
    </>
  );
}
