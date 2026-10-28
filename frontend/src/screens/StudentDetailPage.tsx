import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRoundPlus,
  UserMinus,
  FilePlus2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "../routing/navigation";
import { DetailTabs, InfoItem } from "../components/domain/Shared";
import { WhatsAppLink } from "../components/domain/WhatsAppLink";
import { StudentLegalStudyPanel } from "../components/domain/StudentLegalStudyPanel";
import { StudentDisciplinePanel } from "../components/domain/StudentDisciplinePanel";
import { StudentDisciplineAlert } from "../components/domain/StudentDisciplineAlert";
import { DocumentAcquisition } from "../components/documents/DocumentAcquisition";
import {
  Avatar,
  Badge,
  Button,
  Card,
  AppDatePicker,
  DateRangePickerField,
  TimePickerField,
  ReadOnlyValue,
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
import { useConfirm, useNotify } from "../components/ui/Feedback";
import type { StudentProfile, StudentRequirement } from "../types/domain";
import { formatDate, statusTone, translate } from "../utils/format";
import { toLocalDateOnly } from "../utils/date";
import { isValidPassword } from "../utils/passwordPolicy";
import { canAssignStudent, enrollmentStatusDescription, hasInconsistentActiveAssignment } from "../utils/enrollmentFlow";
import { canEvaluateRequirement, requirementEvidenceHint, requirementStatusOptions } from "../utils/requirementFlow";
import {
  formatCui,
  formatGuatemalaPhone,
  isCompleteCui,
  isCompleteGuatemalaPhone,
} from "../utils/inputMasks";

const emptyEdit = {
  fullName: "",
  birthDate: "",
  studentCardNumber: "",
  dpi: "",
  semester: "",
  studyShift: "",
  workplace: "",
  workPhone: "",
  immediateSupervisor: "",
  jobTitle: "",
  residenceAddress: "",
  mobilePhone: "",
  homePhone: "",
  email: "",
  registrationDate: "",
  modality: 'CivilFamilyCases', siteName: '', siteAddress: '', practiceShift: '', practiceDays: '', startTime: '', endTime: '', startDate: '', endDate: '',
};

const enrollmentStatusLabels: Record<string, string> = {
  Draft: "Borrador",
  Submitted: "Presentada",
  Admitted: "Admitida",
  UnderReview: "En revisión",
  Observed: "Observada",
  Approved: "Aprobada",
  Rejected: "Rechazada",
  Completed: "Completada",
};

const enrollmentTransitions: Record<string, string[]> = {
  Draft: ["Submitted"],
  Submitted: ["Admitted", "UnderReview", "Observed", "Approved", "Rejected"],
  Admitted: ["UnderReview", "Observed", "Approved", "Rejected"],
  UnderReview: ["Observed", "Approved", "Rejected"],
  Observed: ["UnderReview"],
  Approved: ["Completed"],
  Rejected: [],
  Completed: [],
};

export function StudentDetailPage() {
  const { user } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();
  const canWrite = Boolean(
    user?.permissions.includes("*") ||
      user?.permissions.includes("students.write"),
  );
  const canDelete = Boolean(user?.permissions.includes("*") || user?.permissions.includes("records.delete"));
  const canAssign = Boolean(user?.permissions.includes("*") || user?.permissions.includes("cases.assign"));
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("enrollment");
  const [disciplineRevision, setDisciplineRevision] = useState(0);
  const [action, setAction] = useState<
    "edit" | "access" | "requirement" | "status" | "card" | "unassign" | null
  >(null);
  const [selectedRequirement, setSelectedRequirement] =
    useState<StudentRequirement | null>(null);
  const [scanRequirement, setScanRequirement] = useState<StudentRequirement | null>(null);
  const [studentPhoto, setStudentPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [caseToEnd, setCaseToEnd] = useState<StudentProfile["cases"][number] | null>(null);
  const [unassignReason, setUnassignReason] = useState("");
  const [editForm, setEditForm] = useState(emptyEdit);
  const [requirementForm, setRequirementForm] = useState({
    status: "Submitted",
    dataValue: "",
    documentIssueDate: "",
    notes: "",
  });
  const [statusForm, setStatusForm] = useState({
    status: "Submitted",
    resolutionNotes: "",
  });
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    issuedDate: toLocalDateOnly(),
    expirationDate: "",
    markDelivered: true,
  });
  const [accessForm, setAccessForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.getStudent(id),
    [id],
  );
  const legalStudyStatus = useAsyncData(() => dataSource.getStudentLegalStudy(id), [id]);

  const deleteStudent = async (name: string) => {
    const accepted = await confirm({ title: "Eliminar alumno", message: `${name} perderá el acceso y dejará de aparecer en alumnos y asignaciones.`, confirmLabel: "Enviar a Eliminados", tone: "danger" });
    if (!accepted) return;
    setBusy(true);
    try {
      await dataSource.deleteStudent(id, "Eliminado desde el perfil del alumno");
      navigate("/personas/alumnos", { replace: true });
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingState label="Abriendo perfil del alumno" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Alumno no encontrado")}
        retry={reload}
      />
    );
  const student = data.student;
  const practiceClosed = Boolean(legalStudyStatus.data?.closure);
  const enrollment = data.enrollments[0];
  const accepted =
    enrollment?.requirements.filter((item) => item.status === "Accepted")
      .length ?? 0;
  const availableStatuses = enrollment
    ? [enrollment.status, ...(enrollmentTransitions[enrollment.status] ?? [])]
    : [];
  const pendingMandatoryRequirements = enrollment?.requirements.filter(
    (item) => item.isRequired !== false && item.status !== "Accepted",
  ) ?? [];

  const startEdit = () => {
    setEditForm({
      fullName: student.fullName,
      birthDate: student.birthDate ?? "",
      studentCardNumber: student.studentCardNumber,
      dpi: formatCui(student.dpi),
      semester: student.semester?.toString() ?? "",
      studyShift: student.studyShift ?? "",
      workplace: student.workplace ?? "",
      workPhone: formatGuatemalaPhone(student.workPhone ?? ""),
      immediateSupervisor: student.immediateSupervisor ?? "",
      jobTitle: student.jobTitle ?? "",
      residenceAddress: student.residenceAddress,
      mobilePhone: formatGuatemalaPhone(student.mobilePhone ?? ""),
      homePhone: formatGuatemalaPhone(student.homePhone ?? ""),
      email: student.email,
      registrationDate: student.registrationDate,
      modality: enrollment?.modality ?? 'CivilFamilyCases',
      siteName: enrollment?.siteName ?? '', siteAddress: enrollment?.siteAddress ?? '',
      practiceShift: enrollment?.shift ?? '', practiceDays: enrollment?.practiceDays ?? '',
      startTime: enrollment?.startTime?.slice(0, 5) ?? '', endTime: enrollment?.endTime?.slice(0, 5) ?? '',
      startDate: enrollment?.startDate ?? '', endDate: enrollment?.endDate ?? '',
    });
    setStudentPhoto(null);
    setFormError("");
    setAction("edit");
  };
  const startAccess = () => {
    setAccessForm({ password: "", confirmPassword: "" });
    setStudentPhoto(null);
    setFormError("");
    setAction("access");
  };
  const saveAccess = async () => {
    if (!isValidPassword(accessForm.password)) {
      setFormError("La contraseña temporal debe tener entre 8 y 128 caracteres.");
      return;
    }
    if (accessForm.password !== accessForm.confirmPassword) {
      setFormError("La confirmación de la contraseña no coincide.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const access = await dataSource.provisionStudentAccess(student.id, {
        password: accessForm.password,
        participationStartDate:
          enrollment?.startDate ?? student.registrationDate,
        participationEndDate: enrollment?.endDate ?? null,
      });
      if (studentPhoto)
        await dataSource.setUserPhoto(access.userAccountId, studentPhoto);
      setAction(null);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo activar el acceso.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveStudent = async () => {
    if (!isCompleteCui(editForm.dpi)) {
      setFormError("El DPI debe contener los 13 dígitos del CUI.");
      return;
    }
    if ([editForm.mobilePhone, editForm.homePhone, editForm.workPhone].some((value) => !isCompleteGuatemalaPhone(value))) {
      setFormError("Los teléfonos deben contener 8 dígitos o el prefijo +502 seguido de 8 dígitos.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await dataSource.updateStudent(id, {
        fullName: editForm.fullName,
        birthDate: editForm.birthDate || null,
        ageAtRegistration: null,
        studentCardNumber: editForm.studentCardNumber,
        dpi: editForm.dpi,
        semester: null,
        studyShift: editForm.studyShift || null,
        workplace: editForm.workplace || null,
        workPhone: editForm.workPhone || null,
        immediateSupervisor: editForm.immediateSupervisor || null,
        jobTitle: editForm.jobTitle || null,
        residenceAddress: editForm.residenceAddress,
        mobilePhone: editForm.mobilePhone || null,
        homePhone: editForm.homePhone || null,
        email: editForm.email,
        registrationDate: editForm.registrationDate,
        concurrencyToken: student.concurrencyToken,
        practice: enrollment ? {
          enrollmentId: enrollment.id, concurrencyToken: enrollment.concurrencyToken,
          modality: editForm.modality, siteName: editForm.siteName || null, siteAddress: editForm.siteAddress || null,
          shift: editForm.practiceShift || null, practiceDays: editForm.practiceDays || null,
          startTime: editForm.startTime || null, endTime: editForm.endTime || null,
          startDate: editForm.startDate || null, endDate: editForm.endDate || null,
        } : null,
      });
      if (studentPhoto) {
        if (!student.userAccountId)
          throw new Error(
            "Primero vincule una cuenta de usuario al alumno para guardar su fotografía.",
          );
        try { await dataSource.setUserPhoto(student.userAccountId, studentPhoto); }
        catch (reason) { notify.warning({ title: 'Perfil guardado; fotografía pendiente', message: `Los datos se guardaron. Vuelva a adjuntar la fotografía: ${reason instanceof Error ? reason.message : 'revise la conexión'}`, duration: 12000 }); }
      }
      setAction(null);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo actualizar el alumno.",
      );
    } finally {
      setBusy(false);
    }
  };
  const toggleStudentActive = async () => {
    setBusy(true);
    setFormError("");
    try {
      await dataSource.setStudentActive(id, !student.isActive);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo cambiar el estado activo del alumno.",
      );
    } finally {
      setBusy(false);
    }
  };
  const endAssignment = async () => {
    if (!caseToEnd || !unassignReason.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      await dataSource.endAssignment(caseToEnd.caseId, caseToEnd.assignmentId, unassignReason.trim());
      setAction(null);
      setCaseToEnd(null);
      setUnassignReason("");
      await reload();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudo desasignar el caso.");
    } finally { setBusy(false); }
  };
  const openRequirement = (item: StudentRequirement) => {
    if (!canEvaluateRequirement(item)) return;
    setSelectedRequirement(item);
    setRequirementForm({
      status: requirementStatusOptions(item).includes(item.status) ? item.status : "Pending",
      dataValue: item.dataValue ?? "",
      documentIssueDate: item.documentIssueDate ?? "",
      notes: item.notes ?? "",
    });
    setFormError("");
    setAction("requirement");
  };
  const saveRequirement = async () => {
    if (!enrollment || !selectedRequirement) return;
    setBusy(true);
    setFormError("");
    try {
      await dataSource.updateStudentRequirement(
        enrollment.id,
        selectedRequirement.id,
        {
          status: requirementForm.status,
          documentId: selectedRequirement.documentId,
          dataValue: requirementForm.dataValue || null,
          documentIssueDate: requirementForm.documentIssueDate || null,
          notes: requirementForm.notes || null,
        },
      );
      setAction(null);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo actualizar el requisito.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveStatus = async () => {
    if (!enrollment) return;
    setBusy(true);
    setFormError("");
    try {
      await dataSource.changeEnrollmentStatus(enrollment.id, {
        status: statusForm.status,
        resolutionNotes: statusForm.resolutionNotes || null,
        resolutionDocumentId: null,
      });
      setAction(null);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveCard = async () => {
    if (!enrollment) return;
    setBusy(true);
    setFormError("");
    try {
      await dataSource.issueClinicCard(enrollment.id, {
        cardNumber: cardForm.cardNumber,
        issuedDate: cardForm.issuedDate,
        expirationDate: cardForm.expirationDate || null,
        markDelivered: cardForm.markDelivered,
      });
      setAction(null);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo registrar el carné.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={canWrite ? "" : "read-only-view"}>
      <Link className="back-link" to="/personas/alumnos">
        <ArrowLeft size={16} />
        Volver a alumnos
      </Link>
      <PageHeader
        eyebrow={`Carné ${student.studentCardNumber}`}
        title={student.fullName}
        description={`Jornada ${student.studyShift?.toLowerCase() ?? "sin registrar"}`}
        actions={
          canWrite ? (
            <>
              {student.isActive && !practiceClosed && !student.userAccountId ? (
                <Button onClick={startAccess}>
                  <UserRoundPlus size={17} />
                  Activar acceso
                </Button>
              ) : null}
              <Button variant="secondary" onClick={startEdit}>
                <Pencil size={17} />
                Editar perfil
              </Button>
              {(student.isActive || (legalStudyStatus.data && !practiceClosed)) && <Button
                variant={student.isActive ? "danger" : "secondary"}
                disabled={busy}
                onClick={toggleStudentActive}
              >
                {student.isActive ? "Dar de baja" : "Reactivar"}
              </Button>}
              {canDelete ? <Button variant="danger" disabled={busy} onClick={() => deleteStudent(student.fullName)}><Trash2 size={17} />Eliminar</Button> : null}
              {canAssign && canAssignStudent(data) ? <Button onClick={() => navigate(`/expedientes?assignStudentId=${encodeURIComponent(student.id)}`)}>
                <FolderKanban size={17} />
                Asignar caso
              </Button> : null}
            </>
          ) : undefined
        }
      />
      <div className="profile-layout">
        <Card className="profile-summary">
          <Avatar
            name={student.fullName}
            documentId={student.photoDocumentId}
            size="lg"
          />
          <h2>{student.fullName}</h2>
          <p>{student.email}</p>
          <Badge tone={student.isActive ? "success" : "neutral"}>
            {practiceClosed ? "Práctica cerrada" : student.isActive ? "Perfil activo" : "Inactivo"}
          </Badge>
          <StudentDisciplineAlert studentId={student.id} revision={disciplineRevision} onOpen={() => setTab('discipline')} />
          <div className="profile-contact">
            <span>
              <Mail size={15} />
              {student.email}
            </span>
            <span>
              <Phone size={15} />
              {student.mobilePhone}
            </span>
            <WhatsAppLink phone={student.mobilePhone} />
            <span>
              <MapPin size={15} />
              {student.residenceAddress}
            </span>
          </div>
          <div className="profile-summary__meta">
            <div>
              <strong>{data.cases.length}</strong>
              <span>casos</span>
            </div>
            <div>
              <strong>
                {accepted}/{enrollment?.requirements.length ?? 0}
              </strong>
              <span>requisitos</span>
            </div>
          </div>
        </Card>
        <div className="profile-main">
          <DetailTabs
            tabs={[
              { id: "enrollment", label: "Inscripción" },
              {
                id: "requirements",
                label: "Papelería",
                count: enrollment?.requirements.length,
              },
              { id: "cases", label: "Casos", count: data.cases.length },
              { id: "legal-study", label: "Estudio jurídico" },
              { id: "discipline", label: "Amonestaciones" },
              { id: "general", label: "Información" },
            ]}
            active={tab}
            onChange={setTab}
          />
          {tab === "legal-study" && <StudentLegalStudyPanel student={data.student} canWrite={canWrite} onChanged={() => { reload(); legalStudyStatus.reload(); }} />}
          {tab === "discipline" && <StudentDisciplinePanel student={data.student} onChanged={() => { reload(); setDisciplineRevision(value => value + 1); }} />}
          {tab === "enrollment" && enrollment && (
            <div className="detail-column">
              <Card>
                <SectionHeading
                  title="Solicitud de inscripción"
                  description="Estado administrativo y resolución de la práctica"
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        setStatusForm({
                          status: enrollment.status,
                          resolutionNotes: enrollment.resolutionNotes ?? "",
                        });
                        setFormError("");
                        setAction("status");
                      }}
                    >
                      Cambiar estado
                    </Button>
                  }
                />
                <div className="enrollment-status">
                  <span className="enrollment-status__icon">
                    <BadgeCheck size={25} />
                  </span>
                  <div>
                    <Badge tone={statusTone(enrollment.status)}>
                      {translate(enrollment.status)}
                    </Badge>
                    <h3>{translate(enrollment.modality)}</h3>
                    <p>{enrollmentStatusDescription(enrollment.status, enrollment.resolutionNotes)}</p>
                  </div>
                </div>
                {hasInconsistentActiveAssignment(data) ? <div className="form-error" role="alert">Este alumno tiene un caso asignado, pero no tiene una inscripción aprobada y activa. Revise el expediente y regularice la asignación.</div> : !canAssignStudent(data) ? <p className="muted-copy">La asignación de casos se habilita cuando el alumno está activo y su inscripción está aprobada.</p> : null}
                <div className="info-grid">
                  <InfoItem label="Sede" value={enrollment.siteName} />
                  <InfoItem label="Jornada" value={enrollment.shift} />
                  <InfoItem
                    label="Días de práctica"
                    value={enrollment.practiceDays}
                  />
                  <InfoItem
                    label="Horario"
                    value={`${enrollment.startTime?.slice(0, 5) ?? "—"} – ${enrollment.endTime?.slice(0, 5) ?? "—"}`}
                  />
                  <InfoItem
                    label="Inicio"
                    value={formatDate(enrollment.startDate)}
                  />
                  <InfoItem
                    label="Finalización"
                    value={formatDate(enrollment.endDate)}
                  />
                </div>
                {enrollment.status === "Approved" &&
                  !enrollment.clinicCardNumber && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setFormError("");
                        setAction("card");
                      }}
                    >
                      Registrar carné de práctica
                    </Button>
                  )}
              </Card>
              {enrollment.clinicCardNumber && (
                <Card className="clinic-card">
                  <span className="clinic-card__mark">UMG</span>
                  <div>
                    <small>BUFETE JURÍDICO · CARNÉ DE PRÁCTICA</small>
                    <strong>{student.fullName}</strong>
                    <span>
                      {enrollment.clinicCardNumber} · Vigente hasta{" "}
                      {formatDate(enrollment.clinicCardExpirationDate)}
                    </span>
                  </div>
                  <Badge tone="success">Entregado</Badge>
                </Card>
              )}
            </div>
          )}
          {tab === "requirements" && enrollment && (
            <Card>
              <SectionHeading
                title="Requisitos de inscripción"
                description={`${accepted} de ${enrollment.requirements.length} requisitos aceptados`}
              />
              <div className="requirement-progress">
                <span
                  style={{
                    width: `${enrollment.requirements.length ? (accepted / enrollment.requirements.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="requirement-cards">
                {enrollment.requirements.map((requirement) => (
                  <div
                    className="requirement-card"
                    key={requirement.id}
                  >
                    <span
                      className={`requirement-card__icon ${requirement.status === "Pending" ? "pending" : ""}`}
                    >
                      <FileText size={19} />
                    </span>
                    <span>
                      <strong>{requirement.label}</strong>
                      <small>
                        {requirement.notes ??
                          (requirement.documentId
                            ? "Documento asociado al expediente"
                            : "Sin documento")}
                      </small>
                    </span>
                    <Badge tone={statusTone(requirement.status)}>
                      {translate(requirement.status)}
                    </Badge>
                    <span className="inline-actions">
                      {requirement.documentId ? <DocumentLink documentId={requirement.documentId} label="Ver" /> : null}
                      {canWrite && requirement.kind === "Document" ? <Button variant="ghost" size="sm" onClick={() => setScanRequirement(requirement)}><FilePlus2 size={15} /> {requirement.documentId ? "Reemplazar" : "Adjuntar"}</Button> : null}
                      {canWrite && canEvaluateRequirement(requirement) ? <Button variant="ghost" size="sm" onClick={() => openRequirement(requirement)}><Pencil size={15} /> {requirement.kind === "Document" ? (requirement.documentId ? "Revisar" : "Evaluar aplicación") : (requirement.dataValue ? "Actualizar" : "Completar")}</Button> : null}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {tab === "cases" && (
            <Card>
              <SectionHeading
                title="Casos asignados"
                description="Participación actual e histórica del alumno"
              />
              {data.cases.length ? (
                <div className="related-list">
                  {data.cases.map((legalCase) => (
                    <div
                      className="related-list__row"
                      key={legalCase.caseId}
                    >
                      <span className="related-list__icon">
                        <FolderKanban size={19} />
                      </span>
                      <span>
                        <Link to={`/expedientes/${legalCase.caseId}`}><strong>
                          {legalCase.caseNumber} · {legalCase.clientName}
                        </strong></Link>
                        <small>
                          {legalCase.processType} · {legalCase.assignmentStatus === "Active" ? (legalCase.lastStep ?? "Sin movimientos") : `Participación finalizada${legalCase.endReason ? `: ${legalCase.endReason}` : ""}`}
                        </small>
                      </span>
                      <div className="inline-actions">
                        <Badge tone={legalCase.assignmentStatus === "Active" ? "success" : "neutral"}>{translate(legalCase.assignmentStatus)}</Badge>
                        {canAssign && legalCase.assignmentStatus === "Active" ? <Button variant="ghost" size="sm" onClick={() => { setCaseToEnd(legalCase); setUnassignReason(""); setFormError(""); setAction("unassign"); }}><UserMinus size={15} /> Desasignar</Button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">
                  El alumno todavía no tiene casos asignados.
                </p>
              )}
            </Card>
          )}
          {tab === "general" && (
            <Card>
              <SectionHeading title="Información personal y académica" />
              <div className="info-grid">
                <InfoItem label="DPI" value={student.dpi} />
                <InfoItem
                  label="Fecha de nacimiento"
                  value={formatDate(student.birthDate)}
                />
                <InfoItem
                  label="Fecha de inscripción"
                  value={formatDate(student.registrationDate)}
                />
                <InfoItem
                  label="Lugar de trabajo"
                  value={student.workplace ?? "No trabaja actualmente"}
                />
                <InfoItem label="Cargo" value={student.jobTitle} />
              </div>
              {student.workplace && (
                <div className="note-panel">
                  <BriefcaseBusiness size={17} />
                  <div>
                    <strong>Información laboral</strong>
                    <p>
                      {student.workplace} · Supervisor:{" "}
                      {student.immediateSupervisor} · {student.workPhone}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
      <Modal
        open={action === "access"}
        onClose={() => !busy && setAction(null)}
        title="Activar acceso del alumno"
        description="Acceso de consulta al perfil y casos asignados."
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
              disabled={
                busy || !isValidPassword(accessForm.password) || !accessForm.confirmPassword
              }
              onClick={saveAccess}
            >
              {busy ? "Activando…" : "Crear acceso"}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="form-error" role="alert">
            {formError}
          </div>
        )}
        <div className="access-activation-summary">
          <span>
            <UserRoundPlus size={22} />
          </span>
          <div>
            <strong>{student.fullName}</strong>
            <p>
              {student.email} · Carné {student.studentCardNumber}
            </p>
          </div>
          <Badge tone="warning">Acceso pendiente</Badge>
        </div>
        <div className="form-grid">
          <Field label="Correo de acceso">
            <input
              type="email"
              value={student.email}
              readOnly
              aria-readonly="true"
            />
          </Field>
          <Field label="Contraseña temporal">
            <input
              type="password"
              value={accessForm.password}
              onChange={(event) =>
                setAccessForm({ ...accessForm, password: event.target.value })
              }
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </Field>
          <Field label="Confirmar contraseña">
            <input
              type="password"
              value={accessForm.confirmPassword}
              onChange={(event) =>
                setAccessForm({
                  ...accessForm,
                  confirmPassword: event.target.value,
                })
              }
              autoComplete="new-password"
            />
          </Field>
        </div>
        <FilePicker
          label="Fotografía de perfil (opcional)"
          hint="Visible en el perfil y casos asignados"
          file={studentPhoto}
          onChange={setStudentPhoto}
          accept="image/png,image/jpeg,image/webp"
        />
        <div className="access-policy-note">
          <KeyRound size={18} />
          <p>
            Datos editables en Mi perfil: nombre, correo, fotografía y
            contraseña.
          </p>
        </div>
      </Modal>
      <Modal
        size="lg"
        open={action === "edit"}
        onClose={() => !busy && setAction(null)}
        title="Editar datos del alumno"
        description="Información personal, académica y laboral."
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
              disabled={
                busy ||
                !editForm.fullName ||
                !editForm.studentCardNumber ||
                !editForm.dpi ||
                !editForm.email ||
                !editForm.studyShift ||
                !editForm.residenceAddress
              }
              onClick={saveStudent}
            >
              Guardar perfil
            </Button>
          </>
        }
      >
        {student.userAccountId ? (
          <FilePicker
            label="Fotografía del alumno"
            hint="PNG, JPG o WEBP · visible en el perfil y casos asignados"
            file={studentPhoto}
            onChange={setStudentPhoto}
            accept="image/png,image/jpeg,image/webp"
          />
        ) : null}
        <div className="form-grid">
          <div className="form-section-heading field--wide"><strong>Identidad y contacto</strong><span>Datos oficiales y medios de contacto del alumno.</span></div>
          <Field label="Nombre completo">
            <input
              value={editForm.fullName}
              onChange={(event) =>
                setEditForm({ ...editForm, fullName: event.target.value })
              }
            />
          </Field>
          <AppDatePicker
            label="Fecha de nacimiento"
            preset="birthDate"
            value={editForm.birthDate}
            onChange={(birthDate) => setEditForm({ ...editForm, birthDate })}
            max={editForm.registrationDate}
            required
          />
          <Field label="Carné">
            <input
              value={editForm.studentCardNumber}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  studentCardNumber: event.target.value,
                })
              }
            />
          </Field>
          <Field label="DPI">
            <input
              value={editForm.dpi}
              onChange={(event) =>
                setEditForm({ ...editForm, dpi: formatCui(event.target.value) })
              }
              inputMode="numeric"
              maxLength={15}
              placeholder="0000 00000 0000"
            />
          </Field>
          <Field label="Correo de acceso">
            <input
              type="email"
              value={editForm.email}
              onChange={(event) =>
                setEditForm({ ...editForm, email: event.target.value })
              }
            />
          </Field>
          <Field label="Teléfono móvil">
            <input
              type="tel"
              inputMode="tel"
              placeholder="0000 0000"
              value={editForm.mobilePhone}
              onChange={(event) =>
                setEditForm({ ...editForm, mobilePhone: formatGuatemalaPhone(event.target.value) })
              }
            />
          </Field>
          <Field label="Teléfono residencial">
            <input
              type="tel"
              inputMode="tel"
              placeholder="0000 0000"
              value={editForm.homePhone}
              onChange={(event) =>
                setEditForm({ ...editForm, homePhone: formatGuatemalaPhone(event.target.value) })
              }
            />
          </Field>
          <Field label="Dirección de residencia">
            <textarea
              value={editForm.residenceAddress}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  residenceAddress: event.target.value,
                })
              }
            />
          </Field>
          <div className="form-section-heading field--wide"><strong>Información académica</strong><span>Datos de la práctica y registro universitario.</span></div>
          <Field label="Jornada">
            <Select
              value={editForm.studyShift}
              onChange={(event) =>
                setEditForm({ ...editForm, studyShift: event.target.value })
              }
            >
              <option value="">Seleccione una jornada</option>
              <option value="Entre semana">Entre semana</option>
              <option value="Sábado">Sábado</option>
              <option value="Domingo">Domingo</option>
            </Select>
          </Field>
          <AppDatePicker
            label="Fecha de inscripción"
            preset="processDate"
            value={editForm.registrationDate}
            onChange={(registrationDate) =>
              setEditForm({ ...editForm, registrationDate })
            }
            required
          />
          {enrollment && <>
            <div className="form-section-heading field--wide"><strong>Datos de la práctica</strong><span>El estado y la resolución se gestionan en Inscripción; el acceso conserva su período autorizado.</span></div>
            <ReadOnlyValue label="Sede responsable" value={user?.tenantName ?? 'Sede actual'} />
            <Field label="Modalidad"><Select value={editForm.modality} onChange={(event) => setEditForm({ ...editForm, modality: event.target.value })}>
              <option value="CivilFamilyCases">Casos civiles y de familia</option><option value="ExternalInternship">Pasantía externa</option><option value="AdHonoremSecretariat">Secretaría ad honorem</option>
            </Select></Field>
            {editForm.modality === 'ExternalInternship' && <Field label="Institución externa de práctica" hint="No cambia la sede responsable."><input value={editForm.siteName} onChange={(event) => setEditForm({ ...editForm, siteName: event.target.value })} /></Field>}
            <Field label="Dirección del lugar de práctica" wide><textarea value={editForm.siteAddress} onChange={(event) => setEditForm({ ...editForm, siteAddress: event.target.value })} /></Field>
            <Field label="Jornada de práctica"><Select value={editForm.practiceShift} onChange={(event) => setEditForm({ ...editForm, practiceShift: event.target.value })}><option value="">Sin definir</option><option value="Matutina">Matutina</option><option value="Vespertina">Vespertina</option><option value="Nocturna">Nocturna</option></Select></Field>
            <Field label="Días de práctica"><input value={editForm.practiceDays} onChange={(event) => setEditForm({ ...editForm, practiceDays: event.target.value })} /></Field>
            <TimePickerField label="Hora de inicio" value={editForm.startTime} onChange={(startTime) => setEditForm({ ...editForm, startTime })} />
            <TimePickerField label="Hora de finalización" value={editForm.endTime} onChange={(endTime) => setEditForm({ ...editForm, endTime })} />
            <DateRangePickerField label="Período de práctica" startValue={editForm.startDate} endValue={editForm.endDate} onChange={(startDate, endDate) => setEditForm({ ...editForm, startDate, endDate })} />
          </>}
          <div className="form-section-heading field--wide"><strong>Información laboral</strong><span>Datos opcionales del lugar de trabajo.</span></div>
          <Field label="Lugar de trabajo">
            <input
              value={editForm.workplace}
              onChange={(event) =>
                setEditForm({ ...editForm, workplace: event.target.value })
              }
            />
          </Field>
          <Field label="Teléfono de trabajo">
            <input
              type="tel"
              inputMode="tel"
              placeholder="0000 0000"
              value={editForm.workPhone}
              onChange={(event) =>
                setEditForm({ ...editForm, workPhone: formatGuatemalaPhone(event.target.value) })
              }
            />
          </Field>
          <Field label="Jefe inmediato">
            <input
              value={editForm.immediateSupervisor}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  immediateSupervisor: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Puesto desempeñado">
            <input
              value={editForm.jobTitle}
              onChange={(event) =>
                setEditForm({ ...editForm, jobTitle: event.target.value })
              }
            />
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        open={action === "unassign"}
        onClose={() => !busy && setAction(null)}
        title="Desasignar del expediente"
        description={caseToEnd ? `${caseToEnd.caseNumber} dejará de figurar como asignación activa. La participación anterior permanecerá en el histórico.` : ""}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button><Button disabled={busy || !unassignReason.trim()} onClick={endAssignment}>{busy ? "Guardando…" : "Confirmar desasignación"}</Button></>}
      >
        <Field label="Motivo de desasignación"><textarea value={unassignReason} onChange={(event) => setUnassignReason(event.target.value)} maxLength={500} /></Field>
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
      </Modal>
      <Modal
        size="lg"
        open={action === "requirement"}
        onClose={() => !busy && setAction(null)}
        title={selectedRequirement?.label ?? "Requisito"}
        description={selectedRequirement?.documentId ? "Registre el resultado de la revisión del archivo adjunto." : selectedRequirement?.kind === "Data" ? "Complete y valide el dato requerido." : "Indique si este requisito condicional aplica a la inscripción."}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button disabled={busy || (selectedRequirement ? !requirementStatusOptions({ ...selectedRequirement, dataValue: requirementForm.dataValue }).some((status) => status === requirementForm.status) : true)} onClick={saveRequirement}>
              {selectedRequirement?.documentId ? "Guardar revisión" : "Guardar evaluación"}
            </Button>
          </>
        }
      >
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
              {selectedRequirement && requirementStatusOptions({ ...selectedRequirement, dataValue: requirementForm.dataValue }).map((status) => (
                <option key={status} value={status}>{translate(status)}</option>
              ))}
            </Select>
          </Field>
          {selectedRequirement?.kind === "Document" && selectedRequirement.documentId ? <AppDatePicker
            label="Fecha de emisión"
            preset="processDate"
            value={requirementForm.documentIssueDate}
            onChange={(documentIssueDate) =>
              setRequirementForm({ ...requirementForm, documentIssueDate })
            }
          /> : null}
          {selectedRequirement?.kind === "Data" ? <Field label="Dato requerido">
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
        {selectedRequirement && requirementEvidenceHint({ ...selectedRequirement, dataValue: requirementForm.dataValue }) ? <p className="muted-copy">{requirementEvidenceHint({ ...selectedRequirement, dataValue: requirementForm.dataValue })}</p> : null}
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <DocumentAcquisition
        open={!!scanRequirement && !!enrollment}
        onClose={() => setScanRequirement(null)}
        contexts={enrollment ? { Enrollment: [{ id: enrollment.id, label: `Inscripción de ${student.fullName}` }] } : undefined}
        initialForm={{
          contextType: "Enrollment",
          contextId: enrollment?.id ?? "",
          label: scanRequirement?.label ?? "Documento de inscripción",
          replaceDocumentId: scanRequirement?.documentId ?? "",
        }}
        contextLocked
        onCompleted={async (document) => {
          if (!enrollment || !scanRequirement) return;
          await dataSource.updateStudentRequirement(enrollment.id, scanRequirement.id, feedbackHandled({
            status: scanRequirement.status === "Pending" ? "Submitted" : scanRequirement.status,
            documentId: document.id,
            dataValue: scanRequirement.dataValue,
            documentIssueDate: scanRequirement.documentIssueDate,
            notes: scanRequirement.notes,
          }));
          setScanRequirement(null);
          await reload();
        }}
      />
      <Modal
        open={action === "status"}
        onClose={() => !busy && setAction(null)}
        title="Cambiar estado de inscripción"
        description="Para aprobar, todos los requisitos obligatorios deben estar aceptados."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button disabled={busy || (statusForm.status === "Approved" && pendingMandatoryRequirements.length > 0)} onClick={saveStatus}>
              Guardar estado
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nuevo estado">
            <Select
              value={statusForm.status}
              onChange={(event) =>
                setStatusForm({ ...statusForm, status: event.target.value })
              }
            >
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === enrollment?.status
                    ? `${enrollmentStatusLabels[status]} (actual)`
                    : enrollmentStatusLabels[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Resolución u observaciones">
            <textarea
              value={statusForm.resolutionNotes}
              onChange={(event) =>
                setStatusForm({
                  ...statusForm,
                  resolutionNotes: event.target.value,
                })
              }
            />
          </Field>
        </div>
        {statusForm.status === "Approved" && pendingMandatoryRequirements.length > 0 ? (
          <div className="form-error" role="alert">
            <strong>Requisitos obligatorios pendientes:</strong>
            <ul>
              {pendingMandatoryRequirements.map((item) => <li key={item.id}>{item.label}</li>)}
            </ul>
          </div>
        ) : null}
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        open={action === "card"}
        onClose={() => !busy && setAction(null)}
        title="Registrar carné de práctica"
        description="Disponible únicamente para inscripciones aprobadas."
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
              disabled={busy || !cardForm.cardNumber || !cardForm.issuedDate}
              onClick={saveCard}
            >
              Registrar carné
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Número de carné">
            <input
              value={cardForm.cardNumber}
              onChange={(event) =>
                setCardForm({ ...cardForm, cardNumber: event.target.value })
              }
            />
          </Field>
          <AppDatePicker
            label="Fecha de emisión"
            preset="startDate"
            value={cardForm.issuedDate}
            onChange={(issuedDate) => setCardForm({ ...cardForm, issuedDate })}
            required
          />
          <AppDatePicker
            label="Vencimiento"
            preset="endDate"
            min={cardForm.issuedDate || undefined}
            value={cardForm.expirationDate}
            onChange={(expirationDate) =>
              setCardForm({ ...cardForm, expirationDate })
            }
          />
          <Field label="Entrega">
            <Select
              value={String(cardForm.markDelivered)}
              onChange={(event) =>
                setCardForm({
                  ...cardForm,
                  markDelivered: event.target.value === "true",
                })
              }
            >
              <option value="true">Marcar entregado</option>
              <option value="false">Pendiente de entrega</option>
            </Select>
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
    </div>
  );
}
