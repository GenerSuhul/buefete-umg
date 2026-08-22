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
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import type { StudentRequirement } from "../types/domain";
import { formatDate, statusTone, translate } from "../utils/format";

const emptyEdit = {
  fullName: "",
  birthDate: "",
  ageAtRegistration: "",
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
};

export function StudentDetailPage() {
  const { user } = useAuth();
  const canWrite = Boolean(
    user?.permissions.includes("*") ||
      user?.permissions.includes("students.write"),
  );
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("enrollment");
  const [action, setAction] = useState<
    "edit" | "access" | "requirement" | "status" | "card" | null
  >(null);
  const [selectedRequirement, setSelectedRequirement] =
    useState<StudentRequirement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [studentPhoto, setStudentPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
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
    issuedDate: new Date().toISOString().slice(0, 10),
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

  if (loading) return <LoadingState label="Abriendo perfil del alumno" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Alumno no encontrado")}
        retry={reload}
      />
    );
  const student = data.student;
  const enrollment = data.enrollments[0];
  const accepted =
    enrollment?.requirements.filter((item) => item.status === "Accepted")
      .length ?? 0;

  const startEdit = () => {
    setEditForm({
      fullName: student.fullName,
      birthDate: student.birthDate ?? "",
      ageAtRegistration: student.ageAtRegistration?.toString() ?? "",
      studentCardNumber: student.studentCardNumber,
      dpi: student.dpi,
      semester: student.semester?.toString() ?? "",
      studyShift: student.studyShift ?? "",
      workplace: student.workplace ?? "",
      workPhone: student.workPhone ?? "",
      immediateSupervisor: student.immediateSupervisor ?? "",
      jobTitle: student.jobTitle ?? "",
      residenceAddress: student.residenceAddress,
      mobilePhone: student.mobilePhone ?? "",
      homePhone: student.homePhone ?? "",
      email: student.email,
      registrationDate: student.registrationDate,
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
    setBusy(true);
    setFormError("");
    try {
      await dataSource.updateStudent(id, {
        fullName: editForm.fullName,
        birthDate: editForm.birthDate || null,
        ageAtRegistration: editForm.ageAtRegistration
          ? Number(editForm.ageAtRegistration)
          : null,
        studentCardNumber: editForm.studentCardNumber,
        dpi: editForm.dpi,
        semester: editForm.semester ? Number(editForm.semester) : null,
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
      });
      if (studentPhoto) {
        if (!student.userAccountId)
          throw new Error(
            "Primero vincule una cuenta de usuario al alumno para guardar su fotografía.",
          );
        await dataSource.setUserPhoto(student.userAccountId, studentPhoto);
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
  const openRequirement = (item: StudentRequirement) => {
    setSelectedRequirement(item);
    setFile(null);
    setRequirementForm({
      status: item.status,
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
      let documentId = selectedRequirement.documentId;
      if (file)
        documentId = (
          await dataSource.uploadDocument({
            file,
            contextType: "Enrollment",
            contextId: enrollment.id,
            label: selectedRequirement.label,
            replaceDocumentId: selectedRequirement.documentId,
          })
        ).id;
      await dataSource.updateStudentRequirement(
        enrollment.id,
        selectedRequirement.id,
        {
          status: requirementForm.status,
          documentId,
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
          : "No se pudo emitir el carné.",
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
        description={`${student.semester ?? "—"}.º semestre · Jornada ${student.studyShift?.toLowerCase() ?? "sin registrar"}`}
        actions={
          canWrite ? (
            <>
              {!student.userAccountId ? (
                <Button onClick={startAccess}>
                  <UserRoundPlus size={17} />
                  Activar acceso
                </Button>
              ) : null}
              <Button variant="secondary" onClick={startEdit}>
                <Pencil size={17} />
                Editar perfil
              </Button>
              <Button
                variant={student.isActive ? "danger" : "secondary"}
                disabled={busy}
                onClick={toggleStudentActive}
              >
                {student.isActive ? "Dar de baja" : "Reactivar"}
              </Button>
              <Button onClick={() => navigate("/expedientes")}>
                <FolderKanban size={17} />
                Asignar caso
              </Button>
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
            {student.isActive ? "Práctica activa" : "Inactivo"}
          </Badge>
          <div className="profile-contact">
            <span>
              <Mail size={15} />
              {student.email}
            </span>
            <span>
              <Phone size={15} />
              {student.mobilePhone}
            </span>
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
              { id: "general", label: "Información" },
            ]}
            active={tab}
            onChange={setTab}
          />
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
                    <p>
                      {enrollment.resolutionNotes ??
                        "La solicitud continúa en revisión documental."}
                    </p>
                  </div>
                </div>
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
                      Emitir carné de práctica
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
                  <button
                    className="requirement-card requirement-card--button"
                    key={requirement.id}
                    onClick={() => openRequirement(requirement)}
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
                    <Pencil size={16} />
                  </button>
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
                    <Link
                      to={`/expedientes/${legalCase.caseId}`}
                      key={legalCase.caseId}
                    >
                      <span className="related-list__icon">
                        <FolderKanban size={19} />
                      </span>
                      <span>
                        <strong>
                          {legalCase.caseNumber} · {legalCase.clientName}
                        </strong>
                        <small>
                          {legalCase.processType} · {legalCase.lastStep}
                        </small>
                      </span>
                      <Badge tone={statusTone(legalCase.status)}>
                        {translate(legalCase.status)}
                      </Badge>
                    </Link>
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
                <InfoItem label="Semestre" value={student.semester} />
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
                busy || !accessForm.password || !accessForm.confirmPassword
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
              placeholder="12+ caracteres, mayúscula, número y símbolo"
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
          <Field label="Nombre completo">
            <input
              value={editForm.fullName}
              onChange={(event) =>
                setEditForm({ ...editForm, fullName: event.target.value })
              }
            />
          </Field>
          <Field label="Edad">
            <input
              type="number"
              min="15"
              max="100"
              value={editForm.ageAtRegistration}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  ageAtRegistration: event.target.value,
                  birthDate: "",
                })
              }
            />
          </Field>
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
                setEditForm({ ...editForm, dpi: event.target.value })
              }
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
              value={editForm.mobilePhone}
              onChange={(event) =>
                setEditForm({ ...editForm, mobilePhone: event.target.value })
              }
            />
          </Field>
          <Field label="Teléfono residencial">
            <input
              value={editForm.homePhone}
              onChange={(event) =>
                setEditForm({ ...editForm, homePhone: event.target.value })
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
          <Field label="Semestre">
            <input
              type="number"
              min="1"
              value={editForm.semester}
              onChange={(event) =>
                setEditForm({ ...editForm, semester: event.target.value })
              }
            />
          </Field>
          <Field label="Jornada">
            <input
              value={editForm.studyShift}
              onChange={(event) =>
                setEditForm({ ...editForm, studyShift: event.target.value })
              }
            />
          </Field>
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
              value={editForm.workPhone}
              onChange={(event) =>
                setEditForm({ ...editForm, workPhone: event.target.value })
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
          <DatePickerField
            label="Fecha de inscripción"
            value={editForm.registrationDate}
            onChange={(registrationDate) =>
              setEditForm({ ...editForm, registrationDate })
            }
            required
          />
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        size="lg"
        open={action === "requirement"}
        onClose={() => !busy && setAction(null)}
        title={selectedRequirement?.label ?? "Requisito"}
        description="Documento y estado del requisito."
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
              <option value="Expired">Vencido</option>
              <option value="NotApplicable">No aplica</option>
            </select>
          </Field>
          <DatePickerField
            label="Fecha de emisión"
            value={requirementForm.documentIssueDate}
            onChange={(documentIssueDate) =>
              setRequirementForm({ ...requirementForm, documentIssueDate })
            }
          />
          <FilePicker
            label="Documento"
            hint="PDF, JPG, PNG o WEBP"
            file={file}
            onChange={setFile}
          />
          <Field label="Dato">
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
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
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
            <Button disabled={busy} onClick={saveStatus}>
              Guardar estado
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nuevo estado">
            <select
              value={statusForm.status}
              onChange={(event) =>
                setStatusForm({ ...statusForm, status: event.target.value })
              }
            >
              <option value="Draft">Borrador</option>
              <option value="Submitted">Presentada</option>
              <option value="Admitted">Admitida</option>
              <option value="UnderReview">En revisión</option>
              <option value="Observed">Observada</option>
              <option value="Approved">Aprobada</option>
              <option value="Rejected">Rechazada</option>
              <option value="Completed">Completada</option>
            </select>
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
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        open={action === "card"}
        onClose={() => !busy && setAction(null)}
        title="Emitir carné de práctica"
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
              Emitir carné
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
          <DatePickerField
            label="Fecha de emisión"
            value={cardForm.issuedDate}
            onChange={(issuedDate) => setCardForm({ ...cardForm, issuedDate })}
            required
          />
          <DatePickerField
            label="Vencimiento"
            value={cardForm.expirationDate}
            onChange={(expirationDate) =>
              setCardForm({ ...cardForm, expirationDate })
            }
          />
          <Field label="Entrega">
            <select
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
            </select>
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
    </div>
  );
}
