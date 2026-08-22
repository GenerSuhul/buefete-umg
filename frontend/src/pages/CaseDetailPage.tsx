import {
  ArrowLeft,
  BellRing,
  Check,
  CircleDot,
  FileCheck2,
  FilePenLine,
  FileText,
  FolderKanban,
  Gavel,
  History,
  Plus,
  Send,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DetailTabs, InfoItem } from "../components/domain/Shared";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DatePickerField,
  ErrorState,
  Field,
  FilePicker,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAuth } from "../context/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import type {
  CaseRequirement,
  Memorial,
  MemorialVersion,
  TimelineType,
} from "../types/domain";
import {
  formatDate,
  formatDateTime,
  statusTone,
  translate,
} from "../utils/format";

const timelineIcons: Record<TimelineType, typeof History> = {
  CaseOpened: FolderKanban,
  RequirementUpdated: FileCheck2,
  Assignment: UserPlus,
  Memorial: FilePenLine,
  MemorialReview: FilePenLine,
  Presentation: Send,
  CourtNotification: BellRing,
  GeneralAction: History,
  StatusChange: CircleDot,
  Closure: Check,
  Reopening: History,
};

const localNow = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function CaseDetailPage() {
  const { user } = useAuth();
  const canWrite = Boolean(
    user?.permissions.includes("*") ||
      user?.permissions.some((permission) =>
        ["cases.write", "cases.assign", "cases.timeline.write"].includes(
          permission,
        ),
      ),
  );
  const { id = "" } = useParams();
  const [tab, setTab] = useState("summary");
  const [action, setAction] = useState<
    | "timeline"
    | "assign"
    | "requirement"
    | "counterparty"
    | "memorial"
    | "memorialVersion"
    | "memorialReview"
    | "presentation"
    | "notification"
    | "close"
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [timelineForm, setTimelineForm] = useState({
    type: "GeneralAction",
    occurredAt: localNow(),
    title: "",
    description: "",
    newStage: "",
    newStatus: "",
  });
  const [assignment, setAssignment] = useState({
    studentId: "",
    isPrimary: true,
  });
  const [requirement, setRequirement] = useState<CaseRequirement | null>(null);
  const [requirementForm, setRequirementForm] = useState({
    status: "Submitted",
    issueDate: "",
    notes: "",
    conditionMet: true,
    dataValue: "",
  });
  const [counterparty, setCounterparty] = useState({
    fullName: "",
    dpi: "",
    phone: "",
    residenceAddress: "",
    workAddress: "",
    notes: "",
  });
  const [memorial, setMemorial] = useState({
    title: "",
    notes: "",
    submittedByStudentId: "",
  });
  const [selectedMemorial, setSelectedMemorial] = useState<Memorial | null>(
    null,
  );
  const [selectedVersion, setSelectedVersion] =
    useState<MemorialVersion | null>(null);
  const [reviewForm, setReviewForm] = useState({
    outcome: "RequiresChanges",
    observations: "",
  });
  const [presentationForm, setPresentationForm] = useState({
    presentedAtUtc: localNow(),
    result: "",
    receiptFile: null as File | null,
  });
  const [notificationForm, setNotificationForm] = useState({
    notifiedAtUtc: localNow(),
    description: "",
    newStage: "",
  });
  const [closeForm, setCloseForm] = useState({
    closedAtUtc: localNow(),
    reason: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.getCase(id),
    [id],
  );
  const students = useAsyncData(
    () => dataSource.listStudents({ pageSize: 100 }),
    [],
  );

  const openAction = (value: typeof action) => {
    setFormError(null);
    setFile(null);
    setAction(value);
  };
  const saveTimeline = async () => {
    setBusy(true);
    setFormError(null);
    try {
      let documentId: string | null = null;
      if (file)
        documentId = (
          await dataSource.uploadDocument({
            file,
            contextType: "LegalCase",
            contextId: id,
            label: timelineForm.title || "Evidencia de actuación",
          })
        ).id;
      await dataSource.addTimelineEntry(id, {
        type: timelineForm.type,
        occurredAtUtc: new Date(timelineForm.occurredAt).toISOString(),
        title: timelineForm.title.trim(),
        description: timelineForm.description || null,
        performedByStudentId: null,
        documentId,
        newStage: timelineForm.newStage || null,
        newStatus: timelineForm.newStatus || null,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo registrar el paso.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveAssignment = async () => {
    if (!assignment.studentId) return;
    setBusy(true);
    setFormError(null);
    try {
      await dataSource.assignStudent(
        id,
        assignment.studentId,
        assignment.isPrimary,
      );
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo asignar al alumno.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveRequirement = async () => {
    if (!requirement) return;
    setBusy(true);
    setFormError(null);
    try {
      let documentId = requirement.documentId;
      if (file)
        documentId = (
          await dataSource.uploadDocument({
            file,
            contextType: "CaseRequirement",
            contextId: requirement.id,
            label: requirement.label,
            replaceDocumentId: requirement.documentId,
          })
        ).id;
      await dataSource.updateCaseRequirement(id, requirement.id, {
        status: requirementForm.status,
        documentId,
        dataValue: requirementForm.dataValue || null,
        conditionMet: requirementForm.conditionMet,
        documentIssueDate: requirementForm.issueDate || null,
        notes: requirementForm.notes || null,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar el requisito.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveCounterparty = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await dataSource.addCounterparty(id, {
        ...counterparty,
        dpi: counterparty.dpi || null,
        phone: counterparty.phone || null,
        residenceAddress: counterparty.residenceAddress || null,
        workAddress: counterparty.workAddress || null,
        notes: counterparty.notes || null,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo agregar la contraparte.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveMemorial = async () => {
    if (!file) return;
    setBusy(true);
    setFormError(null);
    try {
      const document = await dataSource.uploadDocument({
        file,
        contextType: "LegalCase",
        contextId: id,
        label: `Memorial · ${memorial.title}`,
      });
      await dataSource.createMemorial(id, {
        title: memorial.title.trim(),
        documentId: document.id,
        submittedByStudentId: memorial.submittedByStudentId || null,
        notes: memorial.notes || null,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo crear el memorial.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveMemorialVersion = async () => {
    if (!file || !selectedMemorial) return;
    setBusy(true);
    setFormError(null);
    try {
      const document = await dataSource.uploadDocument({
        file,
        contextType: "Memorial",
        contextId: selectedMemorial.id,
        label: `${selectedMemorial.title} · nueva versión`,
      });
      await dataSource.addMemorialVersion(id, selectedMemorial.id, {
        documentId: document.id,
        submittedByStudentId: memorial.submittedByStudentId || null,
        notes: memorial.notes || null,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo agregar la versión.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveMemorialReview = async () => {
    if (!selectedMemorial || !selectedVersion) return;
    setBusy(true);
    setFormError(null);
    try {
      let reviewedDocumentId: string | null = null;
      if (file)
        reviewedDocumentId = (
          await dataSource.uploadDocument({
            file,
            contextType: "Memorial",
            contextId: selectedMemorial.id,
            label: `Revisión · ${selectedMemorial.title}`,
          })
        ).id;
      await dataSource.reviewMemorial(id, selectedMemorial.id, {
        versionId: selectedVersion.id,
        outcome: reviewForm.outcome,
        observations: reviewForm.observations,
        reviewedDocumentId,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo registrar la revisión.",
      );
    } finally {
      setBusy(false);
    }
  };
  const savePresentation = async () => {
    if (!selectedMemorial) return;
    setBusy(true);
    setFormError(null);
    try {
      let presentedDocumentId: string | null = null;
      let receiptDocumentId: string | null = null;
      if (file)
        presentedDocumentId = (
          await dataSource.uploadDocument({
            file,
            contextType: "Memorial",
            contextId: selectedMemorial.id,
            label: `Presentado · ${selectedMemorial.title}`,
          })
        ).id;
      if (presentationForm.receiptFile)
        receiptDocumentId = (
          await dataSource.uploadDocument({
            file: presentationForm.receiptFile,
            contextType: "Memorial",
            contextId: selectedMemorial.id,
            label: `Constancia · ${selectedMemorial.title}`,
          })
        ).id;
      await dataSource.presentMemorial(id, selectedMemorial.id, {
        presentedAtUtc: new Date(presentationForm.presentedAtUtc).toISOString(),
        result: presentationForm.result,
        presentedDocumentId,
        receiptDocumentId,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo registrar la presentación.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveNotification = async () => {
    if (!file) return;
    setBusy(true);
    setFormError(null);
    try {
      const document = await dataSource.uploadDocument({
        file,
        contextType: "LegalCase",
        contextId: id,
        label: "Notificación judicial",
      });
      await dataSource.addCourtNotification(id, {
        notifiedAtUtc: new Date(notificationForm.notifiedAtUtc).toISOString(),
        description: notificationForm.description,
        documentId: document.id,
        newStage: notificationForm.newStage || null,
      });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo registrar la notificación.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveClose = async () => {
    setBusy(true);
    setFormError(null);
    try {
      if (data?.summary.status === "Closed")
        await dataSource.reopenCase(id, closeForm.reason);
      else
        await dataSource.closeCase(id, {
          closedAtUtc: new Date(closeForm.closedAtUtc).toISOString(),
          reason: closeForm.reason,
        });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cambiar el cierre del expediente.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return <LoadingState label="Reconstruyendo el expediente digital" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Expediente no encontrado")}
        retry={reload}
      />
    );
  const legalCase = data.summary;
  const accepted = data.requirements.filter(
    (item) => item.status === "Accepted" || item.status === "NotApplicable",
  ).length;

  return (
    <div className={canWrite ? "" : "read-only-view"}>
      <Link className="back-link" to="/expedientes">
        <ArrowLeft size={16} />
        Volver a expedientes
      </Link>
      <PageHeader
        eyebrow={legalCase.caseNumber}
        title={legalCase.clientName}
        description={`${legalCase.processTypeName} · Abierto ${formatDate(legalCase.openedAtUtc)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => openAction("assign")}>
              <UserPlus size={17} />
              Asignar alumno
            </Button>
            <Button
              variant="secondary"
              onClick={() => openAction("notification")}
            >
              <BellRing size={17} />
              Notificación
            </Button>
            <Button onClick={() => openAction("timeline")}>
              <Plus size={17} />
              Registrar paso
            </Button>
          </>
        }
      />
      <div className="case-overview-strip">
        <div>
          <small>Estado actual</small>
          <strong>{translate(legalCase.status)}</strong>
        </div>
        <div>
          <small>Etapa procesal</small>
          <strong>{legalCase.stage}</strong>
        </div>
        <div>
          <small>Responsable principal</small>
          <strong>
            {legalCase.assignments.find((item) => item.isPrimary)
              ?.studentName ?? "Sin asignar"}
          </strong>
        </div>
        <div>
          <small>Completitud documental</small>
          <strong>
            {accepted}/{data.requirements.length} requisitos
          </strong>
        </div>
        <Badge tone={statusTone(legalCase.status)}>
          {translate(legalCase.status)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCloseForm({ closedAtUtc: localNow(), reason: "" });
            openAction("close");
          }}
        >
          {legalCase.status === "Closed" ? "Reabrir" : "Cerrar caso"}
        </Button>
      </div>
      <DetailTabs
        tabs={[
          { id: "summary", label: "Resumen" },
          {
            id: "requirements",
            label: "Requisitos",
            count: data.requirements.length,
          },
          {
            id: "timeline",
            label: "Línea de tiempo",
            count: data.timeline.length,
          },
          {
            id: "memorials",
            label: "Memoriales",
            count: data.memorials.length,
          },
          {
            id: "people",
            label: "Personas",
            count: legalCase.assignments.length + data.counterparties.length,
          },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "summary" && (
        <div className="case-detail-grid">
          <Card className="case-last-step">
            <SectionHeading
              title="Último paso registrado"
              description="Movimiento más reciente del expediente"
            />
            <span className="case-last-step__icon">
              <BellRing size={24} />
            </span>
            <div>
              <Badge tone="blue">
                {legalCase.lastStep
                  ? translate(legalCase.lastStep.type)
                  : "Sin movimientos"}
              </Badge>
              <h2>
                {legalCase.lastStep?.title ?? "Aún no se han registrado pasos"}
              </h2>
              <p>{legalCase.lastStep?.description}</p>
              <small>{formatDateTime(legalCase.lastStep?.occurredAtUtc)}</small>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTab("timeline")}
            >
              Ver cronología
            </Button>
          </Card>
          <Card>
            <SectionHeading
              title="Requisitos documentales"
              description={`${accepted} de ${data.requirements.length} cubiertos`}
            />
            <div
              className="radial-progress"
              style={
                {
                  "--progress": `${(accepted / Math.max(data.requirements.length, 1)) * 100}%`,
                } as React.CSSProperties
              }
            >
              <div>
                <strong>
                  {Math.round(
                    (accepted / Math.max(data.requirements.length, 1)) * 100,
                  )}
                  %
                </strong>
                <span>completo</span>
              </div>
            </div>
          </Card>
          <Card>
            <SectionHeading title="Equipo asignado" />
            {legalCase.assignments.length ? (
              legalCase.assignments.map((item) => (
                <Link
                  className="assigned-person"
                  to={`/personas/alumnos/${item.studentId}`}
                  key={item.id}
                >
                  <Avatar
                    name={item.studentName}
                    documentId={item.studentPhotoDocumentId}
                    size="lg"
                  />
                  <span>
                    <strong>{item.studentName}</strong>
                    <small>
                      {item.isPrimary
                        ? "Responsable principal"
                        : "Alumno de apoyo"}
                    </small>
                  </span>
                  <Badge tone="success">{translate(item.status)}</Badge>
                </Link>
              ))
            ) : (
              <p className="muted-copy">Sin alumnos asignados.</p>
            )}
          </Card>
          <Card>
            <SectionHeading title="Datos clave" />
            <div className="info-grid info-grid--single">
              <InfoItem
                label="Número de expediente"
                value={legalCase.caseNumber}
              />
              <InfoItem
                label="Tipo de proceso"
                value={legalCase.processTypeName}
              />
              <InfoItem
                label="Fecha de apertura"
                value={formatDateTime(legalCase.openedAtUtc)}
              />
              <InfoItem
                label="Cliente"
                value={
                  <Link to={`/personas/clientes/${legalCase.clientId}`}>
                    {legalCase.clientName}
                  </Link>
                }
              />
            </div>
          </Card>
        </div>
      )}

      {tab === "requirements" && (
        <Card>
          <SectionHeading
            title="Lista documental del proceso"
            description="Archivo, vigencia, revisión y responsable"
          />
          <div className="requirement-progress">
            <span
              style={{
                width: `${data.requirements.length ? (accepted / data.requirements.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="requirement-cards">
            {data.requirements.map((item) => (
              <div
                className="requirement-card requirement-card--case"
                key={item.id}
              >
                <span
                  className={`requirement-card__icon ${item.status === "Pending" ? "pending" : ""}`}
                >
                  <FileText size={19} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.notes ??
                      (item.documentId
                        ? `Documento emitido ${formatDate(item.documentIssueDate)}`
                        : "Pendiente de documento")}
                  </small>
                </span>
                <Badge tone={statusTone(item.status)}>
                  {translate(item.status)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRequirement(item);
                    setRequirementForm({
                      status: item.status,
                      issueDate: item.documentIssueDate ?? "",
                      notes: item.notes ?? "",
                      conditionMet: item.conditionMet ?? true,
                      dataValue: item.dataValue ?? "",
                    });
                    openAction("requirement");
                  }}
                >
                  Revisar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "timeline" && (
        <Card>
          <SectionHeading
            title="Línea de tiempo procesal"
            description="Todos los pasos con autoría y evidencia"
            action={
              <Button size="sm" onClick={() => openAction("timeline")}>
                <Plus size={15} />
                Registrar paso
              </Button>
            }
          />
          <div className="timeline">
            {[...data.timeline].reverse().map((entry, index) => {
              const Icon = timelineIcons[entry.type];
              return (
                <div className="timeline-entry" key={entry.id}>
                  <span
                    className={`timeline-entry__icon ${index === 0 ? "current" : ""}`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="timeline-entry__line" />
                  <div>
                    <div className="timeline-entry__top">
                      <Badge tone={index === 0 ? "blue" : "neutral"}>
                        {translate(entry.type)}
                      </Badge>
                      <time>{formatDateTime(entry.occurredAtUtc)}</time>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.description}</p>
                    <small>
                      {entry.documentId ? "Documento adjunto · " : ""}Usuario
                      interno identificado
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "memorials" && (
        <Card>
          <SectionHeading
            title="Memoriales y revisiones"
            description="Versiones, observaciones y presentación conservadas"
            action={
              <Button size="sm" onClick={() => openAction("memorial")}>
                <Plus size={15} />
                Nuevo memorial
              </Button>
            }
          />
          {data.memorials.length ? (
            <div className="memorial-list">
              {data.memorials.map((item) => (
                <div className="memorial-card" key={item.id}>
                  <div className="memorial-card__header">
                    <span className="memorial-card__icon">
                      <FilePenLine size={21} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.versions.length} versión(es)</small>
                    </span>
                    <Badge tone={statusTone(item.status)}>
                      {translate(item.status)}
                    </Badge>
                    <div className="inline-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedMemorial(item);
                          setMemorial({
                            title: item.title,
                            notes: "",
                            submittedByStudentId: "",
                          });
                          setFile(null);
                          openAction("memorialVersion");
                        }}
                      >
                        Nueva versión
                      </Button>
                      <Button
                        size="sm"
                        disabled={item.status !== "ApprovedForSignature"}
                        onClick={() => {
                          setSelectedMemorial(item);
                          setFile(null);
                          setPresentationForm({
                            presentedAtUtc: localNow(),
                            result: "",
                            receiptFile: null,
                          });
                          openAction("presentation");
                        }}
                      >
                        Presentar
                      </Button>
                    </div>
                  </div>
                  {item.versions.map((version) => (
                    <div className="memorial-version" key={version.id}>
                      <div>
                        <strong>Versión {version.versionNumber}</strong>
                        <small>{version.notes}</small>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedMemorial(item);
                          setSelectedVersion(version);
                          setReviewForm({
                            outcome: "RequiresChanges",
                            observations: "",
                          });
                          setFile(null);
                          openAction("memorialReview");
                        }}
                      >
                        Revisar
                      </Button>
                      {version.reviews.map((review) => (
                        <div className="review-note" key={review.id}>
                          <Gavel size={17} />
                          <span>
                            <strong>
                              {review.outcome === "Approved"
                                ? "Aprobado"
                                : "Requiere cambios"}
                            </strong>
                            <p>{review.observations}</p>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">Sin memoriales registrados.</p>
          )}
        </Card>
      )}

      {tab === "people" && (
        <div className="case-people-grid">
          <Card>
            <SectionHeading
              title="Alumnos asignados"
              action={
                <Button size="sm" onClick={() => openAction("assign")}>
                  <UserPlus size={15} />
                  Asignar
                </Button>
              }
            />
            {legalCase.assignments.map((item) => (
              <Link
                className="assigned-person"
                to={`/personas/alumnos/${item.studentId}`}
                key={item.id}
              >
                <Avatar
                  name={item.studentName}
                  documentId={item.studentPhotoDocumentId}
                  size="lg"
                />
                <span>
                  <strong>{item.studentName}</strong>
                  <small>
                    {item.isPrimary ? "Responsable principal" : "Apoyo"}
                  </small>
                </span>
              </Link>
            ))}
          </Card>
          <Card>
            <SectionHeading
              title="Contrapartes"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openAction("counterparty")}
                >
                  <Plus size={15} />
                  Agregar
                </Button>
              }
            />
            {data.counterparties.map((person) => (
              <div className="counterparty" key={person.id}>
                <span className="counterparty__icon">
                  <UsersRound size={20} />
                </span>
                <span>
                  <strong>{person.fullName}</strong>
                  <small>
                    {person.phone ?? "Sin teléfono"} · {person.residenceAddress}
                  </small>
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <Modal
        open={action === "timeline"}
        onClose={() => !busy && setAction(null)}
        title="Registrar paso procesal"
        description="Tipo, fecha, etapa y evidencia."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !timelineForm.title.trim()}
              onClick={saveTimeline}
            >
              {busy ? "Guardando…" : "Guardar paso"}
            </Button>
          </>
        }
      >
        {formError && <div className="form-error">{formError}</div>}
        <div className="form-grid">
          <Field label="Tipo">
            <select
              value={timelineForm.type}
              onChange={(event) =>
                setTimelineForm({ ...timelineForm, type: event.target.value })
              }
            >
              <option value="GeneralAction">Acción general</option>
              <option value="CourtNotification">Notificación judicial</option>
              <option value="StatusChange">Cambio de estado</option>
              <option value="Presentation">Presentación</option>
            </select>
          </Field>
          <DatePickerField
            label="Fecha y hora"
            value={timelineForm.occurredAt}
            onChange={(occurredAt) =>
              setTimelineForm({ ...timelineForm, occurredAt })
            }
            withTime
            required
          />
          <Field label="Título">
            <input
              value={timelineForm.title}
              onChange={(event) =>
                setTimelineForm({ ...timelineForm, title: event.target.value })
              }
            />
          </Field>
          <Field label="Nueva etapa">
            <input
              value={timelineForm.newStage}
              onChange={(event) =>
                setTimelineForm({
                  ...timelineForm,
                  newStage: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Nuevo estado">
            <select
              value={timelineForm.newStatus}
              onChange={(event) =>
                setTimelineForm({
                  ...timelineForm,
                  newStatus: event.target.value,
                })
              }
            >
              <option value="">Sin cambio</option>
              <option value="DocumentCollection">Recolección</option>
              <option value="Active">Activo</option>
              <option value="Suspended">Suspendido</option>
            </select>
          </Field>
          <Field label="Descripción">
            <textarea
              value={timelineForm.description}
              onChange={(event) =>
                setTimelineForm({
                  ...timelineForm,
                  description: event.target.value,
                })
              }
            />
          </Field>
          <FilePicker
            label="Evidencia (opcional)"
            hint="PDF, JPG, PNG o WEBP"
            file={file}
            onChange={setFile}
          />
        </div>
      </Modal>

      <Modal
        open={action === "assign"}
        onClose={() => !busy && setAction(null)}
        title="Asignar alumno"
        description="Seleccione el alumno y su responsabilidad."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !assignment.studentId}
              onClick={saveAssignment}
            >
              Confirmar asignación
            </Button>
          </>
        }
      >
        {formError && <div className="form-error">{formError}</div>}
        <div className="form-grid">
          <Field label="Alumno">
            <select
              value={assignment.studentId}
              onChange={(event) =>
                setAssignment({ ...assignment, studentId: event.target.value })
              }
            >
              <option value="">Seleccione…</option>
              {students.data?.items.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName} · {student.studentCardNumber}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsabilidad">
            <select
              value={String(assignment.isPrimary)}
              onChange={(event) =>
                setAssignment({
                  ...assignment,
                  isPrimary: event.target.value === "true",
                })
              }
            >
              <option value="true">Responsable principal</option>
              <option value="false">Alumno de apoyo</option>
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={action === "requirement"}
        onClose={() => !busy && setAction(null)}
        title={requirement?.label ?? "Revisar requisito"}
        description="Estado, fecha, documento y notas."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button disabled={busy} onClick={saveRequirement}>
              Guardar revisión
            </Button>
          </>
        }
      >
        {formError && <div className="form-error">{formError}</div>}
        <div className="form-grid">
          <Field label="Estado">
            <select
              value={requirementForm.status}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  status: event.target.value,
                })
              }
            >
              <option value="Pending">Pendiente</option>
              <option value="Submitted">Presentado</option>
              <option value="Accepted">Aceptado</option>
              <option value="Observed">Observado</option>
              <option value="NotApplicable">No aplica</option>
            </select>
          </Field>
          <DatePickerField
            label="Fecha de emisión"
            value={requirementForm.issueDate}
            onChange={(issueDate) =>
              setRequirementForm({ ...requirementForm, issueDate })
            }
          />
          <Field label="Dato o condición">
            <input
              value={requirementForm.dataValue}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  dataValue: event.target.value,
                })
              }
            />
          </Field>
          <FilePicker
            label="Documento del requisito"
            hint="PDF, JPG, PNG o WEBP"
            file={file}
            onChange={setFile}
          />
          <Field label="Notas">
            <textarea
              value={requirementForm.notes}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  notes: event.target.value,
                })
              }
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={action === "counterparty"}
        onClose={() => !busy && setAction(null)}
        title="Agregar contraparte"
        description="Datos de localización asociados exclusivamente a este proceso."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button
              disabled={busy || !counterparty.fullName.trim()}
              onClick={saveCounterparty}
            >
              Agregar
            </Button>
          </>
        }
      >
        {formError && <div className="form-error">{formError}</div>}
        <div className="form-grid">
          <Field label="Nombre completo">
            <input
              value={counterparty.fullName}
              onChange={(event) =>
                setCounterparty({
                  ...counterparty,
                  fullName: event.target.value,
                })
              }
            />
          </Field>
          <Field label="DPI">
            <input
              value={counterparty.dpi}
              onChange={(event) =>
                setCounterparty({ ...counterparty, dpi: event.target.value })
              }
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={counterparty.phone}
              onChange={(event) =>
                setCounterparty({ ...counterparty, phone: event.target.value })
              }
            />
          </Field>
          <Field label="Residencia">
            <textarea
              value={counterparty.residenceAddress}
              onChange={(event) =>
                setCounterparty({
                  ...counterparty,
                  residenceAddress: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Notas">
            <textarea
              value={counterparty.notes}
              onChange={(event) =>
                setCounterparty({ ...counterparty, notes: event.target.value })
              }
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={action === "memorial"}
        onClose={() => !busy && setAction(null)}
        title="Registrar memorial"
        description="Título, responsable, archivo y notas."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button
              disabled={busy || !memorial.title.trim() || !file}
              onClick={saveMemorial}
            >
              Crear memorial
            </Button>
          </>
        }
      >
        {formError && <div className="form-error">{formError}</div>}
        <div className="form-grid">
          <Field label="Título">
            <input
              value={memorial.title}
              onChange={(event) =>
                setMemorial({ ...memorial, title: event.target.value })
              }
            />
          </Field>
          <Field label="Alumno que entrega">
            <select
              value={memorial.submittedByStudentId}
              onChange={(event) =>
                setMemorial({
                  ...memorial,
                  submittedByStudentId: event.target.value,
                })
              }
            >
              <option value="">No especificado</option>
              {legalCase.assignments.map((item) => (
                <option key={item.studentId} value={item.studentId}>
                  {item.studentName}
                </option>
              ))}
            </select>
          </Field>
          <FilePicker
            label="Archivo del memorial"
            hint="Documento PDF"
            file={file}
            onChange={setFile}
            accept="application/pdf"
            required
          />
          <Field label="Notas">
            <textarea
              value={memorial.notes}
              onChange={(event) =>
                setMemorial({ ...memorial, notes: event.target.value })
              }
            />
          </Field>
        </div>
      </Modal>
      <Modal
        open={action === "memorialVersion"}
        onClose={() => !busy && setAction(null)}
        title={`Nueva versión · ${selectedMemorial?.title ?? ""}`}
        description="Archivo y responsable de la nueva versión."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button disabled={busy || !file} onClick={saveMemorialVersion}>
              Agregar versión
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Alumno que entrega">
            <select
              value={memorial.submittedByStudentId}
              onChange={(event) =>
                setMemorial({
                  ...memorial,
                  submittedByStudentId: event.target.value,
                })
              }
            >
              <option value="">No especificado</option>
              {legalCase.assignments.map((item) => (
                <option key={item.studentId} value={item.studentId}>
                  {item.studentName}
                </option>
              ))}
            </select>
          </Field>
          <FilePicker
            label="Archivo PDF"
            hint="Nueva versión del memorial"
            file={file}
            onChange={setFile}
            accept="application/pdf"
            required
          />
          <Field label="Notas">
            <textarea
              value={memorial.notes}
              onChange={(event) =>
                setMemorial({ ...memorial, notes: event.target.value })
              }
            />
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        open={action === "memorialReview"}
        onClose={() => !busy && setAction(null)}
        title={`Revisar versión ${selectedVersion?.versionNumber ?? ""}`}
        description="Resultado, observaciones y revisor."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !reviewForm.observations.trim()}
              onClick={saveMemorialReview}
            >
              Guardar revisión
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Resultado">
            <select
              value={reviewForm.outcome}
              onChange={(event) =>
                setReviewForm({ ...reviewForm, outcome: event.target.value })
              }
            >
              <option value="RequiresChanges">Requiere cambios</option>
              <option value="Approved">Aprobado</option>
            </select>
          </Field>
          <Field label="Observaciones">
            <textarea
              value={reviewForm.observations}
              onChange={(event) =>
                setReviewForm({
                  ...reviewForm,
                  observations: event.target.value,
                })
              }
            />
          </Field>
          <FilePicker
            label="Documento revisado (opcional)"
            hint="Documento PDF con marcas o correcciones"
            file={file}
            onChange={setFile}
            accept="application/pdf"
          />
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        size="lg"
        open={action === "presentation"}
        onClose={() => !busy && setAction(null)}
        title={`Presentar memorial · ${selectedMemorial?.title ?? ""}`}
        description="Registra fecha, resultado, documento presentado y constancia."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !presentationForm.result.trim()}
              onClick={savePresentation}
            >
              Registrar presentación
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <DatePickerField
            label="Fecha y hora"
            value={presentationForm.presentedAtUtc}
            onChange={(presentedAtUtc) =>
              setPresentationForm({ ...presentationForm, presentedAtUtc })
            }
            withTime
            required
          />
          <Field label="Resultado">
            <textarea
              value={presentationForm.result}
              onChange={(event) =>
                setPresentationForm({
                  ...presentationForm,
                  result: event.target.value,
                })
              }
            />
          </Field>
          <FilePicker
            label="Documento presentado"
            hint="Memorial PDF presentado al juzgado"
            file={file}
            onChange={setFile}
            accept="application/pdf"
          />
          <FilePicker
            label="Constancia"
            hint="PDF o imagen de recepción"
            file={presentationForm.receiptFile}
            onChange={(receiptFile) =>
              setPresentationForm({ ...presentationForm, receiptFile })
            }
          />
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        size="lg"
        open={action === "notification"}
        onClose={() => !busy && setAction(null)}
        title="Registrar notificación judicial"
        description="Fecha, juzgado, descripción y documento."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !file || !notificationForm.description.trim()}
              onClick={saveNotification}
            >
              Guardar notificación
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <DatePickerField
            label="Fecha y hora"
            value={notificationForm.notifiedAtUtc}
            onChange={(notifiedAtUtc) =>
              setNotificationForm({ ...notificationForm, notifiedAtUtc })
            }
            withTime
            required
          />
          <Field label="Nueva etapa">
            <input
              value={notificationForm.newStage}
              onChange={(event) =>
                setNotificationForm({
                  ...notificationForm,
                  newStage: event.target.value,
                })
              }
            />
          </Field>
          <FilePicker
            label="Documento de notificación"
            hint="PDF, JPG, PNG o WEBP"
            file={file}
            onChange={setFile}
            required
          />
          <Field label="Descripción">
            <textarea
              value={notificationForm.description}
              onChange={(event) =>
                setNotificationForm({
                  ...notificationForm,
                  description: event.target.value,
                })
              }
            />
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        open={action === "close"}
        onClose={() => !busy && setAction(null)}
        title={
          legalCase.status === "Closed"
            ? "Reabrir expediente"
            : "Cerrar expediente"
        }
        description="El historial del expediente se conservará."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !closeForm.reason.trim()}
              onClick={saveClose}
            >
              {legalCase.status === "Closed" ? "Reabrir" : "Cerrar expediente"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {legalCase.status !== "Closed" && (
            <DatePickerField
              label="Fecha y hora"
              value={closeForm.closedAtUtc}
              onChange={(closedAtUtc) =>
                setCloseForm({ ...closeForm, closedAtUtc })
              }
              withTime
              required
            />
          )}
          <Field label="Motivo">
            <textarea
              value={closeForm.reason}
              onChange={(event) =>
                setCloseForm({ ...closeForm, reason: event.target.value })
              }
            />
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
    </div>
  );
}
