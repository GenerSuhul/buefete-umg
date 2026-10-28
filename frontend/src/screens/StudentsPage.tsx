import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  ContactRound,
  GraduationCap,
  Plus,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EnrollmentDocumentPicker } from "../components/documents/EnrollmentDocumentPicker";
import { Link, useNavigate } from "../routing/navigation";
import { FilterBar, Pagination } from "../components/domain/Shared";
import {
  Avatar,
  Badge,
  Button,
  Card,
  AppDatePicker,
  DateRangePickerField,
  ErrorState,
  Field,
  FilePicker,
  LoadingState,
  Modal,
  PageHeader,
  ReadOnlyValue,
  WizardProgress,
  WizardStep,
  Select,
  TimePickerField,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { dataSource } from "../data/dataSource";
import { feedbackHandled } from "../components/ui/feedback/operationFeedback";
import { useNotify } from "../components/ui/Feedback";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate } from "../utils/format";
import { toLocalDateOnly } from "../utils/date";
import { isValidPassword } from "../utils/passwordPolicy";
import {
  formatCui,
  formatGuatemalaPhone,
  isCompleteCui,
  isCompleteGuatemalaPhone,
} from "../utils/inputMasks";

const today = () => toLocalDateOnly();
const emptyForm = {
  fullName: "",
  birthDate: "",
  studentCardNumber: "",
  dpi: "",
  studyShift: "Entre semana",
  practiceShift: "Matutina",
  residenceAddress: "",
  mobilePhone: "",
  homePhone: "",
  email: "",
  workplace: "",
  workPhone: "",
  immediateSupervisor: "",
  jobTitle: "",
  modality: "CivilFamilyCases",
  siteName: "Bufete Popular UMG",
  siteAddress: "",
  practiceDays: "",
  startTime: "",
  endTime: "",
  registrationDate: today(),
  startDate: "",
  endDate: "",
  password: "",
  confirmPassword: "",
  giveAccess: false,
};
type StudentForm = typeof emptyForm;

const studentDocumentFields = [
  {
    key: "application",
    label: "Solicitud o memorial dirigido a la Dirección",
    match: "Solicitud o memorial",
  },
  { key: "dpi", label: "Copia del DPI", match: "Copia del DPI" },
  { key: "cv", label: "Curriculum Vitae", match: "Curriculum Vitae" },
  {
    key: "photos",
    label: "Tres fotografías tamaño cédula a color",
    match: "Tres fotografías",
  },
  {
    key: "courses",
    label: "Certificación original de cursos",
    match: "Certificación original",
  },
  {
    key: "enrollment",
    label: "Boleta o constancia de inscripción",
    match: "Boleta o constancia",
  },
  {
    key: "clinicPayment",
    label: "Pago de inscripción al Bufete Popular",
    match: "pago de inscripción al Bufete",
  },
  {
    key: "annualPayment",
    label: "Pago anual a la UMG",
    match: "pago anual a la UMG",
  },
  {
    key: "closedCurriculum",
    label: "Inscripción anual si cerró pensum",
    match: "pensum cerrado",
  },
] as const;
type StudentDocumentKey = (typeof studentDocumentFields)[number]["key"];
const emptyDocuments = () =>
  Object.fromEntries(
    studentDocumentFields.map((item) => [item.key, null]),
  ) as Record<StudentDocumentKey, File | null>;

const steps = [
  { id: "identity", label: "Identidad", description: "Datos académicos" },
  { id: "work", label: "Contacto y trabajo", description: "Ubicación laboral" },
  { id: "practice", label: "Práctica", description: "Modalidad y estado" },
  { id: "documents", label: "Papelería", description: "Nueve requisitos" },
  {
    id: "access",
    label: "Acceso y revisión",
    description: "Correo y permisos",
  },
];

export function StudentsPage() {
  const { user } = useAuth();
  const notify = useNotify();
  const canWrite = Boolean(
    user?.permissions.includes("*") ||
      user?.permissions.includes("students.write"),
  );
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [documentFiles, setDocumentFiles] = useState(emptyDocuments);
  const [documentSources, setDocumentSources] = useState<Record<string, 'Upload' | 'Scanner'>>({});
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const loader = useMemo(
    () => () => dataSource.listStudents({ search, page, pageSize: 20 }),
    [search, page],
  );
  const { data, error, loading, reload } = useAsyncData(loader, [search, page]);
  const passwordMismatch = Boolean(
    form.confirmPassword && form.password !== form.confirmPassword,
  );
  const update = <K extends keyof StudentForm>(key: K, value: StudentForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openRegistration = () => {
    setProfilePhoto(null);
    setDocumentSources({});
    setForm(emptyForm);
    setDocumentFiles(emptyDocuments());
    setFormError(null);
    setStep(0);
    setNewOpen(true);
  };
  const validateStep = (target = step) => {
    if (
      target === 0 &&
      (!form.fullName.trim() ||
        !form.birthDate ||
        !form.studentCardNumber.trim() ||
        !form.dpi.trim())
    )
      return "Nombre, fecha de nacimiento, carné y DPI son obligatorios.";
    if (target === 0 && form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      return "Ingrese un correo electrónico válido.";
    if (target === 0 && !isCompleteCui(form.dpi))
      return "El DPI debe contener los 13 dígitos del CUI.";
    if (target === 1 && !form.residenceAddress.trim())
      return "La dirección de residencia es obligatoria.";
    if (target === 1 && [form.mobilePhone, form.homePhone, form.workPhone].some((value) => !isCompleteGuatemalaPhone(value)))
      return "Los teléfonos deben contener 8 dígitos o el prefijo +502 seguido de 8 dígitos.";
    if (
      target === 2 &&
      (!form.registrationDate || !form.modality)
    )
      return "Fecha y modalidad son obligatorias.";
    if (
      target === 2 &&
      form.startTime &&
      form.endTime &&
      form.startTime >= form.endTime
    )
      return "La hora de finalización debe ser posterior a la hora de inicio.";
    if (target === 3) {
      const missing = studentDocumentFields.slice(0, -1).filter(field => !documentFiles[field.key]);
      if (missing.length) return `Adjunte todos los documentos obligatorios antes de inscribir: ${missing.map(field => field.label).join(', ')}.`;
    }
    if (target === 4 && form.giveAccess && !form.email.trim())
      return "Registre un correo electrónico para dar acceso al alumno.";
    if (target === 4 && form.giveAccess && !isValidPassword(form.password))
      return "La contraseña temporal debe tener entre 8 y 128 caracteres.";
    if (target === 4 && form.giveAccess && !form.confirmPassword)
      return "Confirme la contraseña temporal.";
    if (target === 4 && passwordMismatch)
      return "La confirmación de la contraseña no coincide.";
    return null;
  };
  const next = () => {
    const message = validateStep();
    if (message) {
      setFormError(message);
      return;
    }
    setFormError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const save = async () => {
    for (let target = 0; target < steps.length; target += 1) {
      const message = validateStep(target);
      if (message) {
        setStep(target);
        setFormError(message);
        return;
      }
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await notify.track((async () => {
        const registration = await dataSource.registerStudent(feedbackHandled({
        student: {
          fullName: form.fullName.trim(),
          birthDate: form.birthDate,
          ageAtRegistration: null,
          studentCardNumber: form.studentCardNumber.trim(),
          dpi: form.dpi.trim(),
          semester: null,
          studyShift: form.studyShift,
          workplace: form.workplace.trim() || null,
          workPhone: form.workPhone.trim() || null,
          immediateSupervisor: form.immediateSupervisor.trim() || null,
          jobTitle: form.jobTitle.trim() || null,
          residenceAddress: form.residenceAddress.trim(),
          mobilePhone: form.mobilePhone.trim() || null,
          homePhone: form.homePhone.trim() || null,
          email: form.email.trim(),
          registrationDate: form.registrationDate,
        },
        enrollment: {
          modality: form.modality,
          initialStatus: "Draft",
          siteName: form.siteName.trim() || null,
          siteAddress: form.modality === 'CivilFamilyCases' ? null : form.siteAddress.trim() || null,
          shift: form.practiceShift,
          practiceDays: form.practiceDays.trim() || null,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        },
        access: form.giveAccess ? {
          password: form.password,
          participationStartDate: form.startDate || form.registrationDate,
          participationEndDate: form.endDate || null,
        } : null,
      }));
      try {
      if (profilePhoto && registration.access) await dataSource.setUserPhoto(registration.access.userAccountId, profilePhoto);
      await Promise.all(
        studentDocumentFields.map(async (field) => {
          const file = documentFiles[field.key];
          const requirement = registration.enrollment.requirements.find((item) =>
            item.label.includes(field.match),
          );
          if (!file || !requirement) return;
          const document = await dataSource.uploadDocument(feedbackHandled({
            file,
            source: documentSources[field.key] ?? 'Upload',
            contextType: "Enrollment",
            contextId: registration.enrollment.id,
            label: requirement.label,
          }));
          await dataSource.updateStudentRequirement(
            registration.enrollment.id,
            requirement.id,
            feedbackHandled({
              status: "Submitted",
              documentId: document.id,
              dataValue: null,
              documentIssueDate: null,
              notes: null,
            }),
          );
        }),
      );
      } catch (reason) {
        notify.warning({ title: 'Alumno registrado; adjuntos pendientes', message: 'El perfil y la solicitud en borrador ya existen. Complete los adjuntos desde el detalle; no repita el registro.', duration: 12000 });
        setNewOpen(false);
        navigate(`/personas/alumnos/${registration.student.id}`);
        throw new Error(`La inscripción fue guardada, pero quedaron adjuntos pendientes: ${reason instanceof Error ? reason.message : 'revise la conexión'}`);
      }
        return registration;
      })(), {
        loading: { title: "Registrando alumno…", message: "Se está guardando el perfil y la papelería seleccionada." },
        success: { title: "Alumno registrado", message: `${form.fullName.trim()} quedó pendiente de revisión documental.` },
        error: { title: "No se completaron todos los pasos" },
      });
      setNewOpen(false);
      await reload();
      navigate(`/personas/alumnos/${result.student.id}`);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la inscripción.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectedDocumentCount =
    Object.values(documentFiles).filter(Boolean).length;
  const modalityLabel =
    form.modality === "CivilFamilyCases"
      ? "Casos civiles y de familia"
      : form.modality === "ExternalInternship"
        ? "Pasantía externa"
        : "Secretaría ad honorem";
  const footer = (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => setNewOpen(false)}
      >
        Cancelar
      </Button>
      {step > 0 && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setFormError(null);
            setStep((current) => current - 1);
          }}
        >
          <ArrowLeft size={16} />
          Atrás
        </Button>
      )}
      {step < steps.length - 1 ? (
        <Button disabled={busy} onClick={next}>
          Continuar
          <ArrowRight size={16} />
        </Button>
      ) : (
        <Button disabled={busy} onClick={save}>
          {busy
            ? "Creando perfil, expediente y acceso…"
            : "Crear alumno y acceso"}
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Práctica supervisada"
        title={canWrite ? "Alumnos" : "Mi perfil académico"}
        description="Perfil académico, inscripción, documentos y casos asignados."
        actions={
          canWrite ? (
            <Button onClick={openRegistration}>
              <Plus size={18} />
              Inscribir alumno
            </Button>
          ) : undefined
        }
      />
      <Card className="directory-card">
        <FilterBar
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Buscar por nombre, carné o correo…"
        />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          <>
            <div className="directory-table directory-table--students">
              <div className="directory-table__head">
                <span>Alumno</span>
                <span>Carné</span>
                <span>Registro</span>
                <span>Contacto</span>
                <span>Acceso</span>
              </div>
              {data?.items.map((student) => (
                <Link
                  to={`/personas/alumnos/${student.id}`}
                  className="directory-row"
                  key={student.id}
                >
                  <span className="entity-cell">
                    <Avatar
                      name={student.fullName}
                      documentId={student.photoDocumentId}
                    />
                    <span>
                      <strong>{student.fullName}</strong>
                      <small>
                        {student.studyShift ?? "Sin jornada"}
                      </small>
                    </span>
                  </span>
                  <span>
                    <strong>{student.studentCardNumber}</strong>
                    <small>DPI {student.dpi}</small>
                  </span>
                  <span>{formatDate(student.registrationDate)}</span>
                  <span>
                    <strong>{student.email}</strong>
                    <small>{student.mobilePhone ?? "Sin teléfono"}</small>
                  </span>
                  <Badge tone={student.userAccountId ? "success" : "warning"}>
                    {student.userAccountId
                      ? "Acceso activo"
                      : "Acceso pendiente"}
                  </Badge>
                </Link>
              ))}
            </div>
            {data && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                totalCount={data.totalCount}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>
      <Modal
        size="xl"
        open={newOpen}
        onClose={() => !busy && setNewOpen(false)}
        title="Inscribir alumno"
        description="Complete los datos requeridos para la inscripción."
        footer={footer}
      >
        <WizardProgress
          steps={steps}
          currentStep={step}
          onStepChange={(target) => {
            setFormError(null);
            setStep(target);
          }}
        />
        {formError && (
          <div className="form-error" role="alert">
            {formError}
          </div>
        )}
        {step === 0 && (
          <WizardStep
            title="Identidad y datos académicos"
            description="El correo electrónico será la credencial de acceso."
          >
            <FilePicker label="Fotografía de perfil del alumno" hint="JPG, PNG o WEBP. Independiente del requisito de tres fotografías físicas." accept="image/jpeg,image/png,image/webp" file={profilePhoto} onChange={setProfilePhoto} />
            <Field label="Nombre completo">
              <input
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                autoComplete="name"
              />
            </Field>
            <AppDatePicker
              label="Fecha de nacimiento"
              preset="birthDate"
              value={form.birthDate}
              onChange={(birthDate) => update("birthDate", birthDate)}
              max={form.registrationDate}
              required
            />
            <Field label="Carné universitario">
              <input
                value={form.studentCardNumber}
                onChange={(event) =>
                  update("studentCardNumber", event.target.value)
                }
              />
            </Field>
            <Field label="DPI">
              <input
                inputMode="numeric"
                value={form.dpi}
                maxLength={15}
                placeholder="0000 00000 0000"
                onChange={(event) => update("dpi", formatCui(event.target.value))}
              />
            </Field>
            <Field label="Jornada de estudio">
              <Select
                value={form.studyShift}
                onChange={(event) => update("studyShift", event.target.value)}
              >
                <option>Entre semana</option>
                <option>Sábado</option>
                <option>Domingo</option>
              </Select>
            </Field>
            <Field
              label="Correo electrónico"
              hint="Opcional. Se requiere únicamente si se habilita acceso al sistema."
              wide
            >
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
              />
            </Field>
          </WizardStep>
        )}
        {step === 1 && (
          <WizardStep
            title="Contacto y situación laboral"
            description="Complete únicamente los datos que correspondan."
          >
            <Field label="Dirección de residencia" wide>
              <textarea
                value={form.residenceAddress}
                onChange={(event) =>
                  update("residenceAddress", event.target.value)
                }
              />
            </Field>
            <Field label="Teléfono móvil">
              <input
                type="tel"
                inputMode="tel"
                placeholder="0000 0000"
                value={form.mobilePhone}
                onChange={(event) => update("mobilePhone", formatGuatemalaPhone(event.target.value))}
              />
            </Field>
            <Field label="Teléfono residencial">
              <input
                type="tel"
                inputMode="tel"
                placeholder="0000 0000"
                value={form.homePhone}
                onChange={(event) => update("homePhone", formatGuatemalaPhone(event.target.value))}
              />
            </Field>
            <Field label="Lugar de trabajo">
              <input
                value={form.workplace}
                onChange={(event) => update("workplace", event.target.value)}
              />
            </Field>
            <Field label="Teléfono de trabajo">
              <input
                type="tel"
                inputMode="tel"
                placeholder="0000 0000"
                value={form.workPhone}
                onChange={(event) => update("workPhone", formatGuatemalaPhone(event.target.value))}
              />
            </Field>
            <Field label="Jefe inmediato">
              <input
                value={form.immediateSupervisor}
                onChange={(event) =>
                  update("immediateSupervisor", event.target.value)
                }
              />
            </Field>
            <Field label="Puesto desempeñado">
              <input
                value={form.jobTitle}
                onChange={(event) => update("jobTitle", event.target.value)}
              />
            </Field>
          </WizardStep>
        )}
        {step === 2 && (
          <WizardStep
            title="Datos de la práctica"
            description="Defina la modalidad, el estado, el horario y el período de práctica."
          >
            <Field label="Modalidad">
              <Select
                value={form.modality}
                onChange={(event) => update("modality", event.target.value)}
              >
                <option value="CivilFamilyCases">
                  Casos civiles y de familia
                </option>
                <option value="ExternalInternship">Pasantía externa</option>
                <option value="AdHonoremSecretariat">
                  Secretaría ad honorem
                </option>
              </Select>
            </Field>
            <AppDatePicker
              label="Fecha de inscripción"
              preset="processDate"
              value={form.registrationDate}
              onChange={(value) => update("registrationDate", value)}
              required
            />
            <ReadOnlyValue label="Sede responsable" value={user?.tenantName ?? 'Sede actual'} />
            <Field label="Jornada de práctica"><Select value={form.practiceShift} onChange={(event) => update('practiceShift', event.target.value)}><option>Matutina</option><option>Vespertina</option><option>Nocturna</option></Select></Field>
            {form.modality === 'ExternalInternship' && <Field label="Institución externa de práctica" hint="No cambia la sede responsable del alumno.">
              <input
                value={form.siteName}
                onChange={(event) => update("siteName", event.target.value)}
              />
            </Field>}
            {form.modality !== 'CivilFamilyCases' && <Field label="Dirección del lugar de práctica" wide>
              <textarea
                value={form.siteAddress}
                onChange={(event) => update("siteAddress", event.target.value)}
              />
            </Field>}
            <Field label="Días de práctica">
              <input
                value={form.practiceDays}
                onChange={(event) => update("practiceDays", event.target.value)}
                placeholder="Ej. lunes y miércoles"
              />
            </Field>
            <TimePickerField
              label="Hora de inicio"
              value={form.startTime}
              onChange={(value) => update("startTime", value)}
            />
            <TimePickerField
              label="Hora de finalización"
              value={form.endTime}
              onChange={(value) => update("endTime", value)}
            />
            <DateRangePickerField
              label="Período de práctica"
              startValue={form.startDate}
              endValue={form.endDate}
              onChange={(startDate, endDate) => setForm((current) => ({ ...current, startDate, endDate }))}
              hint="Seleccione la fecha inicial y final en un mismo calendario."
            />
          </WizardStep>
        )}
        {step === 3 && (
          <WizardStep
            title="Documentos de inscripción"
            description="Adjunte todos los documentos obligatorios antes de inscribir al alumno."
          >
            {studentDocumentFields.map((field) => (
              <EnrollmentDocumentPicker
                key={field.key}
                label={field.label}
                file={documentFiles[field.key]}
                onChange={(file, source) => {
                  setDocumentSources((current) => ({ ...current, [field.key]: source }));
                  setDocumentFiles((current) => ({
                    ...current,
                    [field.key]: file,
                  }));
                }}
              />
            ))}
            <p className="wizard-inline-note">
              La inscripción requiere los documentos obligatorios; la constancia de pensum cerrado aplica cuando corresponda.
            </p>
          </WizardStep>
        )}
        {step === 4 && (
          <WizardStep
            title="Acceso y confirmación"
            description="Revise la inscripción y confirme el acceso."
          >
            <Field label="Dar acceso al sistema">
              <input type="checkbox" checked={form.giveAccess} onChange={(event) => update("giveAccess", event.target.checked)} />
            </Field>
            {form.giveAccess && <>
              <ReadOnlyValue label="Correo de acceso" value={form.email || "Registre un correo"} />
              <ReadOnlyValue label="Rol" value="Alumno" />
            <Field label="Contraseña temporal">
              <input
                type="password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
            </>}
            <Field label="Confirmar contraseña">
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  update("confirmPassword", event.target.value)
                }
                autoComplete="new-password"
                aria-invalid={passwordMismatch}
              />
            </Field>
            <div className="wizard-review field--wide">
              <section className="wizard-review__group">
                <h4>
                  <ContactRound size={15} /> Perfil
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue label="Alumno" value={form.fullName} />
                  <ReadOnlyValue label="Carné" value={form.studentCardNumber} />
                  <ReadOnlyValue label="Jornada" value={form.studyShift} />
                  <ReadOnlyValue
                    label="Registro"
                    value={formatDate(form.registrationDate)}
                  />
                </div>
              </section>
              <section className="wizard-review__group">
                <h4>
                  <GraduationCap size={15} /> Práctica
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue label="Modalidad" value={modalityLabel} />
                  <ReadOnlyValue label="Estado inicial" value="Pendiente de revisión documental" />
                  <ReadOnlyValue label="Lugar" value={form.siteName} />
                  <ReadOnlyValue
                    label="Horario"
                    value={
                      form.startTime && form.endTime
                        ? `${form.startTime}–${form.endTime}`
                        : "Por definir"
                    }
                  />
                </div>
              </section>
              <section className="wizard-review__group">
                <h4>
                  <ClipboardCheck size={15} /> Documentos y acceso
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue
                    label="Documentos adjuntos"
                    value={`${selectedDocumentCount} de ${studentDocumentFields.length} requisitos`}
                  />
                  <ReadOnlyValue label="Acceso" value={form.giveAccess ? "Se habilitará" : "Sin acceso"} />
                </div>
              </section>
              {form.giveAccess && <div className="access-assurance">
                <UserRoundCheck size={19} />
                <div>
                  <strong>Acceso del alumno</strong>
                  <p>Consulta de perfil y casos asignados.</p>
                </div>
              </div>}
            </div>
          </WizardStep>
        )}
      </Modal>
    </>
  );
}
