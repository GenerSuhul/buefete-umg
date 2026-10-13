import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Plus,
  UserRoundCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "../routing/navigation";
import { FilterBar, Pagination, RelationLookup } from "../components/domain/Shared";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  ReadOnlyValue,
  WizardProgress,
  WizardStep,
  Select,
} from "../components/ui";
import { dataSource } from "../data/dataSource";
import { useAuth } from "../context/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import type { CaseStatus } from "../types/domain";
import { formatDateTime, statusTone, translate } from "../utils/format";
import {
  formatCui,
  formatGuatemalaPhone,
  isCompleteCui,
  isCompleteGuatemalaPhone,
} from "../utils/inputMasks";

const emptyForm = {
  clientId: "",
  processTypeId: "",
  counterpartyName: "",
  counterpartyDpi: "",
  counterpartyResidence: "",
  counterpartyWorkAddress: "",
  counterpartyPhone: "",
  observations: "",
};
const steps = [
  {
    id: "context",
    label: "Usuario y proceso",
    description: "Contexto del expediente",
  },
  {
    id: "requirements",
    label: "Requisitos",
    description: "Checklist del catálogo",
  },
  {
    id: "counterparty",
    label: "Contraparte",
    description: "Datos cuando aplique",
  },
  { id: "review", label: "Confirmar", description: "Apertura y auditoría" },
];

export function CasesPage() {
  const { user } = useAuth();
  const canWrite = Boolean(
    user?.permissions.includes("*") ||
      user?.permissions.includes("cases.write"),
  );
  const canAssign = Boolean(user?.permissions.includes("*") || user?.permissions.includes("cases.assign"));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedClientId = searchParams.get("clientId") ?? "";
  const requestedStudentId = searchParams.get("assignStudentId") ?? "";
  const assigningStudent = Boolean(requestedStudentId && canAssign);
  const queryHandled = useRef(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [newOpen, setNewOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const loader = useMemo(
    () => () =>
      dataSource.listCases({
        search,
        status: status || undefined,
        page,
        pageSize: 20,
      }),
    [search, status, page],
  );
  const { data, error, loading, reload } = useAsyncData(loader, [
    search,
    status,
    page,
  ]);
  const options = useAsyncData(async () => {
    if (!canWrite) return { processTypes: [] };
    const processTypes = await dataSource.listProcessTypes();
    return {
      processTypes: processTypes.filter((item) => item.isActive),
    };
  }, []);
  const loadClients = useCallback(async (term: string) => {
    const result = await dataSource.listClients({ search: term, pageSize: 20 });
    return result.items.map((client) => ({ value: client.id, label: `${client.fullName} · DPI ${client.dpi ? formatCui(client.dpi) : 'pendiente'} · ${client.receptionNumber}` }));
  }, []);
  const selectedClient = useAsyncData(
    async () => (form.clientId ? dataSource.getClient(form.clientId) : null),
    [form.clientId],
  );

  useEffect(() => {
    if (!canWrite || !options.data || queryHandled.current) return;
    const clientId = requestedClientId;
    const processTypeId = options.data.processTypes[0]?.id || "";
    setForm((current) => ({ ...current, clientId, processTypeId }));
    if (requestedClientId) {
      setNewOpen(true);
      queryHandled.current = true;
    }
  }, [canWrite, options.data, requestedClientId]);

  useEffect(() => {
    const client = selectedClient.data?.client;
    if (!client || form.counterpartyName) return;
    setForm((current) => ({
      ...current,
      counterpartyName: client.claimedAgainstPersonName ?? "",
      counterpartyResidence: client.claimedAgainstPersonAddress ?? "",
    }));
  }, [selectedClient.data, form.counterpartyName]);

  const selectedProcess = options.data?.processTypes.find(
    (item) => item.id === form.processTypeId,
  );
  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const open = () => {
    setForm({
      ...emptyForm,
      clientId: "",
      processTypeId: options.data?.processTypes[0]?.id ?? "",
    });
    setStep(0);
    setFormError(null);
    setNewOpen(true);
  };
  const validateStep = (target = step) => {
    if (selectedClient.loading && form.clientId) return 'Verificando la ficha del usuario…';
    if (selectedClient.error) return 'No se pudo verificar la ficha. Seleccione nuevamente el usuario.';
    if (selectedClient.data?.restriction?.isRestricted) return 'Atención bloqueada: este DPI tiene un veto global permanente en todas las sedes.';
    if (selectedClient.data && (!selectedClient.data.client.dpi || selectedClient.data.restriction?.hasValidIdentity === false)) return 'Corrija el DPI en la ficha del usuario antes de abrir un expediente.';
    if (target === 0 && (!form.clientId || !form.processTypeId))
      return "Seleccione un usuario y un tipo de proceso.";
    if (
      target === 2 &&
      form.counterpartyResidence &&
      !form.counterpartyName.trim()
    )
      return "Indique el nombre de la contraparte o elimine sus datos adicionales.";
    if (target === 2 && form.counterpartyDpi && !isCompleteCui(form.counterpartyDpi))
      return "El DPI de la contraparte debe contener los 13 dígitos del CUI.";
    if (target === 2 && !isCompleteGuatemalaPhone(form.counterpartyPhone))
      return "El teléfono debe contener 8 dígitos o el prefijo +502 seguido de 8 dígitos.";
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

  const create = async () => {
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
      const detail = await dataSource.openCase({
        clientId: form.clientId,
        processTypeId: form.processTypeId,
        initialStage: null,
        counterparties: form.counterpartyName.trim()
          ? [
              {
                fullName: form.counterpartyName.trim(),
                dpi: form.counterpartyDpi.trim() || null,
                residenceAddress: form.counterpartyResidence.trim() || null,
                workAddress: form.counterpartyWorkAddress.trim() || null,
                phone: form.counterpartyPhone.trim() || null,
                notes: form.observations.trim() || null,
              },
            ]
          : [],
      });
      setNewOpen(false);
      await reload();
      navigate(`/expedientes/${detail.summary.id}${assigningStudent ? `?assignStudentId=${encodeURIComponent(requestedStudentId)}` : ''}`);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo abrir el expediente.",
      );
    } finally {
      setBusy(false);
    }
  };

  const lockedClient = Boolean(requestedClientId);
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
        <Button disabled={busy || Boolean(form.clientId && selectedClient.loading)} onClick={next}>
          {form.clientId && selectedClient.loading ? 'Verificando usuario…' : 'Continuar'}
          <ArrowRight size={16} />
        </Button>
      ) : (
        <Button disabled={busy || Boolean(form.clientId && selectedClient.loading)} onClick={create}>
          {busy ? "Creando expediente…" : "Abrir expediente"}
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Gestión procesal"
        title={canWrite ? "Expedientes" : "Mis casos asignados"}
        description={assigningStudent ? "Seleccione un expediente abierto para asignar al alumno." : "Estado actual, asignaciones y último paso de cada proceso judicial."}
        actions={
          canWrite ? (
            <Button onClick={open}>
              <Plus size={18} />
              Abrir expediente
            </Button>
          ) : undefined
        }
      />
      <Card className="directory-card">
        <FilterBar
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Buscar por expediente, usuario o proceso…"
        >
          <Select
            className="filter-select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CaseStatus | "");
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="Active">Activos</option>
            <option value="DocumentCollection">Recolección documental</option>
            <option value="Suspended">Suspendidos</option>
            <option value="Closed">Cerrados</option>
          </Select>
        </FilterBar>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          <>
            <div className="case-list">
              {data?.items.map((legalCase) => {
                const caseUnavailable = legalCase.status === "Closed" || legalCase.status === "Archived";
                const alreadyAssigned = legalCase.assignments.some((item) => item.studentId === requestedStudentId && item.status === "Active");
                const cannotAssignHere = assigningStudent && (caseUnavailable || alreadyAssigned);
                return <Link
                  to={`/expedientes/${legalCase.id}${assigningStudent && !cannotAssignHere ? `?assignStudentId=${encodeURIComponent(requestedStudentId)}` : ""}`}
                  className="case-list__item"
                  key={legalCase.id}
                  aria-disabled={cannotAssignHere}
                  onClick={(event) => { if (cannotAssignHere) event.preventDefault(); }}
                >
                  <span className="case-list__icon">
                    <FolderKanban size={21} />
                  </span>
                  <span className="case-list__identity">
                    <strong>{legalCase.caseNumber}</strong>
                    <small>{legalCase.clientName}</small>
                  </span>
                  <span className="case-list__process">
                    <strong>{legalCase.processTypeName}</strong>
                    <small>{translate(legalCase.stage)}</small>
                    {assigningStudent && caseUnavailable ? <small>No admite asignaciones</small> : null}
                    {assigningStudent && alreadyAssigned ? <small>Alumno ya asignado</small> : null}
                  </span>
                  <span className="case-list__student">
                    {legalCase.assignments[0] ? (
                      <>
                        <Avatar
                          name={legalCase.assignments[0].studentName}
                          documentId={
                            legalCase.assignments[0].studentPhotoDocumentId
                          }
                          size="sm"
                        />
                        <span>
                          <strong>
                            {legalCase.assignments[0].studentName}
                          </strong>
                          <small>
                            {legalCase.assignments[0].isPrimary
                              ? "Responsable principal"
                              : "Apoyo"}
                          </small>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="avatar avatar--sm">
                          <UserRoundCheck size={15} />
                        </span>
                        <span>
                          <strong>Sin asignar</strong>
                          <small>Requiere responsable</small>
                        </span>
                      </>
                    )}
                  </span>
                  <Badge tone={statusTone(legalCase.status)}>
                    {translate(legalCase.status)}
                  </Badge>
                  <span className="case-list__last">
                    <CalendarClock size={15} />
                    <span>
                      <strong>
                        {legalCase.lastStep?.title ?? "Sin movimientos"}
                      </strong>
                      <small>
                        {formatDateTime(legalCase.lastStep?.occurredAtUtc)}
                      </small>
                    </span>
                  </span>
                </Link>;
              })}
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
        title="Abrir expediente"
        description="Revise la información antes de crear el expediente."
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
            title="Usuario y tipo de proceso"
            description="Seleccione el usuario y el tipo de proceso."
          >
            {lockedClient ? (
              <ReadOnlyValue
                label="Usuario seleccionado"
                value={
                  selectedClient.data?.client.fullName ?? "Cargando usuario…"
                }
                hint={`DPI ${selectedClient.data?.client.dpi ?? 'pendiente'} · ${selectedClient.data?.client.receptionNumber ?? ''}`}
              />
            ) : (
              <RelationLookup label="Usuario" required value={form.clientId} onChange={(value) => update("clientId", value)} load={loadClients} emptyLabel="Seleccione un usuario" />
            )}
            <Field label="Tipo de proceso">
              <Select
                value={form.processTypeId}
                onChange={(event) =>
                  update("processTypeId", event.target.value)
                }
              >
                {options.data?.processTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!lockedClient && <div className="wizard-inline-note"><span>¿Es una persona nueva? <Link to="/personas/clientes">Registre primero al usuario</Link>. Desde su ficha podrá abrir el proceso sin volver a buscarlo.</span></div>}
            <ReadOnlyValue
              label="Estado inicial"
              value="Recolección documental"
              hint="Estado predeterminado"
            />
            <ReadOnlyValue
              label="Requisitos configurados"
              value={`${selectedProcess?.requirements.length ?? 0} elementos`}
              hint="Tipo de proceso seleccionado"
            />
            {selectedProcess?.description && (
              <p className="wizard-inline-note">
                {selectedProcess.description}
              </p>
            )}
          </WizardStep>
        )}
        {step === 1 && (
          <WizardStep
            title="Documentos y datos que necesitará"
            description="Revise el checklist del proceso. Al abrir el expediente podrá adjuntar o escanear cada documento, revisar los requisitos y asignar un alumno habilitado. Los documentos pendientes no se marcan como recibidos."
          >
            <div className="requirement-preview field--wide">
              {selectedProcess?.requirements.length ? (
                selectedProcess.requirements.map((requirement) => (
                  <article
                    key={requirement.id}
                    className="requirement-preview__item"
                  >
                    <span>
                      <FileText size={17} />
                    </span>
                    <div>
                      <strong>{requirement.label}</strong>
                      <small>
                        {requirement.kind === "Document"
                          ? translate(requirement.documentNature)
                          : "Dato o condición"}
                        {requirement.conditionDescription
                          ? ` · ${requirement.conditionDescription}`
                          : ""}
                      </small>
                    </div>
                    <Badge tone={requirement.isRequired ? "blue" : "neutral"}>
                      {requirement.isConditional
                        ? "Condicional"
                        : requirement.isRequired
                          ? "Obligatorio"
                          : "Opcional"}
                    </Badge>
                  </article>
                ))
              ) : (
                <p className="muted-copy">
                  No hay requisitos configurados para este tipo de proceso.
                </p>
              )}
            </div>
            <p className="wizard-inline-note">
              <ClipboardList size={16} /> Los documentos se completan después
              desde cada requisito.
            </p>
          </WizardStep>
        )}
        {step === 2 && (
          <WizardStep
            title="Datos de la contraparte"
            description="Complete únicamente los datos disponibles."
          >
            <Field label="Nombre completo">
              <input
                value={form.counterpartyName}
                onChange={(event) =>
                  update("counterpartyName", event.target.value)
                }
              />
            </Field>
            <Field label="DPI">
              <input
                value={form.counterpartyDpi}
                inputMode="numeric"
                maxLength={15}
                placeholder="0000 00000 0000"
                onChange={(event) =>
                  update("counterpartyDpi", formatCui(event.target.value))
                }
              />
            </Field>
            <Field label="Dirección de residencia" wide>
              <textarea
                value={form.counterpartyResidence}
                onChange={(event) =>
                  update("counterpartyResidence", event.target.value)
                }
              />
            </Field>
            <Field label="Dirección de trabajo">
              <input
                value={form.counterpartyWorkAddress}
                onChange={(event) =>
                  update("counterpartyWorkAddress", event.target.value)
                }
              />
            </Field>
            <Field label="Teléfono">
              <input
                type="tel"
                inputMode="tel"
                placeholder="0000 0000"
                value={form.counterpartyPhone}
                onChange={(event) =>
                  update("counterpartyPhone", formatGuatemalaPhone(event.target.value))
                }
              />
            </Field>
            <Field label="Observaciones" wide>
              <textarea
                value={form.observations}
                onChange={(event) => update("observations", event.target.value)}
              />
            </Field>
          </WizardStep>
        )}
        {step === 3 && (
          <WizardStep
            title="Confirmar apertura"
            description="Revise la información antes de crear el expediente."
          >
            <div className="wizard-review field--wide">
              <section className="wizard-review__group">
                <h4>
                  <FolderKanban size={15} /> Expediente
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue
                    label="Usuario"
                    value={selectedClient.data?.client.fullName}
                  />
                  <ReadOnlyValue
                    label="Proceso"
                    value={selectedProcess?.name}
                  />
                  <ReadOnlyValue label="Etapa" value="Recolección documental" />
                  <ReadOnlyValue
                    label="Checklist"
                    value={`${selectedProcess?.requirements.length ?? 0} requisitos`}
                  />
                </div>
              </section>
              <section className="wizard-review__group">
                <h4>
                  <UserRoundCheck size={15} /> Contraparte
                </h4>
                <div className="wizard-review__grid">
                  <ReadOnlyValue
                    label="Nombre"
                    value={form.counterpartyName || "No registrada"}
                  />
                  <ReadOnlyValue
                    label="Contacto"
                    value={form.counterpartyPhone || "No registrado"}
                  />
                </div>
              </section>
              <p className="wizard-inline-note">
                <CheckCircle2 size={16} /> Los requisitos permanecerán
                pendientes hasta su revisión.
              </p>
            </div>
          </WizardStep>
        )}
      </Modal>
    </>
  );
}
