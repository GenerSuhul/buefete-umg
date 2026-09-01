import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  FileSignature,
  FilePlus2,
  FileText,
  FolderKanban,
  MapPin,
  Phone,
  Plus,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DetailTabs, InfoItem, Pagination } from "../components/domain/Shared";
import {
  Badge,
  Button,
  Card,
  DocumentLink,
  AppDatePicker,
  ErrorState,
  Field,
  FilePicker,
  LoadingState,
  Modal,
  PageHeader,
  ReadOnlyValue,
  SectionHeading,
  Select,
  WizardProgress,
  WizardStep,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAuth } from "../context/AuthContext";
import { useConfirm, useNotify } from "../components/ui/Feedback";
import { feedbackHandled } from "../components/ui/feedback/operationFeedback";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  formatDate,
  formatDateTime,
  statusTone,
  translate,
} from "../utils/format";
import { toLocalDateOnly } from "../utils/date";
import {
  formatCui,
  formatGuatemalaPhone,
  isCompleteCui,
  isCompleteGuatemalaPhone,
} from "../utils/inputMasks";

const clientEditSteps = [
  { id: "identity", label: "Identidad", description: "Datos personales" },
  { id: "contact", label: "Contacto y trabajo", description: "Ubicación e ingresos" },
  { id: "reception", label: "Recepción", description: "Atención solicitada" },
  { id: "review", label: "Confirmar", description: "Revisión final" },
];

const emptyClientEdit = {
  fullName: "", birthDate: "", birthPlace: "", nationality: "", sex: "",
  maritalStatus: "", dpi: "", residenceAddress: "", education: "",
  occupation: "", workplace: "", workAddress: "", workPhone: "", phone: "",
  mobilePhone: "", salaryAmount: "", salaryFrequency: "Mensual",
  childrenCount: "0", assistanceRequested: "", claimedAgainstPersonName: "",
  claimedAgainstPersonAddress: "", receptionPlace: "", receptionDate: "",
};

function ageAtDate(birthDate: string, referenceDate: string) {
  if (!birthDate || !referenceDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const reference = new Date(`${referenceDate}T12:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime()) || birth > reference) return null;
  let age = reference.getFullYear() - birth.getFullYear();
  if (reference.getMonth() < birth.getMonth() || (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function ClientDetailPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const notify = useNotify();
  const canWrite = Boolean(user?.permissions.includes("*") || user?.permissions.includes("clients.write"));
  const canDelete = Boolean(user?.permissions.includes("*") || user?.permissions.includes("records.delete"));
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("general");
  const [documentPage, setDocumentPage] = useState(1);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editForm, setEditForm] = useState(emptyClientEdit);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [incomeForm, setIncomeForm] = useState({
    fullName: "",
    declaredAge: "",
    maritalStatus: "",
    sex: "",
    dpi: "",
    occupation: "",
    nationality: "Guatemalteca",
    residenceAddress: "",
    phone: "",
    mobilePhone: "",
    workplace: "",
    workAddress: "",
    salaryAmount: "",
    salaryFrequency: "Mensual",
    place: "Guatemala",
    declarationDate: toLocalDateOnly(),
    declaresLimitedResources: true,
  });
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.getClient(id),
    [id],
  );
  const documents = useAsyncData(
    () =>
      dataSource.listDocuments({
        contextType: "Client",
        contextId: id,
        page: documentPage,
        pageSize: 20,
      }),
    [id, documentPage],
  );
  const processTypes = useAsyncData(() => dataSource.listProcessTypes(), []);
  if (loading) return <LoadingState label="Abriendo expediente del cliente" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Cliente no encontrado")}
        retry={reload}
      />
    );
  const client = data.client;
  const editAge = ageAtDate(editForm.birthDate, editForm.receptionDate);
  const updateEdit = <K extends keyof typeof emptyClientEdit>(key: K, value: (typeof emptyClientEdit)[K]) =>
    setEditForm((current) => ({ ...current, [key]: value }));
  const openEdit = () => {
    setEditForm({
      fullName: client.fullName,
      birthDate: client.birthDate ?? "",
      birthPlace: client.birthPlace ?? "",
      nationality: client.nationality ?? "",
      sex: client.sex ?? "",
      maritalStatus: client.maritalStatus ?? "",
      dpi: formatCui(client.dpi ?? ""),
      residenceAddress: client.residenceAddress,
      education: client.education ?? "",
      occupation: client.occupation ?? "",
      workplace: client.workplace ?? "",
      workAddress: client.workAddress ?? "",
      workPhone: formatGuatemalaPhone(client.workPhone ?? ""),
      phone: formatGuatemalaPhone(client.phone ?? ""),
      mobilePhone: formatGuatemalaPhone(client.mobilePhone ?? ""),
      salaryAmount: client.salaryAmount?.toString() ?? "",
      salaryFrequency: client.salaryFrequency ?? "Mensual",
      childrenCount: client.childrenCount.toString(),
      assistanceRequested: client.assistanceRequested,
      claimedAgainstPersonName: client.claimedAgainstPersonName ?? "",
      claimedAgainstPersonAddress: client.claimedAgainstPersonAddress ?? "",
      receptionPlace: client.receptionPlace,
      receptionDate: client.receptionDate,
    });
    setEditStep(0);
    setFormError("");
    setEditOpen(true);
  };
  const validateEditStep = (target = editStep) => {
    if (target === 0 && (!editForm.fullName.trim() || !editForm.dpi.trim())) return "Nombre completo y DPI son obligatorios.";
    if (target === 0 && !isCompleteCui(editForm.dpi)) return "El DPI debe contener los 13 dígitos del CUI.";
    if (target === 0 && editForm.birthDate && editAge === null) return "La fecha de nacimiento no puede ser posterior a la recepción.";
    if (target === 1 && !editForm.residenceAddress.trim()) return "La dirección de residencia es obligatoria.";
    if (target === 1 && Number(editForm.childrenCount) < 0) return "La cantidad de hijos no puede ser negativa.";
    if (target === 1 && [editForm.phone, editForm.mobilePhone, editForm.workPhone].some((value) => !isCompleteGuatemalaPhone(value))) return "Los teléfonos deben contener 8 dígitos o el prefijo +502 seguido de 8 dígitos.";
    if (target === 2 && (!editForm.assistanceRequested || !editForm.receptionPlace.trim() || !editForm.receptionDate)) return "Asistencia, lugar y fecha de recepción son obligatorios.";
    return null;
  };
  const nextEdit = () => {
    const message = validateEditStep();
    if (message) return setFormError(message);
    setFormError("");
    setEditStep((current) => Math.min(current + 1, clientEditSteps.length - 1));
  };
  const saveClient = async () => {
    for (let target = 0; target <= 2; target += 1) {
      const message = validateEditStep(target);
      if (message) { setEditStep(target); setFormError(message); return; }
    }
    setBusy(true);
    setFormError("");
    try {
      await dataSource.updateClient(id, {
        fullName: editForm.fullName.trim(), birthDate: editForm.birthDate || null,
        ageAtReception: editAge, birthPlace: editForm.birthPlace.trim() || null,
        nationality: editForm.nationality.trim() || null, sex: editForm.sex || null,
        maritalStatus: editForm.maritalStatus || null, dpi: editForm.dpi.trim(),
        residenceAddress: editForm.residenceAddress.trim(), education: editForm.education || null,
        occupation: editForm.occupation.trim() || null, workplace: editForm.workplace.trim() || null,
        workAddress: editForm.workAddress.trim() || null, workPhone: editForm.workPhone.trim() || null,
        phone: editForm.phone.trim() || null, mobilePhone: editForm.mobilePhone.trim() || null,
        salaryAmount: editForm.salaryAmount ? Number(editForm.salaryAmount) : null,
        salaryFrequency: editForm.salaryAmount ? editForm.salaryFrequency : null,
        childrenCount: Number(editForm.childrenCount || 0), assistanceRequested: editForm.assistanceRequested,
        claimedAgainstPersonName: editForm.claimedAgainstPersonName.trim() || null,
        claimedAgainstPersonAddress: editForm.claimedAgainstPersonAddress.trim() || null,
        receptionPlace: editForm.receptionPlace.trim(), receptionDate: editForm.receptionDate,
        signatureDocumentId: client.signatureDocumentId,
        concurrencyToken: client.concurrencyToken,
      });
      setEditOpen(false);
      await reload();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudieron guardar los datos del cliente.");
    } finally { setBusy(false); }
  };
  const openIncome = () => {
    setIncomeForm({
      fullName: client.fullName,
      declaredAge: client.ageAtReception?.toString() ?? "",
      maritalStatus: client.maritalStatus ?? "",
      sex: client.sex ?? "",
      dpi: formatCui(client.dpi ?? ""),
      occupation: client.occupation ?? "",
      nationality: client.nationality ?? "Guatemalteca",
      residenceAddress: client.residenceAddress,
      phone: formatGuatemalaPhone(client.phone ?? ""),
      mobilePhone: formatGuatemalaPhone(client.mobilePhone ?? ""),
      workplace: client.workplace ?? "",
      workAddress: client.workAddress ?? "",
      salaryAmount: client.salaryAmount?.toString() ?? "",
      salaryFrequency: client.salaryFrequency ?? "Mensual",
      place: client.receptionPlace,
      declarationDate: toLocalDateOnly(),
      declaresLimitedResources: true,
    });
    setSignedFile(null);
    setFormError("");
    setIncomeOpen(true);
  };
  const saveIncome = async () => {
    setBusy(true);
    setFormError("");
    try {
      await notify.track((async () => {
        let signedDocumentId: string | null = null;
        if (signedFile)
          signedDocumentId = (
            await dataSource.uploadDocument(feedbackHandled({
              file: signedFile,
              contextType: "Client",
              contextId: id,
              label: "Declaración jurada firmada",
            }))
          ).id;
        return dataSource.createIncomeDeclaration(id, feedbackHandled({
          ...incomeForm,
          declaredAge: incomeForm.declaredAge
            ? Number(incomeForm.declaredAge)
            : null,
          salaryAmount: incomeForm.salaryAmount
            ? Number(incomeForm.salaryAmount)
            : null,
          signedDocumentId,
        }));
      })(), {
        loading: { title: "Registrando declaración…", message: "Se está vinculando la información económica al cliente." },
        success: { title: "Declaración registrada", message: "La información económica quedó vinculada al cliente." },
        error: { title: "No se pudo registrar la declaración" },
      });
      setIncomeOpen(false);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo registrar la declaración.",
      );
    } finally {
      setBusy(false);
    }
  };
  const printIncome = async (declarationId: string) => {
    const blob = await dataSource.getIncomeDeclarationPrint(declarationId);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const openDocuments = () =>
    navigate(`/documentos?contextType=Client&contextId=${id}&mode=acquire`);
  const deleteClient = async () => {
    const accepted = await confirm({ title: "Eliminar cliente", message: `${client.fullName} y sus expedientes dejarán de aparecer en la operación diaria.`, confirmLabel: "Enviar a Eliminados", tone: "danger" });
    if (!accepted) return;
    setBusy(true);
    try {
      await dataSource.deleteClient(id, "Eliminado desde la ficha del cliente");
      navigate("/personas/clientes", { replace: true });
    } finally { setBusy(false); }
  };
  return (
    <>
      <Link className="back-link" to="/personas/clientes">
        <ArrowLeft size={16} />
        Volver a clientes
      </Link>
      <PageHeader
        eyebrow={client.receptionNumber}
        title={client.fullName}
        description={`${client.assistanceRequested} · Recepción ${formatDate(client.receptionDate)}`}
        actions={
          <>
            {canWrite ? <Button variant="secondary" disabled={busy} onClick={openEdit}><Pencil size={17} />Editar datos</Button> : null}
            {canDelete ? <Button variant="danger" disabled={busy} onClick={deleteClient}><Trash2 size={17} />Eliminar</Button> : null}
            <Button onClick={() => navigate(`/expedientes?clientId=${id}`)}><FolderKanban size={17} />Abrir proceso</Button>
          </>
        }
      />
      <div className="profile-layout">
        <Card className="profile-summary">
          <div className="profile-summary__avatar">
            {client.fullName
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </div>
          <h2>{client.fullName}</h2>
          <p>{client.occupation ?? "Ocupación no registrada"}</p>
          <Badge tone={client.isActive ? "success" : "neutral"}>
            {client.isActive ? "Cliente activo" : "Inactivo"}
          </Badge>
          <div className="profile-contact">
            <span>
              <Phone size={15} />
              {client.mobilePhone ?? "Sin teléfono"}
            </span>
            <span>
              <MapPin size={15} />
              {client.residenceAddress}
            </span>
            <span>
              <BriefcaseBusiness size={15} />
              {client.workplace ?? "Sin lugar de trabajo"}
            </span>
          </div>
          <div className="profile-summary__meta">
            <div>
              <strong>{data.cases.length}</strong>
              <span>procesos</span>
            </div>
            <div>
              <strong>{documents.data?.totalCount ?? 0}</strong>
              <span>documentos</span>
            </div>
          </div>
        </Card>
        <div className="profile-main">
          <DetailTabs
            tabs={[
              { id: "general", label: "Información" },
              {
                id: "documents",
                label: "Papelería",
                count: documents.data?.totalCount,
              },
              { id: "cases", label: "Procesos", count: data.cases.length },
              {
                id: "income",
                label: "Ingresos",
                count: data.incomeDeclarations.length,
              },
            ]}
            active={tab}
            onChange={setTab}
          />
          {tab === "general" && (
            <Card>
              <SectionHeading
                title="Ficha de recepción"
                description="Datos de la atención inicial"
              />
              <div className="info-grid">
                <InfoItem label="DPI" value={client.dpi} />
                <InfoItem
                  label="Edad al recibir"
                  value={client.ageAtReception}
                />
                <InfoItem
                  label="Fecha de nacimiento"
                  value={formatDate(client.birthDate)}
                />
                <InfoItem
                  label="Lugar de nacimiento"
                  value={client.birthPlace}
                />
                <InfoItem label="Nacionalidad" value={client.nationality} />
                <InfoItem label="Sexo" value={client.sex} />
                <InfoItem label="Estado civil" value={client.maritalStatus} />
                <InfoItem label="Escolaridad" value={client.education} />
                <InfoItem
                  label="Profesión u oficio"
                  value={client.occupation}
                />
                <InfoItem
                  label="Cantidad de hijos"
                  value={client.childrenCount}
                />
                <InfoItem
                  label="Ingresos declarados"
                  value={
                    client.salaryAmount
                      ? `Q ${client.salaryAmount.toLocaleString("es-GT")} ${client.salaryFrequency?.toLowerCase()}`
                      : null
                  }
                />
                <InfoItem
                  label="Lugar de recepción"
                  value={client.receptionPlace}
                />
                <InfoItem label="Lugar de trabajo" value={client.workplace} />
                <InfoItem
                  label="Dirección de trabajo"
                  value={client.workAddress}
                />
                <InfoItem
                  label="Teléfono de trabajo"
                  value={client.workPhone}
                />
                <InfoItem
                  label="Fecha de recepción"
                  value={formatDate(client.receptionDate)}
                />
                <InfoItem
                  label="Persona contra quien reclama"
                  value={client.claimedAgainstPersonName}
                />
                <InfoItem
                  label="Dirección de la persona reclamada"
                  value={client.claimedAgainstPersonAddress}
                />
              </div>
              <div className="note-panel">
                <strong>Asistencia solicitada</strong>
                <p>{client.assistanceRequested}</p>
              </div>
            </Card>
          )}
          {tab === "documents" && (
            <Card>
              <SectionHeading
                title="Papelería del cliente"
                description="Archivos y versiones"
                action={
                  <Button size="sm" onClick={openDocuments}>
                    <FilePlus2 size={15} />
                    Adjuntar documento
                  </Button>
                }
              />
              {documents.loading ? (
                <LoadingState />
              ) : documents.error ? (
                <ErrorState error={documents.error} retry={documents.reload} />
              ) : documents.data?.items.length ? (
                <><div className="requirement-cards">
                  {documents.data.items.map((document) => (
                    <div className="requirement-card" key={document.id}>
                      <span className="requirement-card__icon">
                        <FileText size={19} />
                      </span>
                      <span>
                        <strong>{document.label}</strong>
                        <small>
                          {document.originalFileName} · v
                          {document.versionNumber} ·{" "}
                          {formatDateTime(document.createdAtUtc)}
                        </small>
                      </span>
                      <Badge
                        tone={
                          document.source === "Scanner" ? "blue" : "neutral"
                        }
                      >
                        {translate(document.source)}
                      </Badge>
                      <DocumentLink documentId={document.id} label="Ver" />
                    </div>
                  ))}
                </div><Pagination page={documents.data.page} totalPages={documents.data.totalPages} totalCount={documents.data.totalCount} onPageChange={setDocumentPage} /></>
              ) : (
                <p className="muted-copy">
                  No hay documentos. Use Subir o Escanear para crear la primera
                  casilla.
                </p>
              )}
            </Card>
          )}
          {tab === "cases" && (
            <Card>
              <SectionHeading
                title="Procesos asociados"
                description="Estado y último paso de cada expediente"
              />
              {data.cases.length ? (
                <div className="related-list">
                  {data.cases.map((legalCase) => (
                    <Link
                      to={`/expedientes/${legalCase.id}`}
                      key={legalCase.id}
                    >
                      <span className="related-list__icon">
                        <FolderKanban size={19} />
                      </span>
                      <span>
                        <strong>
                          {legalCase.caseNumber} · {legalCase.processType}
                        </strong>
                        <small>
                          {legalCase.stage} · Último paso:{" "}
                          {legalCase.lastStep ?? "sin registro"}
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
                  Este cliente todavía no tiene procesos abiertos.
                </p>
              )}
            </Card>
          )}
          {tab === "income" && (
            <Card>
              <SectionHeading
                title="Declaraciones juradas de ingresos"
                description="Formatos y formularios firmados"
                action={
                  <Button size="sm" onClick={openIncome}>
                    <Plus size={15} />
                    Nueva declaración
                  </Button>
                }
              />
              {data.incomeDeclarations.length ? (
                data.incomeDeclarations.map((declaration) => (
                  <div className="declaration-card" key={declaration.id}>
                    <span className="declaration-card__icon">
                      <FileSignature size={21} />
                    </span>
                    <span>
                      <strong>
                        Declaración del{" "}
                        {formatDate(declaration.declarationDate)}
                      </strong>
                      <small>
                        {declaration.declaresLimitedResources
                          ? "Declara recursos limitados"
                          : "Sin declaración de recursos limitados"}{" "}
                        · Q{" "}
                        {declaration.salaryAmount?.toLocaleString("es-GT") ??
                          "0"}
                      </small>
                    </span>
                    <Badge
                      tone={
                        declaration.signedDocumentId ? "success" : "warning"
                      }
                    >
                      {declaration.signedDocumentId
                        ? "Firmada"
                        : "Firma pendiente"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Abrir formato imprimible"
                      onClick={() => printIncome(declaration.id)}
                    >
                      <Printer size={16} />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="muted-copy">Sin declaraciones registradas.</p>
              )}
            </Card>
          )}
        </div>
      </div>
      <Modal
        size="xl"
        open={editOpen}
        onClose={() => !busy && setEditOpen(false)}
        title="Editar ficha del cliente"
        description="Actualice la información de recepción por secciones."
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setEditOpen(false)}>Cancelar</Button>
            {editStep > 0 ? <Button variant="ghost" disabled={busy} onClick={() => { setFormError(""); setEditStep((current) => current - 1); }}><ArrowLeft size={16} />Atrás</Button> : null}
            {editStep < clientEditSteps.length - 1
              ? <Button disabled={busy} onClick={nextEdit}>Continuar<ArrowRight size={16} /></Button>
              : <Button disabled={busy} onClick={saveClient}>{busy ? "Guardando…" : "Guardar cambios"}</Button>}
          </>
        }
      >
        <WizardProgress steps={clientEditSteps} currentStep={editStep} allowDirectNavigation onStepChange={(target) => { setFormError(""); setEditStep(target); }} />
        {formError ? <div className="form-error" role="alert">{formError}</div> : null}
        {editStep === 0 ? (
          <WizardStep title="Identidad del cliente" description="Datos de identificación y estado personal.">
            <Field label="Nombre completo"><input value={editForm.fullName} onChange={(event) => updateEdit("fullName", event.target.value)} autoComplete="name" /></Field>
            <Field label="DPI"><input value={editForm.dpi} onChange={(event) => updateEdit("dpi", formatCui(event.target.value))} inputMode="numeric" maxLength={15} placeholder="0000 00000 0000" /></Field>
            <AppDatePicker label="Fecha de nacimiento" value={editForm.birthDate} onChange={(value) => updateEdit("birthDate", value)} preset="birthDate" max={editForm.receptionDate} />
            <ReadOnlyValue label="Edad en la recepción" value={editAge === null ? "Se calcula con las fechas" : `${editAge} años`} />
            <Field label="Lugar de nacimiento"><input value={editForm.birthPlace} onChange={(event) => updateEdit("birthPlace", event.target.value)} /></Field>
            <Field label="Nacionalidad"><input value={editForm.nationality} onChange={(event) => updateEdit("nationality", event.target.value)} /></Field>
            <Field label="Sexo"><Select value={editForm.sex} onChange={(event) => updateEdit("sex", event.target.value)}><option value="">No registrado</option><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option><option value="Otro">Otro</option></Select></Field>
            <Field label="Estado civil"><Select value={editForm.maritalStatus} onChange={(event) => updateEdit("maritalStatus", event.target.value)}><option value="">No registrado</option><option value="Soltero(a)">Soltero(a)</option><option value="Casado(a)">Casado(a)</option><option value="Unido(a)">Unido(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viudo(a)">Viudo(a)</option></Select></Field>
            <Field label="Escolaridad"><input value={editForm.education} onChange={(event) => updateEdit("education", event.target.value)} /></Field>
          </WizardStep>
        ) : null}
        {editStep === 1 ? (
          <WizardStep title="Contacto, trabajo e ingresos" description="Datos para localizar a la persona y completar el estudio socioeconómico.">
            <Field label="Dirección de residencia" wide><textarea value={editForm.residenceAddress} onChange={(event) => updateEdit("residenceAddress", event.target.value)} /></Field>
            <Field label="Teléfono"><input type="tel" inputMode="tel" placeholder="0000 0000" value={editForm.phone} onChange={(event) => updateEdit("phone", formatGuatemalaPhone(event.target.value))} /></Field>
            <Field label="Celular"><input type="tel" inputMode="tel" placeholder="0000 0000" value={editForm.mobilePhone} onChange={(event) => updateEdit("mobilePhone", formatGuatemalaPhone(event.target.value))} /></Field>
            <Field label="Profesión u oficio"><input value={editForm.occupation} onChange={(event) => updateEdit("occupation", event.target.value)} /></Field>
            <Field label="Lugar de trabajo"><input value={editForm.workplace} onChange={(event) => updateEdit("workplace", event.target.value)} /></Field>
            <Field label="Dirección de trabajo"><input value={editForm.workAddress} onChange={(event) => updateEdit("workAddress", event.target.value)} /></Field>
            <Field label="Teléfono de trabajo"><input type="tel" inputMode="tel" placeholder="0000 0000" value={editForm.workPhone} onChange={(event) => updateEdit("workPhone", formatGuatemalaPhone(event.target.value))} /></Field>
            <Field label="Ingresos declarados"><input type="number" min="0" step="0.01" value={editForm.salaryAmount} onChange={(event) => updateEdit("salaryAmount", event.target.value)} /></Field>
            <Field label="Frecuencia"><Select value={editForm.salaryFrequency} onChange={(event) => updateEdit("salaryFrequency", event.target.value)}><option value="Mensual">Mensual</option><option value="Quincenal">Quincenal</option><option value="Semanal">Semanal</option><option value="Diaria">Diaria</option></Select></Field>
            <Field label="Cantidad de hijos"><input type="number" min="0" value={editForm.childrenCount} onChange={(event) => updateEdit("childrenCount", event.target.value)} /></Field>
          </WizardStep>
        ) : null}
        {editStep === 2 ? (
          <WizardStep title="Datos de recepción" description="Motivo de atención y datos de la persona reclamada.">
            <Field label="Asistencia solicitada" wide><Select value={editForm.assistanceRequested} onChange={(event) => updateEdit("assistanceRequested", event.target.value)}>{processTypes.data?.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select></Field>
            <Field label="Persona contra quien reclama"><input value={editForm.claimedAgainstPersonName} onChange={(event) => updateEdit("claimedAgainstPersonName", event.target.value)} /></Field>
            <Field label="Dirección de la persona reclamada"><textarea value={editForm.claimedAgainstPersonAddress} onChange={(event) => updateEdit("claimedAgainstPersonAddress", event.target.value)} /></Field>
            <Field label="Lugar de recepción"><input value={editForm.receptionPlace} onChange={(event) => updateEdit("receptionPlace", event.target.value)} /></Field>
            <AppDatePicker label="Fecha de recepción" value={editForm.receptionDate} onChange={(value) => updateEdit("receptionDate", value)} preset="processDate" required />
          </WizardStep>
        ) : null}
        {editStep === 3 ? (
          <WizardStep title="Confirmar cambios" description="Revise los datos principales antes de guardar.">
            <div className="wizard-review field--wide">
              <section className="wizard-review__group"><h3>Identidad</h3><div className="wizard-review__grid"><ReadOnlyValue label="Nombre" value={editForm.fullName} /><ReadOnlyValue label="DPI" value={editForm.dpi} /><ReadOnlyValue label="Nacimiento" value={editForm.birthDate || "No registrado"} /><ReadOnlyValue label="Estado civil" value={editForm.maritalStatus || "No registrado"} /></div></section>
              <section className="wizard-review__group"><h3>Recepción</h3><div className="wizard-review__grid"><ReadOnlyValue label="Asistencia" value={editForm.assistanceRequested} /><ReadOnlyValue label="Fecha" value={editForm.receptionDate} /><ReadOnlyValue label="Lugar" value={editForm.receptionPlace} /><ReadOnlyValue label="Contacto" value={editForm.mobilePhone || editForm.phone || "No registrado"} /></div></section>
            </div>
          </WizardStep>
        ) : null}
      </Modal>
      <Modal
        size="lg"
        open={incomeOpen}
        onClose={() => !busy && setIncomeOpen(false)}
        title="Registrar declaración jurada de ingresos"
        description="Complete los datos y adjunte la copia firmada, si está disponible."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setIncomeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !incomeForm.fullName ||
                !incomeForm.residenceAddress ||
                !incomeForm.place ||
                !incomeForm.declarationDate
              }
              onClick={saveIncome}
            >
              Guardar declaración
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nombre completo">
            <input
              value={incomeForm.fullName}
              onChange={(event) =>
                setIncomeForm({ ...incomeForm, fullName: event.target.value })
              }
            />
          </Field>
          <Field label="Edad">
            <input
              type="number"
              min="0"
              value={incomeForm.declaredAge}
              onChange={(event) =>
                setIncomeForm({
                  ...incomeForm,
                  declaredAge: event.target.value,
                })
              }
            />
          </Field>
          <Field label="DPI">
            <input
              value={incomeForm.dpi}
              onChange={(event) =>
                setIncomeForm({ ...incomeForm, dpi: formatCui(event.target.value) })
              }
              inputMode="numeric"
              maxLength={15}
              placeholder="0000 00000 0000"
            />
          </Field>
          <Field label="Estado civil">
            <input
              value={incomeForm.maritalStatus}
              onChange={(event) =>
                setIncomeForm({
                  ...incomeForm,
                  maritalStatus: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Ocupación">
            <input
              value={incomeForm.occupation}
              onChange={(event) =>
                setIncomeForm({ ...incomeForm, occupation: event.target.value })
              }
            />
          </Field>
          <Field label="Residencia">
            <textarea
              value={incomeForm.residenceAddress}
              onChange={(event) =>
                setIncomeForm({
                  ...incomeForm,
                  residenceAddress: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Salario">
            <input
              type="number"
              min="0"
              step="0.01"
              value={incomeForm.salaryAmount}
              onChange={(event) =>
                setIncomeForm({
                  ...incomeForm,
                  salaryAmount: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Frecuencia">
            <input
              value={incomeForm.salaryFrequency}
              onChange={(event) =>
                setIncomeForm({
                  ...incomeForm,
                  salaryFrequency: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Lugar">
            <input
              value={incomeForm.place}
              onChange={(event) =>
                setIncomeForm({ ...incomeForm, place: event.target.value })
              }
            />
          </Field>
          <AppDatePicker
            label="Fecha de declaración"
            preset="processDate"
            value={incomeForm.declarationDate}
            onChange={(declarationDate) =>
              setIncomeForm({ ...incomeForm, declarationDate })
            }
            required
          />
          <Field label="Recursos">
            <Select
              value={String(incomeForm.declaresLimitedResources)}
              onChange={(event) =>
                setIncomeForm({
                  ...incomeForm,
                  declaresLimitedResources: event.target.value === "true",
                })
              }
            >
              <option value="true">Declara recursos limitados</option>
              <option value="false">No declara recursos limitados</option>
            </Select>
          </Field>
          <FilePicker
            label="Documento firmado (opcional)"
            hint="PDF, JPG, PNG o WEBP"
            file={signedFile}
            onChange={setSignedFile}
          />
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
    </>
  );
}
