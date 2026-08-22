import {
  ArrowLeft,
  BriefcaseBusiness,
  Download,
  FileSignature,
  FileText,
  FolderKanban,
  MapPin,
  Phone,
  Plus,
  Printer,
  ScanLine,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DetailTabs, InfoItem } from "../components/domain/Shared";
import {
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
import { useAsyncData } from "../hooks/useAsyncData";
import {
  formatDate,
  formatDateTime,
  statusTone,
  translate,
} from "../utils/format";

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("general");
  const [incomeOpen, setIncomeOpen] = useState(false);
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
    declarationDate: new Date().toISOString().slice(0, 10),
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
        pageSize: 100,
      }),
    [id],
  );
  const download = async (documentId: string, fileName: string) => {
    const access = await dataSource.getDocumentReadAccess(documentId);
    const url =
      access.url ??
      URL.createObjectURL(await dataSource.downloadDocument(documentId));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    if (!access.url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (loading) return <LoadingState label="Abriendo expediente del cliente" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Cliente no encontrado")}
        retry={reload}
      />
    );
  const client = data.client;
  const openIncome = () => {
    setIncomeForm({
      fullName: client.fullName,
      declaredAge: client.ageAtReception?.toString() ?? "",
      maritalStatus: client.maritalStatus ?? "",
      sex: client.sex ?? "",
      dpi: client.dpi ?? "",
      occupation: client.occupation ?? "",
      nationality: client.nationality ?? "Guatemalteca",
      residenceAddress: client.residenceAddress,
      phone: client.phone ?? "",
      mobilePhone: client.mobilePhone ?? "",
      workplace: client.workplace ?? "",
      workAddress: client.workAddress ?? "",
      salaryAmount: client.salaryAmount?.toString() ?? "",
      salaryFrequency: client.salaryFrequency ?? "Mensual",
      place: client.receptionPlace,
      declarationDate: new Date().toISOString().slice(0, 10),
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
      let signedDocumentId: string | null = null;
      if (signedFile)
        signedDocumentId = (
          await dataSource.uploadDocument({
            file: signedFile,
            contextType: "Client",
            contextId: id,
            label: "Declaración jurada firmada",
          })
        ).id;
      await dataSource.createIncomeDeclaration(id, {
        ...incomeForm,
        declaredAge: incomeForm.declaredAge
          ? Number(incomeForm.declaredAge)
          : null,
        salaryAmount: incomeForm.salaryAmount
          ? Number(incomeForm.salaryAmount)
          : null,
        signedDocumentId,
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
  const openDocuments = (mode: "upload" | "scan") =>
    navigate(`/documentos?contextType=Client&contextId=${id}&mode=${mode}`);
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
          <Button onClick={() => navigate(`/expedientes?clientId=${id}`)}>
            <FolderKanban size={17} />
            Abrir proceso
          </Button>
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
                  <div className="inline-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openDocuments("scan")}
                    >
                      <ScanLine size={15} />
                      Escanear
                    </Button>
                    <Button size="sm" onClick={() => openDocuments("upload")}>
                      <Upload size={15} />
                      Subir archivo
                    </Button>
                  </div>
                }
              />
              {documents.loading ? (
                <LoadingState />
              ) : documents.error ? (
                <ErrorState error={documents.error} retry={documents.reload} />
              ) : documents.data?.items.length ? (
                <div className="requirement-cards">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Descargar ${document.label}`}
                        onClick={() =>
                          download(document.id, document.originalFileName)
                        }
                      >
                        <Download size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
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
                setIncomeForm({ ...incomeForm, dpi: event.target.value })
              }
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
          <DatePickerField
            label="Fecha de declaración"
            value={incomeForm.declarationDate}
            onChange={(declarationDate) =>
              setIncomeForm({ ...incomeForm, declarationDate })
            }
            required
          />
          <Field label="Recursos">
            <select
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
            </select>
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
