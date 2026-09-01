import { CheckCircle2, Eye, Mail, Plus, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Pagination } from "../components/domain/Shared";
import {
  Badge,
  Button,
  Card,
  DateRangePickerField,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAsyncData } from "../hooks/useAsyncData";
import type { WeeklyReport } from "../types/domain";
import {
  formatDate,
  formatDateTime,
  statusTone,
  translate,
} from "../utils/format";
import { toLocalDateOnly } from "../utils/date";

const isoDate = (date: Date) => toLocalDateOnly(date);

export function ReportsPage() {
  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => {
    const value = new Date(today);
    value.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return value;
  }, [today]);
  const sunday = useMemo(() => {
    const value = new Date(monday);
    value.setDate(monday.getDate() + 6);
    return value;
  }, [monday]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [preview, setPreview] = useState<WeeklyReport | null>(null);
  const [selected, setSelected] = useState<WeeklyReport | null>(null);
  const [start, setStart] = useState(isoDate(monday));
  const [end, setEnd] = useState(isoDate(sunday));
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("Reporte semanal de actividades");
  const [message, setMessage] = useState(
    "Adjunto el reporte semanal de actividades del Bufete Jurídico.",
  );
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.listReports({ page, pageSize: 20 }),
    [page],
  );

  const generate = async () => {
    setBusy(true);
    setActionError("");
    try {
      await dataSource.generateReport(start, end);
      setGenerateOpen(false);
      await reload();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "No se pudo generar el reporte.",
      );
    } finally {
      setBusy(false);
    }
  };

  const review = async (report: WeeklyReport) => {
    setBusy(true);
    setActionError("");
    try {
      await dataSource.reviewReport(report.id);
      await reload();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "No se pudo revisar el reporte.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openSend = (report: WeeklyReport) => {
    setSelected(report);
    setSendOpen(true);
    setActionError("");
  };

  const send = async () => {
    if (!selected) return;
    const addresses = recipients
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    setBusy(true);
    setActionError("");
    try {
      await dataSource.sendReport(selected.id, addresses, subject, message);
      setSendOpen(false);
      await reload();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "No se pudo enviar el reporte.",
      );
    } finally {
      setBusy(false);
    }
  };

  const printReport = (report: WeeklyReport) => {
    const popup = window.open("", "_blank");
    if (!popup) {
      setActionError(
        "El navegador bloqueó la ventana de impresión. Habilite ventanas emergentes para este sitio.",
      );
      return;
    }
    popup.opener = null;
    popup.document.open();
    popup.document.write(report.printableHtml);
    popup.document.close();
    popup.setTimeout(() => popup.print(), 150);
  };

  return (
    <>
      <PageHeader
        eyebrow="Informes institucionales"
        title="Reportes"
        description="Generación, revisión, impresión y envío de la actividad semanal."
        actions={
          <Button
            onClick={() => {
              setActionError("");
              setGenerateOpen(true);
            }}
          >
            <Plus size={18} />
            Generar reporte
          </Button>
        }
      />
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      <div className="report-layout">
        <Card>
          <SectionHeading
            title="Reportes semanales"
            description="Historial y estado de cada período"
          />
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} retry={reload} />
          ) : data?.items.length ? (
            <>
              <div className="report-list">
                {data.items.map((report) => (
                <article key={report.id}>
                  <span className="report-list__date">
                    <strong>
                      {new Date(`${report.periodStart}T12:00:00`).getDate()}
                    </strong>
                    <small>
                      {new Intl.DateTimeFormat("es-GT", {
                        month: "short",
                      }).format(new Date(`${report.periodStart}T12:00:00`))}
                    </small>
                  </span>
                  <div>
                    <strong>
                      Reporte del {formatDate(report.periodStart)} al{" "}
                      {formatDate(report.periodEnd)}
                    </strong>
                    <small>
                      {report.activityCount} actividades ·{" "}
                      {report.sentAtUtc
                        ? `Enviado ${formatDateTime(report.sentAtUtc)}`
                        : "Pendiente de envío"}
                    </small>
                  </div>
                  <Badge tone={statusTone(report.status)}>
                    {translate(report.status)}
                  </Badge>
                  <div className="inline-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Vista previa del reporte ${report.periodStart}`}
                      onClick={() => setPreview(report)}
                    >
                      <Eye size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Imprimir reporte ${report.periodStart}`}
                      onClick={() => printReport(report)}
                    >
                      <Printer size={17} />
                    </Button>
                    {report.status === "Draft" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => review(report)}
                      >
                        <CheckCircle2 size={15} />
                        Revisar
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openSend(report)}
                      disabled={busy || report.status !== "Reviewed"}
                    >
                      <Mail size={15} />
                      Enviar
                    </Button>
                  </div>
                </article>
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
            <p className="muted-copy">Todavía no se han generado reportes.</p>
          )}
        </Card>
        <Card className="report-preview">
          <SectionHeading
            title="Ciclo de reporte"
            description="Control antes de compartir"
          />
          <div className="report-flow">
            <div className="done">
              <span>
                <CheckCircle2 />
              </span>
              <div>
                <strong>1. Generar</strong>
                <small>Consolidar actividades</small>
              </div>
            </div>
            <i />
            <div className="current">
              <span>
                <Eye />
              </span>
              <div>
                <strong>2. Revisar</strong>
                <small>Validar contenido</small>
              </div>
            </div>
            <i />
            <div>
              <span>
                <Mail />
              </span>
              <div>
                <strong>3. Enviar</strong>
                <small>Registrar resultado</small>
              </div>
            </div>
          </div>
          <div className="report-paper">
            <span className="paper-line paper-line--title" />
            <span className="paper-line" />
            <span className="paper-line" />
            <span className="paper-line paper-line--short" />
            <div className="paper-table">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </div>
          <p>La vista imprimible incluye las actividades registradas del período.</p>
        </Card>
      </div>
      <Modal
        open={generateOpen}
        onClose={() => !busy && setGenerateOpen(false)}
        title="Generar reporte semanal"
        description="Se incluirán las actividades comprendidas en el rango seleccionado."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setGenerateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !start || !end || end < start}
              onClick={generate}
            >
              {busy ? "Generando…" : "Generar borrador"}
            </Button>
          </>
        }
      >
        <DateRangePickerField
          label="Período del reporte"
          startValue={start}
          endValue={end}
          onChange={(nextStart, nextEnd) => { setStart(nextStart); setEnd(nextEnd); }}
          hint="Seleccione el inicio y el final en el mismo calendario."
          required
        />
        {actionError && <p className="form-error">{actionError}</p>}
      </Modal>
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Vista previa del reporte"
        description={
          preview
            ? `${formatDate(preview.periodStart)} al ${formatDate(preview.periodEnd)}`
            : ""
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cerrar
            </Button>
            {preview && (
              <Button onClick={() => printReport(preview)}>
                <Printer size={15} />
                Imprimir
              </Button>
            )}
          </>
        }
      >
        <iframe
          className="report-html-preview"
          title="Contenido imprimible del reporte"
          srcDoc={preview?.printableHtml ?? ""}
          sandbox=""
          referrerPolicy="no-referrer"
        />
      </Modal>
      <Modal
        open={sendOpen}
        onClose={() => !busy && setSendOpen(false)}
        title="Enviar reporte por correo"
        description="Disponible para reportes revisados."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setSendOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !recipients.trim() || !subject.trim()}
              onClick={send}
            >
              <Mail size={15} />
              {busy ? "Enviando…" : "Confirmar envío"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Destinatarios (separados por coma)">
            <input
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
            />
          </Field>
          <Field label="Asunto">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </Field>
          <Field label="Mensaje">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </Field>
        </div>
        {actionError && <p className="form-error">{actionError}</p>}
      </Modal>
    </>
  );
}
