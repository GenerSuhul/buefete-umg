import { Building2, Check, Plus, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  SectionHeading,
} from "../components/ui";
import { useConfirm, useNotify } from "../components/ui/Feedback";
import { demoCall, demoEnabled, type DemoWorkspace } from "../demo/client";
import { useAsyncData } from "../hooks/useAsyncData";
import { NativeTenantsPage } from "./NativeTenantsPage";

export function TenantsPage() {
  return demoEnabled ? <DemoTenantsPage /> : <NativeTenantsPage />;
}

function DemoTenantsPage() {
  const { data, error, loading, reload } = useAsyncData(
    () => demoCall<DemoWorkspace>("getWorkspace"),
    [],
  );
  const [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const confirm = useConfirm(),
    notify = useNotify();
  if (!demoEnabled)
    return (
      <ErrorState
        error={
          new Error(
            "La administración de sedes aún no está habilitada en este entorno.",
          )
        }
      />
    );
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await demoCall("createTenant", { code: code.trim(), name: name.trim() });
      setCode("");
      setName("");
      await reload();
      notify.success({
        title: "Sede creada",
        message:
          "La nueva sede está disponible y comienza sin registros operativos.",
      });
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "No se pudo crear la sede.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function change(tenantId: string, tenantName: string) {
    if (
      !(await confirm({
        title: "Cambiar de sede",
        message: `Entrará a ${tenantName}. Finalice o guarde los formularios abiertos antes de continuar.`,
        confirmLabel: "Cambiar de sede",
      }))
    )
      return;
    setBusy(true);
    try {
      await demoCall("switchTenant", tenantId);
      window.location.assign("/");
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "No se pudo cambiar la sede.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRACIÓN DE PLATAFORMA"
        title="Bufetes y sedes"
        description="Espacios de trabajo separados para cada sede del Bufete Popular UMG."
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        data && (
          <div className="tenants-layout">
            <Card>
              <SectionHeading
                title="Sedes disponibles"
                description="Los registros y documentos pertenecen a la sede en la que fueron creados."
              />
              <div className="tenant-list">
                {data.tenants.map((tenant) => (
                  <article
                    key={tenant.id}
                    className={`tenant-card ${tenant.id === data.current.id ? "tenant-card--current" : ""}`}
                  >
                    <span className="tenant-card__icon">
                      <Building2 size={24} />
                    </span>
                    <div>
                      <h3>{tenant.name}</h3>
                      <p>{tenant.code}</p>
                      <Badge tone={tenant.isActive ? "success" : "neutral"}>
                        {tenant.id === data.current.id
                          ? "Sede actual"
                          : tenant.isActive
                            ? "Disponible"
                            : "Suspendida"}
                      </Badge>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={
                        busy ||
                        !tenant.isActive ||
                        tenant.id === data.current.id
                      }
                      onClick={() => change(tenant.id, tenant.name)}
                    >
                      {tenant.id === data.current.id ? (
                        <>
                          <Check size={17} /> Actual
                        </>
                      ) : (
                        "Entrar a la sede"
                      )}
                    </Button>
                  </article>
                ))}
              </div>
            </Card>
            <div className="tenant-side">
              {data.platformAdmin && (
                <Card>
                  <SectionHeading
                    title="Crear sede"
                    description="Se habilitan sus catálogos y un espacio vacío para registros de prueba."
                  />
                  <form onSubmit={create} className="tenant-form">
                    <Field label="Nombre de la sede">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                        placeholder="Bufete Popular UMG · sede de prueba"
                        required
                      />
                    </Field>
                    <Field label="Código único">
                      <input
                        value={code}
                        onChange={(e) =>
                          setCode(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          )
                        }
                        minLength={2}
                        maxLength={40}
                        placeholder="sede-prueba"
                        required
                      />
                    </Field>
                    {formError && (
                      <p role="alert" className="form-error">
                        {formError}
                      </p>
                    )}
                    <Button type="submit" disabled={busy}>
                      <Plus size={18} />
                      {busy ? "Procesando…" : "Crear sede"}
                    </Button>
                  </form>
                </Card>
              )}
              <Card>
                <SectionHeading title="Separación de información" />
                <div className="tenant-guidance">
                  <ShieldCheck size={24} />
                  <p>
                    Usuarios atendidos, alumnos, expedientes, accesos y
                    documentos se administran dentro de una sede. Las cuentas de
                    personal sólo pueden acceder a su espacio asignado.
                  </p>
                  <p>
                    El administrador de plataforma puede crear
                    sedes y cambiar de espacio. No se copian expedientes entre
                    sedes.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        )
      )}
    </>
  );
}
