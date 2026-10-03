import { ArchiveRestore, FileX2, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Pagination } from "../components/domain/Shared";
import { Badge, Button, Card, ErrorState, LoadingState, PageHeader, Select } from "../components/ui";
import { useConfirm } from "../components/ui/Feedback";
import { dataSource } from "../data/dataSource";
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
  const [search, setSearch] = useState("");
  const [type, setType] = useState<DeletedRecordType | "">("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  return (
    <>
      <PageHeader eyebrow="Administración" title="Eliminados" description="Registros retirados de la operación y disponibles para restauración." />
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
                <Button variant="secondary" size="sm" disabled={busyId === record.id} onClick={() => restore(record)}><ArchiveRestore size={16} />{busyId === record.id ? "Restaurando…" : "Restaurar"}</Button>
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><Trash2 size={28} /><strong>No hay registros eliminados</strong><p>Los elementos retirados aparecerán en esta sección.</p></div>}
        {data ? <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /> : null}
      </Card>
    </>
  );
}
