import { ArchiveRestore, FileX2, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Pagination } from "../components/domain/Shared";
import { Badge, Button, Card, ErrorState, Field, LoadingState, Modal, PageHeader, Select } from "../components/ui";
import { useConfirm, useNotify } from "../components/ui/Feedback";
import { dataSource } from "../data/dataSource";
import { demoEnabled } from "../demo/client";
import { useAuth } from "../context/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import type { DeletedRecord, DeletedRecordType } from "../types/domain";
import { formatDateTime } from "../utils/format";

const labels: Record<DeletedRecordType, string> = {
  Client: "Usuario",
  Student: "Alumno",
  LegalCase: "Expediente",
};

export function DeletedRecordsPage() {
  const confirm = useConfirm();
  const notify = useNotify();
  const { user } = useAuth();
  const canPurge = !demoEnabled && Boolean(user?.isPlatformAdmin);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<DeletedRecordType | "">("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgeRecord, setPurgeRecord] = useState<DeletedRecord | null>(null);
  const [preview, setPreview] = useState<{ reference: string; documentCount: number; documentBytes: number; blockReason: string | null } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const loader = useMemo(() => () => dataSource.listDeletedRecords({ search, type: type || undefined, page, pageSize: 25 }), [search, type, page]);
  const { data, error, loading, reload } = useAsyncData(loader, [search, type, page]);

  const restore = async (record: DeletedRecord) => {
    const accepted = await confirm({
      title: `Restaurar ${labels[record.type].toLowerCase()}`,
      message: `${record.name} volverá a aparecer en las vistas operativas.`,
      confirmLabel: "Restaurar",
    });
    if (!accepted) return;
    setBusyId(record.id);
    try {
      await dataSource.restoreDeletedRecord(record.type, record.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const openPurge = async (record: DeletedRecord) => {
    setPurgeRecord(record); setPreview(null); setConfirmation(""); setPurgeError(null); setPreviewLoading(true);
    try { setPreview(await dataSource.previewPurgeDeletedRecord(record.type, record.id)); }
    catch (error) { setPurgeError(error instanceof Error ? error.message : "No se pudo revisar el registro."); }
    finally { setPreviewLoading(false); }
  };

  const purge = async () => {
    if (!purgeRecord || !preview || confirmation !== preview.reference || preview.blockReason) return;
    setBusyId(purgeRecord.id); setPurgeError(null);
    try {
      const result = await dataSource.purgeDeletedRecord(purgeRecord.type, purgeRecord.id, confirmation);
      setPurgeRecord(null); await reload();
      const message = result.pendingStorageDeletes ? `${result.pendingStorageDeletes} archivos esperan limpieza. Puede reintentarla desde esta página.` : `${result.documentCount} documentos y sus archivos se retiraron.`;
      notify[result.pendingStorageDeletes ? "warning" : "success"]({ title: "Registro eliminado definitivamente", message });
    } catch (error) { setPurgeError(error instanceof Error ? error.message : "No se pudo eliminar el registro."); }
    finally { setBusyId(null); }
  };

  const retryStorageCleanup = async () => {
    try {
      const result = await dataSource.retryPendingStorageDeletes();
      notify[result.pending ? "warning" : "success"]({ title: "Limpieza de archivos", message: result.pending ? `${result.pending} archivos siguen pendientes.` : "No quedan archivos pendientes." });
    } catch (error) { notify.error({ title: "No se pudo limpiar archivos", message: error instanceof Error ? error.message : "Inténtelo de nuevo." }); }
  };

  return (
    <>
      <PageHeader eyebrow="Administración" title="Eliminados" description="Registros retirados de la operación y disponibles para restauración." />
      {canPurge ? <Button variant="secondary" onClick={retryStorageCleanup}>Reintentar limpieza de archivos</Button> : null}
      <Card className="deleted-records-card">
        <div className="deleted-records-toolbar">
          <label className="search-control"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nombre o referencia…" /></label>
          <Select aria-label="Filtrar por tipo" value={type} onChange={(event) => { setType(event.target.value as DeletedRecordType | ""); setPage(1); }}>
            <option value="">Todos los tipos</option>
            <option value="Client">Usuarios</option>
            <option value="Student">Alumnos</option>
            <option value="LegalCase">Expedientes</option>
          </Select>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState error={error} retry={reload} /> : data?.items.length ? (
          <div className="deleted-records-list">
            {data.items.map((record) => (
              <article key={`${record.type}-${record.id}`}>
                <span className="deleted-records-list__icon"><FileX2 size={20} /></span>
                <span><strong>{record.name}</strong><small>{record.reference}</small></span>
                <Badge tone="danger">{labels[record.type]}</Badge>
                <span><strong>{formatDateTime(record.deletedAtUtc)}</strong><small>{record.deletedByName ?? "Usuario no disponible"}</small></span>
                <span><strong>{record.reason || "Sin motivo registrado"}</strong><small>Motivo</small></span>
                <div className="deleted-records-list__actions">
                  <Button variant="secondary" size="sm" disabled={busyId === record.id} onClick={() => restore(record)}><ArchiveRestore size={16} />{busyId === record.id ? "Restaurando…" : "Restaurar"}</Button>
                  {canPurge ? <Button variant="danger" size="sm" disabled={busyId === record.id} onClick={() => openPurge(record)}><Trash2 size={16} />Eliminar definitivamente</Button> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><Trash2 size={28} /><strong>No hay registros eliminados</strong><p>Los elementos retirados aparecerán en esta sección.</p></div>}
        {data ? <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /> : null}
      </Card>
      <Modal open={Boolean(purgeRecord)} title="Eliminar definitivamente" description="Esta acción es irreversible y retirará los archivos propios del registro." onClose={() => { if (!busyId) setPurgeRecord(null); }} footer={<><Button variant="secondary" disabled={Boolean(busyId)} onClick={() => setPurgeRecord(null)}>Cancelar</Button><Button variant="danger" disabled={!preview || Boolean(preview.blockReason) || confirmation !== preview.reference || Boolean(busyId)} onClick={purge}>{busyId ? "Eliminando…" : "Eliminar definitivamente"}</Button></>}>
        {previewLoading ? <LoadingState /> : null}
        {purgeRecord && preview ? <><p><strong>{purgeRecord.name}</strong> · {preview.reference}</p><p>{preview.documentCount} documentos · {(preview.documentBytes / 1024 / 1024).toFixed(2)} MB registrados. Se retirarán también sus archivos y los registros relacionados que pertenezcan exclusivamente a este elemento.</p>{preview.blockReason ? <div className="form-error" role="alert">{preview.blockReason}</div> : <Field label={`Escriba ${preview.reference} para confirmar`}><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></Field>}</> : null}
        {purgeError ? <div className="form-error" role="alert">{purgeError}</div> : null}
      </Modal>
    </>
  );
}
