import {
  FileText,
  HardDriveUpload,
  ScanLine,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "../routing/navigation";
import { FilterBar, Pagination } from "../components/domain/Shared";
import { DocumentAcquisition } from "../components/documents/DocumentAcquisition";
import {
  Badge,
  Button,
  Card,
  DocumentViewer,
  ErrorState,
  FileThumbnail,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAuth } from "../context/AuthContext";
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
  const { user } = useAuth();
  const canAttachDocuments = Boolean(user?.permissions.includes("*") || user?.permissions.includes("documents.write"));
  const [searchParams] = useSearchParams();
  const queryHandled = useRef(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [previewDocument, setPreviewDocument] = useState<DocumentRecord | null>(
    null,
  );
  const [previewHistory, setPreviewHistory] = useState<DocumentRecord[]>([]);

  const loader = useMemo(
    () => () => dataSource.listDocuments({ search, page, pageSize: 24 }),
    [search, page],
  );
  const { data, error, loading, reload } = useAsyncData(loader, [search, page]);
  const loadContextOptions = useCallback(async (contextType: BaseContext, term: string, selectedId?: string) => {
    const items = contextType === "Client"
      ? (await dataSource.listClients({ search: term, pageSize: 20 })).items.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.receptionNumber}` }))
      : contextType === "Student"
        ? (await dataSource.listStudents({ search: term, pageSize: 20 })).items.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.studentCardNumber}` }))
        : (await dataSource.listCases({ search: term, pageSize: 20 })).items.map((item) => ({ value: item.id, label: `${item.caseNumber} · ${item.clientName}` }));
    if (!selectedId || items.some((item) => item.value === selectedId)) return items;
    try {
      if (contextType === "Client") {
        const selected = (await dataSource.getClient(selectedId)).client;
        return [{ value: selected.id, label: `${selected.fullName} · ${selected.receptionNumber}` }, ...items];
      }
      if (contextType === "Student") {
        const selected = (await dataSource.getStudent(selectedId)).student;
        return [{ value: selected.id, label: `${selected.fullName} · ${selected.studentCardNumber}` }, ...items];
      }
      const selected = (await dataSource.getCase(selectedId)).summary;
      return [{ value: selected.id, label: `${selected.caseNumber} · ${selected.clientName}` }, ...items];
    } catch {
      return items;
    }
  }, []);
  const loadCompleteHistory = useCallback(async (document: DocumentRecord) => {
    const first = await dataSource.listDocumentHistory(
      document.contextType,
      document.contextId,
      { label: document.label, page: 1, pageSize: 100 },
    );
    if (first.totalPages <= 1) return first.items;
    const remaining = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, index) =>
        dataSource.listDocumentHistory(document.contextType, document.contextId, {
          label: document.label,
          page: index + 2,
          pageSize: 100,
        }),
      ),
    );
    return [first, ...remaining].flatMap((pageResult) => pageResult.items);
  }, []);

  useEffect(() => {
    if (queryHandled.current) return;
    const contextType = searchParams.get("contextType") as BaseContext | null;
    const contextId = searchParams.get("contextId");
    const mode = searchParams.get("mode");
    if (
      contextType &&
      contextId &&
      ["Client", "Student", "LegalCase"].includes(contextType)
    ) {
      setDocumentForm({ ...initialDocumentForm, contextType, contextId });
      if (canAttachDocuments && ["upload", "scan", "acquire"].includes(mode ?? "")) setAcquisitionOpen(true);
    }
    queryHandled.current = true;
  }, [searchParams, canAttachDocuments]);

  const openAcquisition = () => {
    setDocumentForm({
      ...initialDocumentForm,
      contextId: "",
    });
    setAcquisitionOpen(true);
  };

  const openPreview = async (document: DocumentRecord) => {
    setPreviewDocument(document);
    try {
      const history = await loadCompleteHistory(document);
      setPreviewHistory(history);
    } catch { setPreviewHistory([]); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Archivo digital"
        title="Documentos"
        description="Carga, escaneo, versiones y consulta segura en almacenamiento privado."
        actions={canAttachDocuments ?
          <Button onClick={openAcquisition}>
            <Upload size={18} />
            Adjuntar documento
          </Button>
        : undefined}
      />
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
          onChange={(value) => { setSearch(value); setPage(1); }}
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
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="muted-copy">Aún no hay documentos almacenados.</p>
        )}
      </Card>

      <DocumentAcquisition
        open={acquisitionOpen}
        onClose={() => setAcquisitionOpen(false)}
        loadContexts={loadContextOptions}
        initialForm={documentForm}
        contextLocked={!!searchParams.get("contextId")}
        onCompleted={async () => {
          await reload();
        }}
      />

      <DocumentViewer
        open={!!previewDocument}
        documentId={previewDocument?.id ?? null}
        onClose={() => {
          setPreviewDocument(null);
          setPreviewHistory([]);
        }}
        label={previewDocument?.label ?? "Documento"}
        description={
          previewDocument
            ? `${previewDocument.originalFileName} · ${formatBytes(previewDocument.sizeBytes)}`
            : ""
        }
      >
        {previewHistory.length > 1 ? (
          <div className="document-version-history" aria-label="Historial de versiones">
            <strong>Historial de versiones</strong>
            {[...previewHistory]
              .sort((left, right) => right.versionNumber - left.versionNumber)
              .map((version) => (
                <Button
                  key={version.id}
                  variant={version.id === previewDocument?.id ? "secondary" : "ghost"}
                  size="sm"
                  disabled={version.id === previewDocument?.id}
                  onClick={() => openPreview(version)}
                >
                  v{version.versionNumber} · {version.isCurrent ? "Vigente" : formatDateTime(version.createdAtUtc)}
                </Button>
              ))}
          </div>
        ) : null}
      </DocumentViewer>
    </>
  );
}
