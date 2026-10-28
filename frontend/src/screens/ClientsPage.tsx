import { clientAttention } from '../utils/clientAttention';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  ClipboardCheck,
  FolderInput,
  IdCard,
  Plus,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "../routing/navigation";
import { FilterBar, Pagination } from "../components/domain/Shared";
import {
  Badge,
  Button,
  Card,
  AppDatePicker,
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
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { clientRestrictions } from '../data/clientRestrictions';
import { feedbackHandled } from "../components/ui/feedback/operationFeedback";
import { useNotify } from "../components/ui/Feedback";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate } from "../utils/format";
import { toLocalDateOnly } from "../utils/date";
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
  birthPlace: "",
  nationality: "Guatemalteca",
  sex: "",
  maritalStatus: "",
  dpi: "",
  residenceAddress: "",
  education: "",
  occupation: "",
  workplace: "",
  workAddress: "",
  workPhone: "",
  phone: "",
  mobilePhone: "",
  salaryAmount: "",
  salaryFrequency: "Mensual",
  childrenCount: "0",
  assistanceRequested: "",
  claimedAgainstPersonName: "",
  claimedAgainstPersonAddress: "",
  receptionPlace: "Bufete Popular UMG",
  receptionDate: today(),
  createIncomeDeclaration: true,
};

type ClientForm = typeof emptyForm;
type IntakeFileKey = "dpi" | "signature";

const steps = [
  { id: "identity", label: "Identidad", description: "Datos personales" },
  {
    id: "contact",
    label: "Contacto y trabajo",
    description: "Ubicación e ingresos",
  },
  { id: "reception", label: "Recepción", description: "Asistencia solicitada" },
  { id: "documents", label: "Papelería", description: "DPI y firma" },
  { id: "review", label: "Confirmar", description: "Revisión final" },
];

function calculateAge(birthDate: string, receptionDate: string) {
  if (!birthDate || !receptionDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const reception = new Date(`${receptionDate}T12:00:00`);
  if (
    Number.isNaN(birth.getTime()) ||
    Number.isNaN(reception.getTime()) ||
    birth > reception
  )
    return null;
  let age = reception.getFullYear() - birth.getFullYear();
  if (
    reception.getMonth() < birth.getMonth() ||
    (reception.getMonth() === birth.getMonth() &&
      reception.getDate() < birth.getDate())
  )
    age -= 1;
  return age;
}

export function ClientsPage() {
  const notify = useNotify();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [attention, setAttention] = useState("active");
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [files, setFiles] = useState<Record<IntakeFileKey, File | null>>({
    dpi: null,
    signature: null,
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const loader = useMemo(
    () => () => dataSource.listClients({ search, page, pageSize: 20, isActive: attention === "active" }),
    [search, page, attention],
  );
  const { data, error, loading, reload } = useAsyncData(loader, [search, page, attention]);
  const processTypes = useAsyncData(() => dataSource.listProcessTypes(), []);
  const ageAtReception = calculateAge(form.birthDate, form.receptionDate);

  const update = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const open = () => {
    const firstProcess =
      processTypes.data?.find((item) => item.isActive)?.name ?? "";
    setForm({ ...emptyForm, assistanceRequested: firstProcess });
    setFiles({ dpi: null, signature: null });
    setStep(0);
    setFormError(null);
    setNewOpen(true);
  };

  const validateStep = (target = step) => {
    if (target === 0 && (!form.fullName.trim() || !form.dpi.trim()))
      return "Nombre completo y DPI son obligatorios.";
    if (target === 0 && !isCompleteCui(form.dpi))
      return "El DPI debe contener los 13 dígitos del CUI.";
    if (target === 0 && form.birthDate && ageAtReception === null)
      return "La fecha de nacimiento no puede ser posterior a la recepción.";
    if (target === 1 && !form.residenceAddress.trim())
      return "La dirección de residencia es obligatoria.";
    if (target === 1 && Number(form.childrenCount) < 0)
      return "La cantidad de hijos no puede ser negativa.";
    if (
      target === 1 &&
      [form.phone, form.mobilePhone, form.workPhone].some(
        (value) => !isCompleteGuatemalaPhone(value),
      )
    )
      return "Los teléfonos deben contener 8 dígitos o el prefijo +502 seguido de 8 dígitos.";
    if (
      target === 2 &&
      (!form.assistanceRequested ||
        !form.receptionPlace.trim() ||
        !form.receptionDate)
    )
      return "Asistencia, lugar y fecha de recepción son obligatorios.";
    return null;
  };

  const next = async () => {
    const message = validateStep();
    if (message) {
      setFormError(message);
      return;
    }
    if (step === 0) {
      setBusy(true);
      try {
        if ((await clientRestrictions.check(form.dpi)).isRestricted) { setFormError('Atención bloqueada: este DPI tiene un bloqueo permanente en lista negra en todas las sedes.'); return; }
      } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'No se pudo verificar el DPI. Intente nuevamente.'); return; }
      finally { setBusy(false); }
    }
    setFormError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const request = (signatureDocumentId: string | null = null) => ({
    fullName: form.fullName.trim(),
    birthDate: form.birthDate || null,
    ageAtReception,
    birthPlace: form.birthPlace.trim() || null,
    nationality: form.nationality.trim() || null,
    sex: form.sex || null,
    maritalStatus: form.maritalStatus || null,
    dpi: form.dpi.trim(),
    residenceAddress: form.residenceAddress.trim(),
    education: form.education || null,
    occupation: form.occupation.trim() || null,
    workplace: form.workplace.trim() || null,
    workAddress: form.workAddress.trim() || null,
    workPhone: form.workPhone.trim() || null,
    phone: form.phone.trim() || null,
    mobilePhone: form.mobilePhone.trim() || null,
    salaryAmount: form.salaryAmount ? Number(form.salaryAmount) : null,
    salaryFrequency: form.salaryAmount ? form.salaryFrequency : null,
    childrenCount: Number(form.childrenCount || 0),
    assistanceRequested: form.assistanceRequested,
    claimedAgainstPersonName: form.claimedAgainstPersonName.trim() || null,
    claimedAgainstPersonAddress:
      form.claimedAgainstPersonAddress.trim() || null,
    receptionPlace: form.receptionPlace.trim(),
    receptionDate: form.receptionDate,
    signatureDocumentId,
  });

  const save = async () => {
    for (let target = 0; target <= 2; target += 1) {
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
      const created = await notify.track((async () => {
        let client = await dataSource.createClient(feedbackHandled(request()));
        if (files.dpi)
          await dataSource.uploadDocument(feedbackHandled({
            file: files.dpi,
            contextType: "Client",
            contextId: client.id,
            label: "DPI",
          }));
        let signatureDocumentId: string | null = null;
        if (files.signature)
          signatureDocumentId = (
            await dataSource.uploadDocument(feedbackHandled({
              file: files.signature,
              contextType: "Client",
              contextId: client.id,
              label: "Firma o impresión digital",
            }))
          ).id;
        if (signatureDocumentId)
          client = await dataSource.updateClient(
            client.id,
            feedbackHandled({ ...request(signatureDocumentId), concurrencyToken: client.concurrencyToken }),
          );
        if (form.createIncomeDeclaration) {
          await dataSource.createIncomeDeclaration(client.id, feedbackHandled({
            fullName: client.fullName,
            declaredAge: client.ageAtReception,
            maritalStatus: client.maritalStatus,
            sex: client.sex,
            dpi: client.dpi,
            occupation: client.occupation,
            nationality: client.nationality,
            residenceAddress: client.residenceAddress,
            phone: client.phone,
            mobilePhone: client.mobilePhone,
            workplace: client.workplace,
            workAddress: client.workAddress,
            salaryAmount: client.salaryAmount,
            salaryFrequency: client.salaryFrequency,
            place: client.receptionPlace,
            declarationDate: client.receptionDate,
            declaresLimitedResources: true,
            signedDocumentId: signatureDocumentId,
          }));
        }
        return client;
      })(), {
        loading: { title: "Registrando usuario…", message: "Se está preparando la ficha de recepción." },
        success: (client) => ({ title: "Usuario registrado", message: `${client.fullName} fue agregado correctamente.` }),
        error: { title: "No se pudo registrar el usuario" },
      });
      setNewOpen(false);
      await reload();
      navigate(`/personas/clientes/${created.id}`);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo registrar el usuario.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectedProcess = processTypes.data?.find(
    (item) => item.name === form.assistanceRequested,
  );
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
          {busy ? "Registrando expediente inicial…" : "Registrar usuario"}
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Personas atendidas"
        title="Usuarios"
        description="Registro, papelería y procesos de las personas que reciben asistencia jurídica."
        actions={
          <Button onClick={open}>
            <Plus size={18} />
            Registrar usuario
          </Button>
        }
      />
      <Card className="directory-card">
        <Field label="Estado de atención">
          <Select value={attention} onChange={event => { setAttention(event.target.value); setPage(1); }}>
            <option value="active">Atención no finalizada</option>
            <option value="inactive">Atención finalizada</option>
          </Select>
        </Field>
        <FilterBar
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Buscar por nombre, DPI o recepción…"
        />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          <>
            <div className="directory-table directory-table--clients">
              <div className="directory-table__head">
                <span>Usuario</span>
                <span>Recepción</span>
                <span>Asistencia solicitada</span>
                <span>Contacto</span>
                <span>Estado</span>
              </div>
              {data?.items.map((client) => (
                <Link
                  to={`/personas/clientes/${client.id}`}
                  className="directory-row"
                  key={client.id}
                >
                  <span className="entity-cell">
                    <span className="entity-icon">
                      <UserRound size={19} />
                    </span>
                    <span>
                      <strong>{client.fullName}</strong>
                      <small>DPI {client.dpi ? (/^\d{13}$/.test(client.dpi.replace(/\s/g, "")) ? formatCui(client.dpi) : client.dpi) : "sin registrar"}</small>
                    </span>
                  </span>
                  <span>
                    <strong>{client.receptionNumber}</strong>
                    <small>{formatDate(client.receptionDate)}</small>
                  </span>
                  <span className="truncate">{client.assistanceRequested}</span>
                  <span>
                    <strong>
                      {(() => { const phone = client.mobilePhone || client.phone; return phone ? (isCompleteGuatemalaPhone(phone) ? formatGuatemalaPhone(phone) : phone) : "Sin teléfono"; })()}
                    </strong>
                    <small>{client.occupation}</small>
                  </span>
                  <Badge tone={clientAttention(client).tone}>
                    {clientAttention(client).label}
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
        title="Registrar usuario"
        description="Complete la ficha de recepción y adjunte los documentos disponibles."
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
            title="Identidad del usuario"
            description="Complete los datos de identificación."
          >
            <Field label="Nombre completo">
              <input
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field label="DPI">
              <input
                inputMode="numeric"
                value={form.dpi}
                maxLength={15}
                onChange={(event) => update("dpi", formatCui(event.target.value))}
                placeholder="0000 00000 0000"
              />
            </Field>
            <AppDatePicker
              label="Fecha de nacimiento"
              preset="birthDate"
              value={form.birthDate}
              onChange={(value) => update("birthDate", value)}
              max={form.receptionDate}
              hint="La edad se calcula con la fecha de recepción."
            />
            <ReadOnlyValue
              label="Edad en la recepción"
              value={
                ageAtReception === null
                  ? "Se calculará al indicar la fecha"
                  : `${ageAtReception} años`
              }
            />
            <Field label="Lugar de nacimiento">
              <input
                value={form.birthPlace}
                onChange={(event) => update("birthPlace", event.target.value)}
              />
            </Field>
            <Field label="Nacionalidad">
              <input
                value={form.nationality}
                onChange={(event) => update("nationality", event.target.value)}
              />
            </Field>
            <Field label="Sexo">
              <Select
                value={form.sex}
                onChange={(event) => update("sex", event.target.value)}
              >
                <option value="">Seleccionar</option>
                <option>Femenino</option>
                <option>Masculino</option>
                <option>Otro</option>
                <option>Prefiere no indicar</option>
              </Select>
            </Field>
            <Field label="Estado civil">
              <Select
                value={form.maritalStatus}
                onChange={(event) =>
                  update("maritalStatus", event.target.value)
                }
              >
                <option value="">Seleccionar</option>
                <option>Soltero(a)</option>
                <option>Casado(a)</option>
                <option>Unido(a)</option>
                <option>Divorciado(a)</option>
                <option>Viudo(a)</option>
              </Select>
            </Field>
            <Field label="Escolaridad">
              <Select
                value={form.education}
                onChange={(event) => update("education", event.target.value)}
              >
                <option value="">Seleccionar</option>
                <option>Sin escolaridad</option>
                <option>Primaria</option>
                <option>Básicos</option>
                <option>Diversificado</option>
                <option>Universitaria</option>
              </Select>
            </Field>
          </WizardStep>
        )}
        {step === 1 && (
          <WizardStep
            title="Contacto, ocupación e ingresos"
            description="Complete los datos de residencia, trabajo e ingresos."
          >
            <Field label="Dirección de residencia" wide>
              <textarea
                value={form.residenceAddress}
                onChange={(event) =>
                  update("residenceAddress", event.target.value)
                }
              />
            </Field>
            <Field label="Teléfono">
              <input
                type="tel"
                inputMode="tel"
                placeholder="0000 0000"
                value={form.phone}
                onChange={(event) => update("phone", formatGuatemalaPhone(event.target.value))}
              />
            </Field>
            <Field label="Celular">
              <input
                type="tel"
                inputMode="tel"
                placeholder="0000 0000"
                value={form.mobilePhone}
                onChange={(event) => update("mobilePhone", formatGuatemalaPhone(event.target.value))}
              />
            </Field>
            <Field label="Profesión u oficio">
              <input
                value={form.occupation}
                onChange={(event) => update("occupation", event.target.value)}
              />
            </Field>
            <Field label="Empresa o lugar de trabajo">
              <input
                value={form.workplace}
                onChange={(event) => update("workplace", event.target.value)}
              />
            </Field>
            <Field label="Dirección de trabajo">
              <input
                value={form.workAddress}
                onChange={(event) => update("workAddress", event.target.value)}
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
            <Field label="Ingresos declarados">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salaryAmount}
                onChange={(event) => update("salaryAmount", event.target.value)}
                placeholder="Q 0.00"
              />
            </Field>
            <Field label="Frecuencia del ingreso">
              <Select
                value={form.salaryFrequency}
                onChange={(event) =>
                  update("salaryFrequency", event.target.value)
                }
              >
                <option>Mensual</option>
                <option>Quincenal</option>
                <option>Semanal</option>
                <option>Diario</option>
              </Select>
            </Field>
            <Field label="Cantidad de hijos">
              <input
                type="number"
                min="0"
                value={form.childrenCount}
                onChange={(event) =>
                  update("childrenCount", event.target.value)
                }
              />
            </Field>
          </WizardStep>
        )}
        {step === 2 && (
          <WizardStep
            title="Atención y recepción"
            description="Seleccione la asistencia solicitada y complete los datos de la contraparte, si corresponde."
          >
            <Field label="Asistencia solicitada" wide>
              <Select
                value={form.assistanceRequested}
                onChange={(event) =>
                  update("assistanceRequested", event.target.value)
                }
              >
                <option value="">Seleccionar tipo de proceso</option>
                {processTypes.data
                  ?.filter((item) => item.isActive)
                  .map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </Field>
            {selectedProcess?.description && (
              <p className="wizard-inline-note">
                {selectedProcess.description}
              </p>
            )}
            <Field label="Persona de quien reclama un derecho">
              <input
                value={form.claimedAgainstPersonName}
                onChange={(event) =>
                  update("claimedAgainstPersonName", event.target.value)
                }
                placeholder="Opcional si aún no se conoce"
              />
            </Field>
            <Field label="Dirección de esa persona">
              <input
                value={form.claimedAgainstPersonAddress}
                onChange={(event) =>
                  update("claimedAgainstPersonAddress", event.target.value)
                }
              />
            </Field>
            <Field label="Lugar de recepción">
              <input
                value={form.receptionPlace}
                onChange={(event) =>
                  update("receptionPlace", event.target.value)
                }
              />
            </Field>
            <AppDatePicker
              label="Fecha de recepción"
              preset="processDate"
              value={form.receptionDate}
              onChange={(value) => update("receptionDate", value)}
              required
            />
            <label className="choice-card field--wide">
              <input
                type="checkbox"
                checked={form.createIncomeDeclaration}
                onChange={(event) =>
                  update("createIncomeDeclaration", event.target.checked)
                }
              />
              <span>
                <strong>Crear declaración jurada de ingresos</strong>
                <small>Utiliza los datos socioeconómicos de esta ficha.</small>
              </span>
            </label>
          </WizardStep>
        )}
        {step === 3 && (
          <WizardStep
            title="Documentos iniciales"
            description="Adjunte los archivos disponibles."
          >
            <FilePicker
              label="Copia del DPI"
              hint="PDF, JPG, PNG o WEBP"
              file={files.dpi}
              onChange={(file) =>
                setFiles((current) => ({ ...current, dpi: file }))
              }
            />
            <FilePicker
              label="Firma o impresión digital"
              hint="Evidencia digitalizada de la ficha o declaración"
              file={files.signature}
              onChange={(file) =>
                setFiles((current) => ({ ...current, signature: file }))
              }
            />
            <p className="wizard-inline-note">
              <FolderInput size={16} /> Los demás documentos se agregan desde la
              pestaña Papelería.
            </p>
          </WizardStep>
        )}
        {step === 4 && (
          <WizardStep
            title="Confirmar registro"
            description="Revise la información antes de registrar al usuario."
          >
            <div className="wizard-review field--wide">
              <section className="wizard-review__group">
                <h4>
                  <IdCard size={15} /> Identidad
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue label="Usuario" value={form.fullName} />
                  <ReadOnlyValue label="DPI" value={form.dpi} />
                  <ReadOnlyValue
                    label="Nacimiento"
                    value={
                      form.birthDate
                        ? formatDate(form.birthDate)
                        : "No registrado"
                    }
                  />
                  <ReadOnlyValue
                    label="Residencia"
                    value={form.residenceAddress}
                  />
                </div>
              </section>
              <section className="wizard-review__group">
                <h4>
                  <BriefcaseBusiness size={15} /> Recepción
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue
                    label="Asistencia"
                    value={form.assistanceRequested}
                  />
                  <ReadOnlyValue
                    label="Fecha"
                    value={formatDate(form.receptionDate)}
                  />
                  <ReadOnlyValue
                    label="Ingresos"
                    value={
                      form.salaryAmount
                        ? `Q ${Number(form.salaryAmount).toLocaleString("es-GT")} ${form.salaryFrequency.toLowerCase()}`
                        : "No registrados"
                    }
                  />
                  <ReadOnlyValue
                    label="Declaración"
                    value={
                      form.createIncomeDeclaration
                        ? "Se creará con esta ficha"
                        : "No se creará"
                    }
                  />
                </div>
              </section>
              <section className="wizard-review__group">
                <h4>
                  <ClipboardCheck size={15} /> Papelería
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue
                    label="DPI adjunto"
                    value={files.dpi?.name ?? "Pendiente"}
                  />
                  <ReadOnlyValue
                    label="Firma o impresión"
                    value={files.signature?.name ?? "Pendiente"}
                  />
                </div>
              </section>
            </div>
          </WizardStep>
        )}
      </Modal>
    </>
  );
}
