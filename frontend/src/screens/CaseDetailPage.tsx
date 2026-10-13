import {
  ArrowLeft,
  BellRing,
  Check,
  CircleDot,
  FileCheck2,
  FilePlus2,
  FilePenLine,
  FileText,
  FolderKanban,
  Gavel,
  History,
  Plus,
  Pencil,
  Send,
  UserPlus,
  UserMinus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "../routing/navigation";
import { DetailTabs, InfoItem, RelationLookup } from "../components/domain/Shared";
import { DocumentAcquisition } from "../components/documents/DocumentAcquisition";
import {
  Avatar,
  Badge,
  Button,
  Card,
  AppDatePicker,
  DocumentLink,
  ErrorState,
  Field,
  FilePicker,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeading,
  Select,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { feedbackHandled } from "../components/ui/feedback/operationFeedback";
import { useAuth } from "../context/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { useConfirm } from "../components/ui/Feedback";
import type {
  CaseRequirement,
  CaseAssignment,
  CaseStatus,
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
import {
  formatCui,
  formatGuatemalaPhone,
  isCompleteCui,
  isCompleteGuatemalaPhone,
} from "../utils/inputMasks";
import { canEvaluateRequirement, requirementEvidenceHint, requirementStatusOptions } from "../utils/requirementFlow";
import { assessCaseReadiness } from "../utils/caseReadiness";

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
  const confirm = useConfirm();
  const navigate = useNavigate();
  const hasPermission = (permission: string) => Boolean(
    user?.permissions.includes("*") || user?.permissions.includes(permission),
  );
  const canEditCase = hasPermission("cases.write");
  const canAssign = hasPermission("cases.assign");
  const canWriteTimeline = hasPermission("cases.timeline.write");
  const canDelete = Boolean(user?.permissions.includes("*") || user?.permissions.includes("records.delete"));
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const requestedStudentId = searchParams.get("assignStudentId") ?? "";
  const assignmentRequestHandled = useRef(false);
  const [tab, setTab] = useState("summary");
  const [action, setAction] = useState<
    | "timeline"
    | "assign"
    | "unassign"
    | "requirement"
    | "counterparty"
    | "memorial"
    | "memorialVersion"
    | "memorialReview"
    | "presentation"
    | "notification"
    | "close"
    | "edit"
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [timelineForm, setTimelineForm] = useState({
    type: "GeneralAction",
    occurredAt: localNow(),
    title: "",
    description: "",
  });
  const [assignment, setAssignment] = useState({
    studentId: "",
    isPrimary: true,
  });
  const [assignmentToEnd, setAssignmentToEnd] = useState<CaseAssignment | null>(null);
  const [unassignReason, setUnassignReason] = useState("");
  const [requirement, setRequirement] = useState<CaseRequirement | null>(null);
  const [requirementScanOpen, setRequirementScanOpen] = useState(false);
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
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string | null>(null);
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
  const [editForm, setEditForm] = useState<{ status: CaseStatus; stage: string }>({
    status: "DocumentCollection",
    stage: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.getCase(id),
    [id],
  );
  useEffect(() => {
    if (!data || !requestedStudentId || !canAssign || assignmentRequestHandled.current) return;
    assignmentRequestHandled.current = true;
    if (data.restriction?.isRestricted || data.restriction?.hasValidIdentity === false) return;
    if (data.summary.status === "Closed" || data.summary.status === "Archived") return;
    if (data.summary.assignments.some((item) => item.studentId === requestedStudentId && item.status === "Active")) return;
    setAssignment({ studentId: requestedStudentId, isPrimary: true });
    setFormError(null);
    setAction("assign");
  }, [data, requestedStudentId, canAssign]);

  const closeAssignment = () => {
    setAction(null);
    if (requestedStudentId) navigate(`/expedientes/${id}`, { replace: true });
  };
  const loadAssignmentCandidates = useCallback(async (term: string) => (await dataSource.listStudentAssignmentCandidates(id, term)).items.map((student) => ({ value: student.id, label: `${student.fullName} · ${student.studentCardNumber}` })), [id]);

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
        newStage: null,
        newStatus: null,
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
  const saveCase = async () => {
    if (!data) return;
    if (!editForm.stage.trim()) { setFormError("La etapa procesal es obligatoria."); return; }
    setBusy(true);
    setFormError(null);
    try {
      await dataSource.updateCase(id, { ...editForm, stage: editForm.stage.trim(), concurrencyToken: data.summary.concurrencyToken });
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "No se pudo actualizar el expediente.");
    } finally { setBusy(false); }
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
      closeAssignment();
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
  const endAssignment = async () => {
    if (!assignmentToEnd || !unassignReason.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      await dataSource.endAssignment(id, assignmentToEnd.id, unassignReason.trim());
      setAction(null);
      setAssignmentToEnd(null);
      setUnassignReason("");
      await reload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "No se pudo desasignar al alumno.");
    } finally { setBusy(false); }
  };
  const saveRequirement = async () => {
    if (!requirement) return;
    setBusy(true);
    setFormError(null);
    try {
      await dataSource.updateCaseRequirement(id, requirement.id, {
        status: requirementForm.status,
        documentId: requirement.documentId,
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
    if (counterparty.dpi && !isCompleteCui(counterparty.dpi)) {
      setFormError("El DPI de la contraparte debe contener los 13 dígitos del CUI.");
      return;
    }
    if (!isCompleteGuatemalaPhone(counterparty.phone)) {
      setFormError("El teléfono debe contener 8 dígitos o el prefijo +502 seguido de 8 dígitos.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const input = {
        ...counterparty,
        dpi: counterparty.dpi || null,
        phone: counterparty.phone || null,
        residenceAddress: counterparty.residenceAddress || null,
        workAddress: counterparty.workAddress || null,
        notes: counterparty.notes || null,
      };
      if (selectedCounterpartyId)
        await dataSource.updateCounterparty(id, selectedCounterpartyId, input);
      else
        await dataSource.addCounterparty(id, input);
      setAction(null);
      await reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar la contraparte.",
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
  const isCaseOpen = legalCase.status !== "Closed" && legalCase.status !== "Archived";
  const attentionBlocked = Boolean(data.restriction?.isRestricted || data.restriction?.hasValidIdentity === false);
  const canModifyOpenCase = canEditCase && isCaseOpen && !attentionBlocked;
  const canAssignOpenCase = canAssign && isCaseOpen && !attentionBlocked;
  const canWriteOpenTimeline = canWriteTimeline && isCaseOpen && !attentionBlocked;
  const accepted = data.requirements.filter(
    (item) => item.status === "Accepted" || item.status === "NotApplicable",
  ).length;
  const readiness = assessCaseReadiness(data);
  const deleteCase = async () => {
    const approved = await confirm({ title: "Eliminar expediente", message: `${legalCase.caseNumber} dejará de aparecer para secretaría y alumnos. El historial y los documentos se conservarán.`, confirmLabel: "Enviar a Eliminados", tone: "danger" });
    if (!approved) return;
    setBusy(true);
    try {
      await dataSource.deleteCase(id, "Eliminado desde el expediente");
      navigate("/expedientes", { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <div>
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
            {canDelete ? <Button variant="danger" disabled={busy} onClick={deleteCase}><Trash2 size={17} />Eliminar</Button> : null}
            {canModifyOpenCase ? <Button variant="secondary" onClick={() => { setEditForm({ status: legalCase.status, stage: legalCase.stage }); openAction("edit"); }}><Pencil size={17} />Estado y etapa</Button> : null}
            {canAssignOpenCase ? <Button variant="secondary" onClick={() => openAction("assign")}>
              <UserPlus size={17} />
              Asignar alumno
            </Button> : null}
            {canWriteOpenTimeline ? <Button
              variant="secondary"
              onClick={() => openAction("notification")}
            >
              <BellRing size={17} />
              Notificación
            </Button> : null}
            {canWriteOpenTimeline ? <Button onClick={() => openAction("timeline")}>
              <Plus size={17} />
              Registrar paso
            </Button> : null}
          </>
        }
      />
      <div className="case-overview-strip">
        {attentionBlocked && <p role="alert" className="confirmation-warning">{data.restriction?.isRestricted ? `Veto global permanente. Referencia: ${data.restriction.reference}.` : 'El DPI histórico necesita corrección en la ficha del usuario.'} No se puede continuar la atención ni asignar alumnos. Puede consultar el historial o cerrar el caso. <Link to={`/personas/clientes/${legalCase.clientId}`}>Ver ficha del usuario</Link></p>}
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
        {canEditCase && legalCase.status !== "Archived" && !(attentionBlocked && legalCase.status === 'Closed') ? <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCloseForm({ closedAtUtc: localNow(), reason: "" });
            openAction("close");
          }}
        >
          {legalCase.status === "Closed" ? "Reabrir" : "Cerrar caso"}
        </Button> : null}
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
          <Card className={`case-readiness case-readiness--${readiness.state}`}>
            <SectionHeading
              title="Preparación del expediente"
              description="Pendientes operativos calculados con los datos actuales del caso"
            />
            {readiness.state === "inactive" ? (
              <p className="case-readiness__empty">El expediente no está en operación. Consulte su historial o reábralo con autorización.</p>
            ) : readiness.state === "ready" ? (
              <p className="case-readiness__empty">No hay pendientes detectados de papelería, asignación ni seguimiento. La revisión jurídica sigue a cargo del personal responsable.</p>
            ) : (
              <div className="case-readiness__issues">
                {readiness.issues.map((issue) => (
                  <div className="case-readiness__issue" key={issue.id}>
                    <CircleDot size={18} aria-hidden="true" />
                    <span><strong>{issue.title}</strong><small>{issue.detail}</small></span>
                    {issue.target === "requirements" ? <Button variant="secondary" size="sm" onClick={() => setTab("requirements")}>Ver requisitos</Button> : null}
                    {issue.target === "assign" && canAssignOpenCase ? <Button variant="secondary" size="sm" onClick={() => openAction("assign")}>Asignar alumno</Button> : null}
                    {issue.target === "timeline" ? <Button variant="secondary" size="sm" onClick={() => setTab("timeline")}>Ver cronología</Button> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
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
                <div
                  className="assigned-person"
                  key={item.id}
                >
                  <Avatar
                    name={item.studentName}
                    documentId={item.studentPhotoDocumentId}
                    size="lg"
                  />
                  <span>
                    <Link to={`/personas/alumnos/${item.studentId}`}><strong>{item.studentName}</strong></Link>
                    <small>
                      {item.isPrimary
                        ? "Responsable principal"
                        : "Alumno de apoyo"}{item.status !== "Active" && item.endReason ? ` · ${item.endReason}` : ""}
                    </small>
                  </span>
                  <div className="inline-actions">
                    <Badge tone={item.status === "Active" ? "success" : "neutral"}>{translate(item.status)}</Badge>
                    {canAssign && item.status === "Active" ? (
                      <Button variant="ghost" size="sm" onClick={() => { setAssignmentToEnd(item); setUnassignReason(""); openAction("unassign"); }}>
                        <UserMinus size={15} /> Desasignar
                      </Button>
                    ) : null}
                  </div>
                </div>
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
                label="Usuario"
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
                {item.kind === "Document" && item.documentId ? (
                  <DocumentLink documentId={item.documentId} label="Abrir" />
                ) : null}
                {canModifyOpenCase && item.kind === "Document" ? <Button variant="ghost" size="sm" onClick={() => { setRequirement(item); setRequirementScanOpen(true); }}><FilePlus2 size={15} /> {item.documentId ? "Reemplazar" : "Adjuntar"}</Button> : null}
                {canModifyOpenCase && canEvaluateRequirement(item) ? <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRequirement(item);
                    setRequirementForm({
                      status: requirementStatusOptions(item).includes(item.status) ? item.status : "Pending",
                      issueDate: item.documentIssueDate ?? "",
                      notes: item.notes ?? "",
                      conditionMet: item.conditionMet ?? true,
                      dataValue: item.dataValue ?? "",
                    });
                    openAction("requirement");
                  }}
                >
                  {item.kind === "Document" ? (item.documentId ? "Revisar" : "Evaluar aplicación") : item.kind === "Data" ? (item.dataValue ? "Actualizar" : "Completar") : "Evaluar condición"}
                </Button> : null}
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
            action={canWriteOpenTimeline ? (
              <Button size="sm" onClick={() => openAction("timeline")}>
                <Plus size={15} />
                Registrar paso
              </Button>
            ) : undefined}
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
                    <small>Actividad registrada</small>
                    {entry.documentId ? (
                      <DocumentLink documentId={entry.documentId} label="Ver evidencia" />
                    ) : null}
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
            action={canWriteOpenTimeline ? (
              <Button size="sm" onClick={() => openAction("memorial")}>
                <Plus size={15} />
                Nuevo memorial
              </Button>
            ) : undefined}
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
                    {canWriteOpenTimeline ? <div className="inline-actions">
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
                    </div> : null}
                  </div>
                  {item.versions.map((version, versionIndex) => (
                    <div className="memorial-version" key={version.id}>
                      <div>
                        <strong>Versión {version.versionNumber}</strong>
                        <small>{version.notes}</small>
                        <DocumentLink documentId={version.documentId} label="Ver versión" />
                      </div>
                      {canWriteOpenTimeline ? <Button
                        variant="secondary"
                        size="sm"
                        disabled={versionIndex !== item.versions.length - 1}
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
                      </Button> : null}
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
                            {review.reviewedDocumentId ? (
                              <DocumentLink documentId={review.reviewedDocumentId} label="Ver revisión" />
                            ) : null}
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
          <SectionHeading
            title="Presentaciones y constancias"
            description="Documentos entregados y acuses recuperables"
          />
          {data.presentations.length ? (
            <div className="memorial-list">
              {data.presentations.map((presentation) => (
                <div className="review-note" key={presentation.id}>
                  <Send size={18} />
                  <span>
                    <strong>{presentation.memorialTitle}</strong>
                    <p>{presentation.result} · {formatDateTime(presentation.presentedAtUtc)}</p>
                    <span className="inline-actions">
                      {presentation.presentedDocumentId ? (
                        <DocumentLink documentId={presentation.presentedDocumentId} label="Ver presentado" />
                      ) : null}
                      {presentation.receiptDocumentId ? (
                        <DocumentLink documentId={presentation.receiptDocumentId} label="Ver constancia" />
                      ) : null}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">Sin presentaciones registradas.</p>
          )}
          <SectionHeading
            title="Notificaciones judiciales"
            description="Registro formal y documento recibido"
          />
          {data.courtNotifications.length ? (
            <div className="memorial-list">
              {data.courtNotifications.map((notification) => (
                <div className="review-note" key={notification.id}>
                  <BellRing size={18} />
                  <span>
                    <strong>{formatDateTime(notification.notifiedAtUtc)}</strong>
                    <p>{notification.description}</p>
                    <DocumentLink documentId={notification.documentId} label="Ver notificación" />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">Sin notificaciones registradas.</p>
          )}
        </Card>
      )}

      {tab === "people" && (
        <div className="case-people-grid">
          <Card>
            <SectionHeading
              title="Alumnos asignados"
              action={canAssignOpenCase ? (
                <Button size="sm" onClick={() => openAction("assign")}>
                  <UserPlus size={15} />
                  Asignar
                </Button>
              ) : undefined}
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
              action={canModifyOpenCase ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedCounterpartyId(null);
                    setCounterparty({ fullName: "", dpi: "", phone: "", residenceAddress: "", workAddress: "", notes: "" });
                    openAction("counterparty");
                  }}
                >
                  <Plus size={15} />
                  Agregar
                </Button>
              ) : undefined}
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
                {canModifyOpenCase ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCounterpartyId(person.id);
                      setCounterparty({
                        fullName: person.fullName,
                        dpi: formatCui(person.dpi ?? ""),
                        phone: formatGuatemalaPhone(person.phone ?? ""),
                        residenceAddress: person.residenceAddress ?? "",
                        workAddress: person.workAddress ?? "",
                        notes: person.notes ?? "",
                      });
                      openAction("counterparty");
                    }}
                  >
                    <Pencil size={15} /> Editar
                  </Button>
                ) : null}
              </div>
            ))}
          </Card>
        </div>
      )}

      <Modal
        size="lg"
        open={action === "edit"}
        onClose={() => !busy && setAction(null)}
        title="Gestión procesal del expediente"
        description="Actualice únicamente los datos propios de la gestión procesal."
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button>
            <Button disabled={busy || !editForm.stage.trim()} onClick={saveCase}>{busy ? "Guardando…" : "Guardar cambios"}</Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-section-heading field--wide"><strong>Identificación del expediente</strong><span>Información generada al abrir el proceso; se conserva para mantener su trazabilidad.</span></div>
          <Field label="Número de expediente"><input value={legalCase.caseNumber} readOnly /></Field>
          <Field label="Usuario"><input value={legalCase.clientName} readOnly /></Field>
          <Field label="Tipo de proceso"><input value={legalCase.processTypeName} readOnly /></Field>
          <Field label="Fecha de apertura"><input value={formatDate(legalCase.openedAtUtc)} readOnly /></Field>
          <div className="form-section-heading field--wide"><strong>Gestión procesal</strong><span>Estado actual y etapa visible en el seguimiento del expediente.</span></div>
          <Field label="Estado operativo">
            <Select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as CaseStatus }))}>
              <option value="DocumentCollection">Recolección documental</option>
              <option value="Active">Activo</option>
              <option value="Suspended">Suspendido</option>
            </Select>
          </Field>
          <Field label="Etapa procesal"><input value={editForm.stage} onChange={(event) => setEditForm((current) => ({ ...current, stage: event.target.value }))} maxLength={160} /></Field>
          <div className="form-section-heading field--wide"><strong>Relaciones del expediente</strong><span>La papelería, las personas, el equipo y la bitácora se administran en sus secciones para conservar su propio historial.</span></div>
          <Field label="Requisitos documentales"><input value={`${data.requirements.length} registrados`} readOnly /></Field>
          <Field label="Contrapartes"><input value={`${data.counterparties.length} registradas`} readOnly /></Field>
          <Field label="Asignaciones activas"><input value={`${legalCase.assignments.filter((item) => item.status === "Active").length}`} readOnly /></Field>
          <Field label="Movimientos de bitácora"><input value={`${data.timeline.length}`} readOnly /></Field>
        </div>
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
      </Modal>

      <Modal
        open={action === "timeline"}
        onClose={() => !busy && setAction(null)}
        title="Registrar paso procesal"
        description="Fecha, descripción y evidencia de la actuación."
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
          <Field label="Tipo"><input value="Actuación general" readOnly /></Field>
          <AppDatePicker
            label="Fecha y hora"
            preset="processDate"
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

      <DocumentAcquisition
        open={requirementScanOpen && !!requirement}
        onClose={() => setRequirementScanOpen(false)}
        contexts={requirement ? { CaseRequirement: [{ id: requirement.id, label: requirement.label }] } : undefined}
        initialForm={{
          contextType: "CaseRequirement",
          contextId: requirement?.id ?? "",
          label: requirement?.label ?? "Documento del requisito",
          replaceDocumentId: requirement?.documentId ?? "",
        }}
        contextLocked
        onCompleted={async (document) => {
          if (!requirement) return;
          await dataSource.updateCaseRequirement(id, requirement.id, feedbackHandled({
            status: requirement.status === "Pending" ? "Submitted" : requirement.status,
            documentId: document.id,
            dataValue: requirement.dataValue,
            conditionMet: requirement.conditionMet,
            documentIssueDate: requirement.documentIssueDate,
            notes: requirement.notes,
          }));
          setRequirementScanOpen(false);
          await reload();
        }}
      />

      <Modal
        open={action === "assign"}
        onClose={() => !busy && closeAssignment()}
        title="Asignar alumno"
        description="Seleccione el alumno y su responsabilidad."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={closeAssignment}
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
          <RelationLookup label="Alumno" required value={assignment.studentId} onChange={(studentId) => setAssignment({ ...assignment, studentId })} load={loadAssignmentCandidates} emptyLabel="Seleccione un alumno con inscripción aprobada" />
          <Field label="Responsabilidad">
            <Select
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
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={action === "unassign"}
        onClose={() => !busy && setAction(null)}
        title="Desasignar alumno"
        description={assignmentToEnd ? `${assignmentToEnd.studentName} dejará de participar activamente en este expediente. El histórico se conservará.` : ""}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button><Button disabled={busy || !unassignReason.trim()} onClick={endAssignment}>{busy ? "Guardando…" : "Confirmar desasignación"}</Button></>}
      >
        <Field label="Motivo de desasignación"><textarea value={unassignReason} onChange={(event) => setUnassignReason(event.target.value)} maxLength={500} /></Field>
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
      </Modal>

      <Modal
        open={action === "requirement"}
        onClose={() => !busy && setAction(null)}
        title={requirement?.label ?? "Requisito"}
        description={requirement?.documentId ? "Registre el resultado de la revisión del archivo adjunto." : requirement?.kind === "Data" ? "Complete y valide el dato requerido." : "Indique si este requisito condicional aplica al expediente."}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button disabled={busy || (requirement ? !requirementStatusOptions({ ...requirement, dataValue: requirementForm.dataValue, conditionMet: requirementForm.conditionMet }).some((status) => status === requirementForm.status) : true)} onClick={saveRequirement}>
              {requirement?.documentId ? "Guardar revisión" : "Guardar evaluación"}
            </Button>
          </>
        }
      >
        {formError && <div className="form-error">{formError}</div>}
        <div className="form-grid">
          <Field label="Estado">
            <Select
              value={requirementForm.status}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  status: event.target.value,
                })
              }
            >
              {requirement && requirementStatusOptions({ ...requirement, dataValue: requirementForm.dataValue, conditionMet: requirementForm.conditionMet }).map((status) => (
                <option key={status} value={status}>{translate(status)}</option>
              ))}
            </Select>
          </Field>
          {requirement?.kind === "Document" && requirement.documentId ? <AppDatePicker
            label="Fecha de emisión"
            preset="processDate"
            value={requirementForm.issueDate}
            onChange={(issueDate) =>
              setRequirementForm({ ...requirementForm, issueDate })
            }
          /> : null}
          {requirement?.kind === "Data" ? <Field label="Dato requerido">
            <input
              value={requirementForm.dataValue}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  dataValue: event.target.value,
                })
              }
            />
          </Field> : null}
          {requirement?.kind === "Condition" ? <Field label="Condición">
            <Select
              value={String(requirementForm.conditionMet)}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  conditionMet: event.target.value === "true",
                })
              }
            >
              <option value="true">Se cumple</option>
              <option value="false">No se cumple</option>
            </Select>
          </Field> : null}
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
        {requirement && requirementEvidenceHint({ ...requirement, dataValue: requirementForm.dataValue, conditionMet: requirementForm.conditionMet }) ? <p className="muted-copy">{requirementEvidenceHint({ ...requirement, dataValue: requirementForm.dataValue, conditionMet: requirementForm.conditionMet })}</p> : null}
      </Modal>

      <Modal
        open={action === "counterparty"}
        onClose={() => !busy && setAction(null)}
        title={selectedCounterpartyId ? "Editar contraparte" : "Agregar contraparte"}
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
              {selectedCounterpartyId ? "Guardar cambios" : "Agregar"}
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
              inputMode="numeric"
              maxLength={15}
              placeholder="0000 00000 0000"
              onChange={(event) =>
                setCounterparty({ ...counterparty, dpi: formatCui(event.target.value) })
              }
            />
          </Field>
          <Field label="Teléfono">
            <input
              type="tel"
              inputMode="tel"
              placeholder="0000 0000"
              value={counterparty.phone}
              onChange={(event) =>
                setCounterparty({ ...counterparty, phone: formatGuatemalaPhone(event.target.value) })
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
            <Select
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
            </Select>
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
            <Select
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
            </Select>
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
            <Select
              value={reviewForm.outcome}
              onChange={(event) =>
                setReviewForm({ ...reviewForm, outcome: event.target.value })
              }
            >
              <option value="RequiresChanges">Requiere cambios</option>
              <option value="Approved">Aprobado</option>
            </Select>
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
          <AppDatePicker
            label="Fecha y hora"
            preset="processDate"
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
          <AppDatePicker
            label="Fecha y hora"
            preset="processDate"
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
            <AppDatePicker
              label="Fecha y hora"
              preset="processDate"
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
