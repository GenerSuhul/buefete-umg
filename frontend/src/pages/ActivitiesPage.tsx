import { CalendarDays, ClipboardList, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { Pagination, RelationLookup } from "../components/domain/Shared";
import {
  Badge,
  Button,
  Card,
  AppDatePicker,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
  Select,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDateTime } from "../utils/format";

const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function ActivitiesPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    activityType: "Atención a cliente",
    occurredAt: nowLocal(),
    description: "",
    clientId: "",
    studentId: "",
    legalCaseId: "",
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.listActivities({ page, pageSize: 25 }),
    [page],
  );
  const loadClients = useCallback(async (term: string) => (await dataSource.listClients({ search: term, pageSize: 20 })).items.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.receptionNumber}` })), []);
  const loadStudents = useCallback(async (term: string) => (await dataSource.listStudents({ search: term, pageSize: 20 })).items.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.studentCardNumber}` })), []);
  const loadCases = useCallback(async (term: string) => (await dataSource.listCases({ search: term, pageSize: 20 })).items.map((item) => ({ value: item.id, label: `${item.caseNumber} · ${item.clientName}` })), []);

  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await dataSource.createActivity({
        occurredAtUtc: new Date(form.occurredAt).toISOString(),
        activityType: form.activityType,
        description: form.description.trim(),
        clientId: form.clientId || null,
        studentId: form.studentId || null,
        legalCaseId: form.legalCaseId || null,
      });
      setOpen(false);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo registrar la actividad.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Registro operativo"
        title="Actividades"
        description="Bitácora diaria de secretaría relacionada con alumnos, clientes y expedientes."
        actions={
          <>
            <span className="date-pill">
              <CalendarDays size={17} />
              Semana actual
            </span>
            <Button
              onClick={() => {
                setForm({
                  activityType: "Atención a cliente",
                  occurredAt: nowLocal(),
                  description: "",
                  clientId: "",
                  studentId: "",
                  legalCaseId: "",
                });
                setFormError(null);
                setOpen(true);
              }}
            >
              <Plus size={18} />
              Registrar actividad
            </Button>
          </>
        }
      />
      <div className="activity-layout">
        <Card>
          <SectionHeading
            title="Actividad registrada"
            description="Orden cronológico"
          />
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} retry={reload} />
          ) : (
            <>
              <div className="activity-feed">
                {data?.items.map((activity) => (
                  <article key={activity.id}>
                  <span className="activity-feed__icon">
                    <ClipboardList size={20} />
                  </span>
                  <div>
                    <div>
                      <strong>{activity.activityType}</strong>
                      <Badge tone={activity.isCorrected ? "warning" : "blue"}>
                        {activity.isCorrected ? "Corregida" : "Registrada"}
                      </Badge>
                    </div>
                    <p>{activity.description}</p>
                    <small>{formatDateTime(activity.occurredAtUtc)}</small>
                  </div>
                  </article>
                ))}
              </div>
              {data ? <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /> : null}
            </>
          )}
        </Card>
        <Card>
          <SectionHeading title="Resumen" description="Vista actual" />
          <div className="activity-total">
            <strong>{data?.totalCount ?? 0}</strong>
            <span>actividades</span>
          </div>
          <p className="muted-copy">Actividades incluidas en el reporte semanal.</p>
        </Card>
      </div>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Registrar actividad diaria"
        description="Tipo, fecha, descripción y registros relacionados."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button disabled={busy || !form.description.trim()} onClick={save}>
              {busy ? "Guardando…" : "Guardar actividad"}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="form-error" role="alert">
            {formError}
          </div>
        )}
        <div className="form-grid">
          <Field label="Tipo de actividad">
            <Select
              value={form.activityType}
              onChange={(event) =>
                setForm({ ...form, activityType: event.target.value })
              }
            >
              <option>Atención a cliente</option>
              <option>Atención a alumno</option>
              <option>Recepción de documentos</option>
              <option>Revisión de memorial</option>
              <option>Notificación judicial</option>
              <option>Otra actividad</option>
            </Select>
          </Field>
          <AppDatePicker
            label="Fecha y hora"
            preset="processDate"
            value={form.occurredAt}
            onChange={(occurredAt) => setForm({ ...form, occurredAt })}
            withTime
            required
          />
          <RelationLookup label="Cliente (opcional)" value={form.clientId} onChange={(clientId) => setForm({ ...form, clientId })} load={loadClients} emptyLabel="Sin cliente" />
          <RelationLookup label="Alumno (opcional)" value={form.studentId} onChange={(studentId) => setForm({ ...form, studentId })} load={loadStudents} emptyLabel="Sin alumno" />
          <RelationLookup label="Expediente (opcional)" value={form.legalCaseId} onChange={(legalCaseId) => setForm({ ...form, legalCaseId })} load={loadCases} emptyLabel="Sin expediente" />
          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
