import {
  ArchiveRestore,
  Ban,
  BookKey,
  FileClock,
  KeyRound,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Pagination } from "../components/domain/Shared";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DateRangePickerField,
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
import { useAsyncData } from "../hooks/useAsyncData";
import { useConfirm, useNotify } from "../components/ui/Feedback";
import { useAuth } from "../context/AuthContext";
import type {
  ProcessType,
  RequirementDefinition,
  UserSummary,
} from "../types/domain";
import { formatDate, formatDateTime } from "../utils/format";
import { toLocalDateOnly } from "../utils/date";
import { isValidPassword } from "../utils/passwordPolicy";

const emptyUserForm = {
  fullName: "",
  email: "",
  password: "",
  roleIds: [] as string[],
  participationStartDate: toLocalDateOnly(),
  participationEndDate: "",
  isActive: true,
};

export function UsersPage() {
  const confirm = useConfirm();
  const notify = useNotify();
  const { user: signedInUser } = useAuth();
  const [page, setPage] = useState(1);
  const [lifecycle, setLifecycle] = useState<"current" | "deleted">("current");
  const [personType, setPersonType] = useState<"staff" | "student">("staff");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [purgeTarget, setPurgeTarget] = useState<UserSummary | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [form, setForm] = useState(emptyUserForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.listUsers({ page, pageSize: 25, lifecycle, personType, search }),
    [page, lifecycle, personType, search],
  );
  const rolesState = useAsyncData(() => dataSource.listRoles(), []);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyUserForm, roleIds: [] });
    setPhoto(null);
    setFormError(null);
    setOpen(true);
  };

  const startEdit = (user: UserSummary) => {
    setEditing(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      roleIds:
        rolesState.data
          ?.filter((role) => user.roles.includes(role.name))
          .map((role) => role.id) ?? [],
      participationStartDate: user.participationStartDate ?? "",
      participationEndDate: user.participationEndDate ?? "",
      isActive: user.isActive,
    });
    setPhoto(null);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!editing && !isValidPassword(form.password)) {
      setFormError("La contraseña temporal debe tener entre 8 y 128 caracteres.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const common = {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        isActive: form.isActive,
        participationStartDate: form.participationStartDate || null,
        participationEndDate: form.participationEndDate || null,
        roleIds: form.roleIds,
      };
      const wasEditing = Boolean(editing);
      await notify.track((async () => {
        const result = editing
          ? await dataSource.updateUser(editing.id, common)
          : await dataSource.createUser({
              ...common,
              username: form.email.trim(),
              password: form.password,
              studentId: null,
            });
        if (photo) await dataSource.setUserPhoto(result.id, photo);
        await reload();
        return result;
      })(), {
        loading: { title: wasEditing ? "Guardando usuario…" : "Creando usuario…" },
        success: (result) => ({ title: wasEditing ? "Usuario actualizado" : "Usuario creado", message: wasEditing ? `Los datos de ${result.fullName} fueron actualizados.` : `${result.fullName} ya puede acceder al sistema.` }),
        error: { title: wasEditing ? "No se pudo actualizar el usuario" : "No se pudo crear el usuario" },
      });
      setOpen(false);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el usuario.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (user: UserSummary) => {
    if (!await confirm({ title: "Enviar cuenta a eliminados", message: `${user.fullName} perderá el acceso. La cuenta podrá restaurarse y el historial permanecerá disponible.`, confirmLabel: "Enviar a eliminados", tone: "danger" })) return;
    try {
      await notify.track(dataSource.deactivateUser(user.id), {
        loading: { title: "Moviendo cuenta…" },
        success: { title: "Cuenta en eliminados", message: `${user.fullName} ya no puede acceder.` },
        error: { title: "No se pudo eliminar la cuenta" },
      });
      reload();
    } catch { /* El sistema global conserva el error y el registro permanece visible. */ }
  };

  const changeAccess = async (user: UserSummary) => {
    const activate = !user.isActive;
    if (!activate && !await confirm({ title: "Suspender acceso", message: `${user.fullName} no podrá iniciar sesión hasta que se vuelva a habilitar.`, confirmLabel: "Suspender acceso", tone: "danger" })) return;
    try {
      await notify.track(dataSource.setUserAccess(user.id, activate), {
        loading: { title: activate ? "Habilitando acceso…" : "Suspendiendo acceso…" },
        success: { title: activate ? "Acceso habilitado" : "Acceso suspendido" },
        error: { title: "No se pudo cambiar el acceso" },
      });
      reload();
    } catch { /* El diálogo de error muestra la causa. */ }
  };

  const restore = async (user: UserSummary) => {
    try {
      await notify.track(dataSource.restoreUser(user.id), {
        loading: { title: "Restaurando cuenta…" },
        success: { title: "Cuenta restaurada", message: "El acceso permanece suspendido hasta habilitarlo expresamente." },
        error: { title: "No se pudo restaurar la cuenta" },
      });
      reload();
    } catch { /* El diálogo de error muestra la causa. */ }
  };

  const purge = async () => {
    if (!purgeTarget || purgeConfirmation !== purgeTarget.email) return;
    setBusy(true);
    try {
      await notify.track(dataSource.purgeUser(purgeTarget.id), {
        loading: { title: "Eliminando cuenta…" },
        success: { title: "Cuenta eliminada definitivamente" },
        error: { title: "No se pudo eliminar la cuenta" },
      });
      setPurgeTarget(null);
      setPurgeConfirmation("");
      reload();
    } catch { /* La cuenta continúa en eliminados. */ }
    finally { setBusy(false); }
  };

  const resetPassword = async (user: UserSummary) => {
    setPasswordUser(user);
    setNewPassword("");
  };

  const savePassword = async () => {
    if (!passwordUser || !isValidPassword(newPassword)) return;
    setBusy(true);
    try {
      await dataSource.resetUserPassword(passwordUser.id, newPassword);
      setPasswordUser(null);
    } catch { /* El toast contextual permite corregir sin cerrar el diálogo. */ }
    finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Identidad y acceso"
        title="Accesos y personal"
        description="Cuentas de personal, acceso de alumnos y bajas recuperables."
        actions={lifecycle === "current" && personType === "staff" ?
          <Button onClick={startCreate}>
            <Plus size={18} />
            Crear personal
          </Button>
        : undefined}
      />
      <Card>
        <SectionHeading
          title={lifecycle === "deleted" ? "Cuentas eliminadas" : personType === "staff" ? "Personal" : "Acceso de alumnos"}
          description={lifecycle === "deleted" ? "Restaure una cuenta o elimínela definitivamente." : personType === "student" ? "Los datos académicos se administran en Alumnos." : "Administre identidad, roles y vigencia del personal."}
        />
        <div className="user-directory-toolbar">
          <div className="user-directory-tabs" role="group" aria-label="Tipo de cuenta">
            <Button variant={personType === "staff" ? "primary" : "secondary"} aria-pressed={personType === "staff"} onClick={() => { setPersonType("staff"); setPage(1); }}>Personal</Button>
            <Button variant={personType === "student" ? "primary" : "secondary"} aria-pressed={personType === "student"} onClick={() => { setPersonType("student"); setPage(1); }}>Alumnos</Button>
          </div>
          <div className="user-directory-tabs" role="group" aria-label="Estado de la cuenta">
            <Button variant={lifecycle === "current" ? "primary" : "secondary"} aria-pressed={lifecycle === "current"} onClick={() => { setLifecycle("current"); setPage(1); }}>Cuentas actuales</Button>
            <Button variant={lifecycle === "deleted" ? "primary" : "secondary"} aria-pressed={lifecycle === "deleted"} onClick={() => { setLifecycle("deleted"); setPage(1); }}>Eliminados</Button>
          </div>
          <form className="user-directory-search" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); setPage(1); }}>
            <label className="sr-only" htmlFor="user-directory-search">Buscar por nombre o correo</label>
            <input id="user-directory-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Nombre o correo" />
            <Button variant="secondary" type="submit">Buscar</Button>
          </form>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          <>
            <div className="admin-list user-directory-list">
              {data?.items.map((user) => (
              <article key={user.id}>
                <Avatar
                  name={user.fullName}
                  documentId={user.photoDocumentId}
                  size="lg"
                />
                <div>
                  <strong>{user.fullName}</strong>
                  <small>
                    {user.email}
                  </small>
                </div>
                <span>
                  <strong>{user.roles.join(", ") || "Sin rol"}</strong>
                  <small>
                    {formatDate(user.participationStartDate)} –{" "}
                    {user.participationEndDate
                      ? formatDate(user.participationEndDate)
                      : "sin fecha de fin"}
                  </small>
                </span>
                <Badge tone={user.accessStatus === "Active" ? "success" : user.accessStatus === "Deleted" ? "danger" : "neutral"}>
                  {({ Active: "Activo", Suspended: "Suspendido", Scheduled: "Programado", Expired: "Vigencia finalizada", Locked: "Bloqueado", Deleted: "Eliminado" } as const)[user.accessStatus] ?? "Sin acceso"}
                </Badge>
                <div className="inline-actions">
                  {user.isDeleted ? <>
                    <Button variant="secondary" onClick={() => restore(user)}><ArchiveRestore size={16} /> Restaurar</Button>
                    <Button variant="ghost" onClick={() => { setPurgeTarget(user); setPurgeConfirmation(""); }}><Trash2 size={16} /> Eliminar definitivamente</Button>
                  </> : <>
                  {personType === "staff" &&
                  <Button
                    variant="ghost"
                    aria-label={`Editar ${user.fullName}`}
                    onClick={() => startEdit(user)}
                  >
                    <Pencil size={17} /> Editar
                  </Button>}
                  <Button
                    variant="ghost"
                    aria-label={`Restablecer contraseña de ${user.fullName}`}
                    onClick={() => resetPassword(user)}
                  >
                    <KeyRound size={17} /> Contraseña
                  </Button>
                  {user.id !== signedInUser?.id && <>
                    <Button variant="ghost" onClick={() => changeAccess(user)} aria-label={`${user.isActive ? "Suspender" : "Habilitar"} acceso de ${user.fullName}`}>
                      {user.isActive ? <Ban size={17} /> : <UserCheck size={17} />}{user.isActive ? "Suspender" : "Habilitar"}
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Enviar a eliminados a ${user.fullName}`}
                      onClick={() => deactivate(user)}
                    >
                      <Trash2 size={17} /> Eliminar
                    </Button>
                  </>}
                  </>}
                </div>
              </article>
              ))}
            </div>
            {data?.items.length === 0 && <p className="user-directory-empty">No hay cuentas para estos filtros.</p>}
            {data ? <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /> : null}
          </>
        )}
      </Card>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={editing ? "Administrar usuario" : "Crear usuario interno"}
        description="Configure la cuenta, el rol y la fotografía."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !form.fullName ||
                !form.email ||
                !form.roleIds.length ||
                (!editing && !isValidPassword(form.password))
              }
              onClick={submit}
            >
              {busy
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear usuario"}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="form-error" role="alert">
            {formError}
          </div>
        )}
        <FilePicker
          label="Seleccionar fotografía"
          hint="PNG, JPG o WEBP · fotografía de perfil"
          file={photo}
          onChange={setPhoto}
          accept="image/png,image/jpeg,image/webp"
        />
        <div className="form-grid">
          <Field label="Nombre completo">
            <input
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
            />
          </Field>
          <Field label="Correo">
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </Field>
          {!editing && (
            <Field label="Contraseña temporal">
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
          )}
          <Field label="Roles">
            <Select
              multiple
              value={form.roleIds}
              onChange={(event) =>
                setForm({
                  ...form,
                  roleIds: Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                })
              }
            >
              {rolesState.data
                ?.filter((role) => role.isActive && role.name !== "Alumno")
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
            </Select>
          </Field>
          <DateRangePickerField
            label="Vigencia de participación"
            startValue={form.participationStartDate}
            endValue={form.participationEndDate}
            onChange={(participationStartDate, participationEndDate) =>
              setForm({ ...form, participationStartDate, participationEndDate })
            }
          />
        </div>
      </Modal>
      <Modal
        open={passwordUser !== null}
        onClose={() => !busy && setPasswordUser(null)}
        title="Restablecer contraseña"
        description={passwordUser ? `Defina una contraseña temporal para ${passwordUser.fullName}.` : undefined}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setPasswordUser(null)}>Cancelar</Button><Button disabled={busy || !isValidPassword(newPassword)} onClick={savePassword}>{busy ? "Guardando…" : "Restablecer"}</Button></>}
      >
        <Field label="Nueva contraseña" hint="Entre 8 y 128 caracteres.">
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </Field>
      </Modal>
      <Modal
        open={purgeTarget !== null}
        onClose={() => !busy && setPurgeTarget(null)}
        title="Eliminar cuenta definitivamente"
        description="Esta acción no se puede deshacer. El expediente y la autoría histórica permanecen, pero la cuenta y sus fotografías se eliminan."
        footer={<>
          <Button variant="secondary" disabled={busy} onClick={() => setPurgeTarget(null)}>Cancelar</Button>
          <Button variant="danger" disabled={busy || purgeConfirmation !== purgeTarget?.email} onClick={purge}>
            {busy ? "Eliminando…" : "Eliminar definitivamente"}
          </Button>
        </>}
      >
        <p className="user-purge-warning">Para confirmar, escriba el correo de la cuenta: <strong>{purgeTarget?.email}</strong></p>
        <Field label="Correo de confirmación">
          <input value={purgeConfirmation} onChange={(event) => setPurgeConfirmation(event.target.value)} autoComplete="off" />
        </Field>
      </Modal>
    </>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.listAudit({ page, pageSize: 50 }),
    [page],
  );
  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad completa"
        title="Auditoría"
        description="Quién hizo qué, cuándo, sobre qué registro y desde qué solicitud."
      />
      <Card>
        <SectionHeading
          title="Eventos auditados"
          description="Registro inmutable de acciones relevantes"
        />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          <><div className="audit-table">
            <div className="audit-table__head">
              <span>Fecha y usuario</span>
              <span>Acción</span>
              <span>Entidad</span>
              <span>Trazabilidad</span>
            </div>
            {data?.items.map((entry) => (
              <article key={entry.id}>
                <span>
                  <strong>{formatDateTime(entry.occurredAtUtc)}</strong>
                  <small>{entry.username ?? "Sistema"}</small>
                </span>
                <span>
                  <Badge tone="blue">{entry.action}</Badge>
                </span>
                <span>
                  <strong>{entry.entityType}</strong>
                  <small>{entry.entityId}</small>
                </span>
                <span>
                  <strong>{entry.traceId}</strong>
                  <small>{entry.ipAddress}</small>
                </span>
              </article>
            ))}
          </div>{data ? <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /> : null}</>
        )}
      </Card>
    </>
  );
}

export function RetentionPage() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.listRetentionCandidates({ page, pageSize: 25 }),
    [page],
  );
  return (
    <>
      <PageHeader
        eyebrow="Conservación controlada"
        title="Retención y depuración"
        description="Vista previa de expedientes que cumplen el período configurado. La ejecución destructiva permanece bloqueada."
      />
      <div className="retention-warning">
        <ShieldAlert size={22} />
        <div>
          <strong>Política pendiente de aprobación institucional</strong>
          <p>
            El período de un año es preliminar. La interfaz solo permite
            consultar candidatos y revisar el impacto.
          </p>
        </div>
      </div>
      <Card>
        <SectionHeading
          title="Expedientes candidatos"
          description="Ningún archivo será eliminado sin una política institucional aprobada"
        />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : data?.items.length ? (
          <><div className="admin-list retention-list">
            {data.items.map((candidate) => (
              <article key={candidate.caseId}>
                <span className="admin-list__icon">
                  <ArchiveRestore size={20} />
                </span>
                <div>
                  <strong>
                    {candidate.caseNumber} · {candidate.clientName}
                  </strong>
                  <small>
                    Elegible desde {formatDateTime(candidate.eligibleAtUtc)}
                  </small>
                </div>
                <span>
                  <strong>{candidate.documentCount} documentos</strong>
                  <small>
                    {candidate.timelineEntryCount} pasos cronológicos
                  </small>
                </span>
                <Badge tone="warning">Candidato</Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                >
                  Vista previa
                </Button>
              </article>
            ))}
          </div><Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /></>
        ) : (
          <p className="muted-copy">
            No hay candidatos para el criterio actual.
          </p>
        )}
      </Card>
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Vista previa de afectación"
        description="Consulta informativa; la ejecución no está habilitada."
        footer={
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Cerrar vista previa
          </Button>
        }
      >
        <div className="impact-list">
          {[
            "Expediente y datos procesales",
            "Documentos y sus versiones",
            "Eventos de línea de tiempo",
            "Asignaciones históricas del alumno",
            "Referencias cruzadas de auditoría preservadas",
          ].map((item) => (
            <span key={item}>
              <ShieldCheck size={17} />
              {item}
            </span>
          ))}
        </div>
        <div className="retention-warning">
          <ShieldAlert size={19} />
          <div>
            <strong>Ejecución bloqueada</strong>
            <p>
              Se requiere aprobar política, permisos, doble confirmación y
              respaldo.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function CatalogsPage() {
  const emptyProcess = { code: "", name: "", description: "", isActive: true };
  const emptyRequirement: Omit<
    RequirementDefinition,
    "id" | "maximumAgeDays"
  > & { maximumAgeDays: string } = {
    scope: "LegalProcess",
    processTypeId: null,
    code: "",
    label: "",
    kind: "Document",
    isRequired: true,
    isConditional: false,
    conditionDescription: "",
    documentNature: "Original",
    maximumAgeDays: "",
    subject: "",
    instructions: "",
    sortOrder: 0,
    isActive: true,
  };
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.listProcessTypes(),
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processOpen, setProcessOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessType | null>(
    null,
  );
  const [processForm, setProcessForm] = useState(emptyProcess);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] =
    useState<RequirementDefinition | null>(null);
  const [requirementForm, setRequirementForm] = useState(emptyRequirement);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const selected =
    data?.find((item) => item.id === selectedId) ?? data?.[0] ?? null;

  const openProcess = (item?: ProcessType) => {
    setEditingProcess(item ?? null);
    setProcessForm(
      item
        ? {
            code: item.code,
            name: item.name,
            description: item.description,
            isActive: item.isActive,
          }
        : emptyProcess,
    );
    setFormError("");
    setProcessOpen(true);
  };
  const saveProcess = async () => {
    setBusy(true);
    setFormError("");
    try {
      if (editingProcess)
        await dataSource.updateProcessType(editingProcess.id, processForm);
      else await dataSource.createProcessType(processForm);
      setProcessOpen(false);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el tipo de proceso.",
      );
    } finally {
      setBusy(false);
    }
  };
  const openRequirement = (item?: RequirementDefinition) => {
    if (!selected) return;
    setEditingRequirement(item ?? null);
    setRequirementForm(
      item
        ? {
            scope: item.scope,
            processTypeId: item.processTypeId,
            code: item.code,
            label: item.label,
            kind: item.kind,
            isRequired: item.isRequired,
            isConditional: item.isConditional,
            conditionDescription: item.conditionDescription ?? "",
            documentNature: item.documentNature,
            maximumAgeDays: item.maximumAgeDays?.toString() ?? "",
            subject: item.subject ?? "",
            instructions: item.instructions ?? "",
            sortOrder: item.sortOrder,
            isActive: item.isActive,
          }
        : {
            ...emptyRequirement,
            processTypeId: selected.id,
            sortOrder: selected.requirements.length + 1,
          },
    );
    setFormError("");
    setRequirementOpen(true);
  };
  const saveRequirement = async () => {
    setBusy(true);
    setFormError("");
    const payload = {
      ...requirementForm,
      maximumAgeDays: requirementForm.maximumAgeDays
        ? Number(requirementForm.maximumAgeDays)
        : null,
      conditionDescription: requirementForm.conditionDescription || null,
      subject: requirementForm.subject || null,
      instructions: requirementForm.instructions || null,
    };
    try {
      if (editingRequirement)
        await dataSource.updateRequirement(editingRequirement.id, payload);
      else await dataSource.createRequirement(payload);
      setRequirementOpen(false);
      await reload();
    } catch (reason) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el requisito.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Configuración funcional"
        title="Catálogos"
        description="Tipos de proceso y requisitos documentales."
        actions={
          <Button onClick={() => openProcess()}>
            <Plus size={18} />
            Nuevo tipo
          </Button>
        }
      />
      <div className="catalog-grid">
        <Card>
          <SectionHeading
            title="Tipos de proceso"
            description="Opciones disponibles al abrir expedientes"
          />
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} retry={reload} />
          ) : data ? (
            data.map((item) => (
              <div
                className={`catalog-item ${selected?.id === item.id ? "catalog-item--selected" : ""}`}
                key={item.id}
              >
                <span className="admin-list__icon">
                  <BookKey size={18} />
                </span>
                <button
                  className="catalog-item__select"
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <small>
                    {item.code} · {item.requirements.length} requisitos
                    configurados
                  </small>
                </button>
                <Badge tone={item.isActive ? "success" : "neutral"}>
                  {item.isActive ? "Activo" : "Inactivo"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${item.name}`}
                  onClick={() => openProcess(item)}
                >
                  <Settings2 size={17} />
                </Button>
              </div>
            ))
          ) : null}
        </Card>
        <Card>
          <SectionHeading
            title={
              selected
                ? `Requisitos · ${selected.name}`
                : "Requisitos documentales"
            }
            description="Obligatoriedad, condición, vigencia y naturaleza"
            action={
              selected ? (
                <Button size="sm" onClick={() => openRequirement()}>
                  <Plus size={15} />
                  Requisito
                </Button>
              ) : undefined
            }
          />
          {selected?.requirements.length ? (
            <div className="catalog-requirements">
              {selected.requirements.map((item) => (
                <div className="catalog-item" key={item.id}>
                  <span className="admin-list__icon">
                    <FileClock size={18} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>
                      {item.code} ·{" "}
                      {item.kind === "Document" ? item.documentNature : "Dato"}
                      {item.maximumAgeDays
                        ? ` · ${item.maximumAgeDays} días`
                        : ""}
                    </small>
                  </span>
                  <Badge
                    tone={
                      item.isActive
                        ? item.isRequired
                          ? "warning"
                          : "blue"
                        : "neutral"
                    }
                  >
                    {item.isActive
                      ? item.isRequired
                        ? "Obligatorio"
                        : "Opcional"
                      : "Inactivo"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar requisito ${item.label}`}
                    onClick={() => openRequirement(item)}
                  >
                    <Pencil size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              Seleccione un tipo o agregue su primer requisito aprobado.
            </p>
          )}
          <div className="note-panel">
            <strong>Catálogo institucional</strong>
            <p>Solo incluye procesos y requisitos aprobados.</p>
          </div>
        </Card>
      </div>
      <Modal
        open={processOpen}
        onClose={() => !busy && setProcessOpen(false)}
        title={
          editingProcess ? "Editar tipo de proceso" : "Nuevo tipo de proceso"
        }
        description="Código, nombre y estado del tipo de proceso."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setProcessOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                busy || !processForm.code.trim() || !processForm.name.trim()
              }
              onClick={saveProcess}
            >
              Guardar tipo
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Código">
            <input
              value={processForm.code}
              onChange={(event) =>
                setProcessForm({
                  ...processForm,
                  code: event.target.value.toUpperCase(),
                })
              }
            />
          </Field>
          <Field label="Nombre">
            <input
              value={processForm.name}
              onChange={(event) =>
                setProcessForm({ ...processForm, name: event.target.value })
              }
            />
          </Field>
          <Field label="Descripción">
            <textarea
              value={processForm.description}
              onChange={(event) =>
                setProcessForm({
                  ...processForm,
                  description: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Estado">
            <Select
              value={String(processForm.isActive)}
              onChange={(event) =>
                setProcessForm({
                  ...processForm,
                  isActive: event.target.value === "true",
                })
              }
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
      <Modal
        open={requirementOpen}
        onClose={() => !busy && setRequirementOpen(false)}
        title={editingRequirement ? "Editar requisito" : "Agregar requisito"}
        description="Documento, obligatoriedad, vigencia y condición."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setRequirementOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !requirementForm.code.trim() ||
                !requirementForm.label.trim()
              }
              onClick={saveRequirement}
            >
              Guardar requisito
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Código">
            <input
              value={requirementForm.code}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  code: event.target.value.toUpperCase(),
                })
              }
            />
          </Field>
          <Field label="Etiqueta">
            <input
              value={requirementForm.label}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  label: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={requirementForm.kind}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  kind: event.target.value as "Document" | "Data",
                })
              }
            >
              <option value="Document">Documento</option>
              <option value="Data">Dato</option>
            </Select>
          </Field>
          <Field label="Naturaleza">
            <Select
              value={requirementForm.documentNature}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  documentNature: event.target
                    .value as typeof requirementForm.documentNature,
                })
              }
            >
              <option value="Original">Original</option>
              <option value="Copy">Copia</option>
              <option value="Photocopy">Fotocopia</option>
              <option value="CertifiedCopy">Copia certificada</option>
              <option value="NotApplicable">No aplica</option>
            </Select>
          </Field>
          <Field label="Obligatoriedad">
            <Select
              value={String(requirementForm.isRequired)}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  isRequired: event.target.value === "true",
                })
              }
            >
              <option value="true">Obligatorio</option>
              <option value="false">Opcional</option>
            </Select>
          </Field>
          <Field label="Condicional">
            <Select
              value={String(requirementForm.isConditional)}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  isConditional: event.target.value === "true",
                })
              }
            >
              <option value="false">No</option>
              <option value="true">Sí</option>
            </Select>
          </Field>
          <Field label="Vigencia máxima (días)">
            <input
              type="number"
              min="1"
              value={requirementForm.maximumAgeDays}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  maximumAgeDays: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Orden">
            <input
              type="number"
              min="0"
              value={requirementForm.sortOrder}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  sortOrder: Number(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Condición">
            <textarea
              value={requirementForm.conditionDescription ?? ""}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  conditionDescription: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Instrucciones">
            <textarea
              value={requirementForm.instructions ?? ""}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  instructions: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Estado">
            <Select
              value={String(requirementForm.isActive)}
              onChange={(event) =>
                setRequirementForm({
                  ...requirementForm,
                  isActive: event.target.value === "true",
                })
              }
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </Field>
        </div>
        {formError && <p className="form-error">{formError}</p>}
      </Modal>
    </>
  );
}
