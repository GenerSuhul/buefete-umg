import { Building2, Plus, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorState, Field, LoadingState, PageHeader, SectionHeading } from "../components/ui";
import { useConfirm, useNotify } from "../components/ui/Feedback";
import { useAuth } from "../context/AuthContext";
import { platformApi } from "../data/dataSource";
import { useAsyncData } from "../hooks/useAsyncData";
import type { TokenResponse } from "../types/domain";

interface Tenant { code: string; name: string; status: string; isActive: boolean }
const emptyForm = { code: "", name: "", administratorName: "", administratorEmail: "", administratorPassword: "" };

export function NativeTenantsPage() {
  const { user } = useAuth();
  if (!user?.isPlatformAdmin) return <ErrorState error={new Error("La administración de sedes requiere una cuenta de superusuario.")} />;
  return <TenantAdministration />;
}

function TenantAdministration() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsyncData(() => platformApi.request<Tenant[]>("/platform/tenants"), []);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const confirm = useConfirm(), notify = useNotify();
  const changeField = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      await platformApi.request("/platform/tenants", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyForm); await reload();
      notify.success({ title: "Sede creada", message: "Su administrador ya puede iniciar sesión con el código de sede y las credenciales indicadas." });
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "No se pudo crear la sede."); }
    finally { setBusy(false); }
  }

  async function enter(tenant: Tenant) {
    if (!(await confirm({ title: "Cambiar de sede", message: `Entrará a ${tenant.name}. Guarde cualquier formulario pendiente antes de continuar.`, confirmLabel: "Entrar a la sede" }))) return;
    setBusy(true); setFormError("");
    try {
      const session = await platformApi.request<TokenResponse>(`/platform/tenants/${tenant.code}/session`, { method: "POST" });
      platformApi.setSession(session);
      window.location.assign("/");
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "No se pudo cambiar de sede."); setBusy(false); }
  }

  async function update(tenant: Tenant, name: string, isActive: boolean) {
    if (isActive !== tenant.isActive && !(await confirm({ title: isActive ? "Habilitar sede" : "Suspender sede", message: isActive ? "Se permitirá nuevamente el acceso a esta sede." : "Se bloqueará el acceso a esta sede. Sus cuentas, expedientes y documentos se conservarán.", confirmLabel: isActive ? "Habilitar" : "Suspender", tone: isActive ? "primary" : "danger" }))) return;
    setBusy(true); setFormError("");
    try {
      await platformApi.request(`/platform/tenants/${tenant.code}`, { method: "PUT", body: JSON.stringify({ name, isActive }) });
      await reload(); notify.success({ title: "Sede actualizada", message: "Los cambios se guardaron correctamente." });
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "No se pudo actualizar la sede."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="ADMINISTRACIÓN GLOBAL" title="Bufetes y sedes" description="Gestione los espacios de trabajo y sus administradores iniciales. Los registros jurídicos se administran dentro de cada sede." />
    <div className="tenant-scope-note"><ShieldCheck size={20} aria-hidden="true" /><div><strong>Control global · Superusuario</strong><p>Espacio operativo actual: <b>{user?.tenantName ?? 'Petén'}</b>. Crear o editar una sede no cambia este contexto. Utilice «Entrar a la sede» para administrar allí a su personal y sus registros.</p></div></div>
    {formError && <div role="alert" className="form-error">{formError}</div>}
    <div className="tenants-layout">
      <Card>
        <SectionHeading title="Sedes registradas" description="Cada sede dispone de sus propias cuentas, alumnos, expedientes y documentos." />
        {loading ? <LoadingState /> : error ? <ErrorState error={error} retry={reload} /> : <div className="tenant-list">{data?.map(tenant => <TenantRow key={tenant.code} tenant={tenant} current={tenant.code === (user?.tenantCode ?? "peten")} busy={busy} onEnter={enter} onUpdate={update} />)}</div>}
      </Card>
      <Card>
        <SectionHeading title="Crear sede" description="Registre la sede y la cuenta de su primer administrador." />
        <form onSubmit={create} className="tenant-form">
          <Field label="Nombre de la sede"><input required maxLength={160} value={form.name} onChange={event => changeField("name", event.target.value)} placeholder="Sede Cobán" /></Field>
          <Field label="Código de acceso"><input required pattern={'[a-z][a-z0-9\\-]{1,39}'} maxLength={40} value={form.code} onChange={event => changeField("code", event.target.value.toLowerCase())} placeholder="coban" /></Field>
          <Field label="Nombre del administrador"><input required maxLength={160} value={form.administratorName} onChange={event => changeField("administratorName", event.target.value)} autoComplete="off" /></Field>
          <Field label="Correo del administrador"><input required type="email" value={form.administratorEmail} onChange={event => changeField("administratorEmail", event.target.value)} autoComplete="off" /></Field>
          <Field label="Contraseña inicial"><input required type="password" minLength={8} maxLength={128} value={form.administratorPassword} onChange={event => changeField("administratorPassword", event.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" disabled={busy}><Plus size={16} />{busy ? "Procesando…" : "Crear sede y administrador"}</Button>
        </form>
      </Card>
    </div>
  </>;
}

function TenantRow({ tenant, current, busy, onEnter, onUpdate }: { tenant: Tenant; current: boolean; busy: boolean; onEnter: (tenant: Tenant) => Promise<void>; onUpdate: (tenant: Tenant, name: string, active: boolean) => Promise<void> }) {
  const [name, setName] = useState(tenant.name);
  return <article className="tenant-row">
    <Building2 size={22} aria-hidden="true" />
    <div><strong>{tenant.name}</strong><p>Código: {tenant.code} {current && "· Sede actual"}</p><Badge tone={tenant.status === 'Failed' ? 'danger' : tenant.status === 'Provisioning' ? 'info' : tenant.isActive ? 'success' : 'neutral'}>{tenant.status === 'Failed' ? 'Error de aprovisionamiento' : tenant.status === 'Provisioning' ? 'Preparando sede' : tenant.isActive ? 'Activa' : 'Suspendida'}</Badge></div>
    {tenant.status === "Failed" && <p>Para reintentar, complete el formulario «Crear sede» con este mismo código y los datos del administrador.</p>}
    {tenant.status === "Ready" && <div>
      <Field label={`Nombre de ${tenant.code}`}><input value={name} maxLength={160} onChange={event => setName(event.target.value)} /></Field>
      <Button variant="secondary" disabled={busy || name.trim() === tenant.name || name.trim().length < 2} onClick={() => void onUpdate(tenant, name, tenant.isActive)}>Guardar nombre</Button>
      <Button variant="secondary" disabled={busy || tenant.code === "peten" || current} onClick={() => void onUpdate(tenant, tenant.name, !tenant.isActive)}>{tenant.isActive ? "Suspender" : "Habilitar"}</Button>
      <Button disabled={busy || !tenant.isActive || current} onClick={() => void onEnter(tenant)}>Entrar a la sede</Button>
      {current && <small>Ya está trabajando en esta sede.</small>}
      {tenant.code === 'peten' && <small>Petén aloja la administración central y no se puede suspender.</small>}
    </div>}
  </article>;
}
