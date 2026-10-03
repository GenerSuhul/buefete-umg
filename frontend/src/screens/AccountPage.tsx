import {
  CalendarClock,
  Check,
  CircleUserRound,
  IdCard,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { dataSource } from "../data/dataSource";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate, translate } from "../utils/format";
import { isValidPassword } from "../utils/passwordPolicy";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  FilePicker,
  LoadingState,
} from "../components/ui";
import { useNotify } from "../components/ui/Feedback";

type AccountSection = "profile" | "security" | "access";

const sections: Array<{
  id: AccountSection;
  label: string;
  description: string;
  icon: typeof CircleUserRound;
}> = [
  {
    id: "profile",
    label: "Información personal",
    description: "Nombre, correo y fotografía",
    icon: CircleUserRound,
  },
  {
    id: "security",
    label: "Seguridad",
    description: "Contraseña y protección de acceso",
    icon: ShieldCheck,
  },
  {
    id: "access",
    label: "Acceso y permisos",
    description: "Estado, vigencia y funciones asignadas",
    icon: IdCard,
  },
];

export function AccountPage() {
  const { user, loading: authLoading, updateProfile, updatePhoto, changePassword, logout } =
    useAuth();
  const notify = useNotify();
  const [section, setSection] = useState<AccountSection>("profile");
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { data: account, error, loading, reload } = useAsyncData(
    () => dataSource.getCurrentUser(),
    [],
  );

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setEmail(user.email);
  }, [user]);

  const passwordRules = [
    { label: "Entre 8 y 128 caracteres", met: isValidPassword(newPassword) },
  ];
  const passwordValid = isValidPassword(newPassword);
  const profileDirty =
    fullName.trim() !== user?.fullName ||
    email.trim() !== user?.email ||
    photo !== null;

  const saveProfile = async () => {
    setFormError(null);
    try {
      await notify.track(
        (async () => {
          if (
            fullName.trim() !== user?.fullName ||
            email.trim() !== user?.email
          ) {
            await updateProfile({
              fullName: fullName.trim(),
              email: email.trim(),
            });
          }
          if (photo) await updatePhoto(photo);
        })(),
        {
          loading: { title: "Guardando perfil…" },
          success: {
            title: "Perfil actualizado",
            message: "La información de tu cuenta quedó guardada.",
          },
          error: { title: "No se pudo actualizar el perfil" },
        },
      );
      setPhoto(null);
      reload();
    } catch (caught) {
      setFormError(errorMessage(caught, "No se pudo actualizar el perfil."));
    }
  };

  const savePassword = async () => {
    setFormError(null);
    if (newPassword !== confirmPassword) {
      setFormError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (!passwordValid) {
      setFormError("La nueva contraseña todavía no cumple todos los requisitos.");
      return;
    }
    try {
      await notify.track(changePassword(currentPassword, newPassword), {
        loading: { title: "Actualizando contraseña…" },
        success: {
          title: "Contraseña actualizada",
          message: "Vuelve a iniciar sesión con tu nueva contraseña.",
        },
        error: { title: "No se pudo actualizar la contraseña" },
      });
      await logout({ silent: true });
    } catch (caught) {
      setFormError(errorMessage(caught, "No se pudo actualizar la contraseña."));
    }
  };

  if (!user) return null;

  return (
    <div className="account-page">
      <section className="account-hero" aria-labelledby="account-title">
        <div className="account-hero__cover" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="account-hero__identity">
          <Avatar
            name={user.fullName}
            documentId={user.photoDocumentId}
            size="lg"
            className="account-hero__avatar"
          />
          <div>
            <p>CUENTA INSTITUCIONAL</p>
            <h1 id="account-title">{user.fullName}</h1>
            <span>@{user.username} · {user.email}</span>
          </div>
          <Badge tone={account?.isActive === false ? "danger" : "success"}>
            {account?.isActive === false ? "Cuenta inactiva" : "Cuenta activa"}
          </Badge>
        </div>
      </section>

      <section className="account-metrics" aria-label="Resumen de la cuenta">
        <Card>
          <UserRoundCheck size={20} />
          <span><small>Rol principal</small><strong>{translate(user.roles[0] ?? "Sin rol")}</strong></span>
        </Card>
        <Card>
          <ShieldCheck size={20} />
          <span><small>Nivel de acceso</small><strong>{user.permissions.includes("*") ? "Administración completa" : `${user.permissions.length} permisos`}</strong></span>
        </Card>
        <Card>
          <CalendarClock size={20} />
          <span><small>Vigencia</small><strong>{formatValidity(account?.participationStartDate, account?.participationEndDate)}</strong></span>
        </Card>
      </section>

      <div className="account-layout">
        <nav className="account-nav" aria-label="Secciones de la cuenta">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={section === item.id ? "is-active" : ""}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => {
                  setSection(item.id);
                  setFormError(null);
                }}
              >
                <Icon size={19} />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            );
          })}
        </nav>

        <div className="account-content">
          {loading && !account ? (
            <LoadingState label="Cargando cuenta" />
          ) : error ? (
            <ErrorState error={error} retry={reload} />
          ) : (
            <>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              {section === "profile" && (
                <Card className="account-panel">
                  <PanelHeading
                    icon={CircleUserRound}
                    title="Información personal"
                    description="Estos datos identifican tu cuenta dentro del bufete."
                  />
                  <div className="account-photo-row">
                    <Avatar name={user.fullName} documentId={user.photoDocumentId} size="lg" />
                    <div><strong>Fotografía de perfil</strong><span>Visible en tu sesión y en los registros donde participas.</span></div>
                  </div>
                  <FilePicker
                    label="Seleccionar nueva fotografía"
                    hint="JPG, PNG o WEBP. La imagen se guarda al confirmar los cambios."
                    file={photo}
                    onChange={setPhoto}
                    accept="image/png,image/jpeg,image/webp"
                  />
                  <div className="form-grid account-form">
                    <Field label="Nombre completo">
                      <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
                    </Field>
                    <Field label="Correo institucional">
                      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                    </Field>
                    <Field label="Usuario" hint="El identificador de acceso no se puede modificar desde el perfil.">
                      <input value={user.username} readOnly aria-readonly="true" />
                    </Field>
                    <Field label="Rol principal">
                      <input value={translate(user.roles[0] ?? "Sin rol")} readOnly aria-readonly="true" />
                    </Field>
                  </div>
                  <div className="account-panel__actions">
                    <Button
                      disabled={authLoading || !profileDirty || !fullName.trim() || !email.trim()}
                      onClick={saveProfile}
                    >
                      {authLoading ? "Guardando…" : "Guardar cambios"}
                    </Button>
                  </div>
                </Card>
              )}

              {section === "security" && (
                <Card className="account-panel">
                  <PanelHeading
                    icon={LockKeyhole}
                    title="Seguridad de la cuenta"
                    description="La actualización revoca las sesiones anteriores para proteger tu acceso."
                  />
                  <div className="account-security-note">
                    <KeyRound size={21} />
                    <span><strong>Contraseña segura</strong><small>No reutilices una contraseña de correo, redes sociales u otros servicios.</small></span>
                  </div>
                  <div className="form-grid account-form">
                    <Field label="Contraseña actual" wide>
                      <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                    </Field>
                    <Field label="Nueva contraseña">
                      <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                    </Field>
                    <Field label="Confirmar nueva contraseña">
                      <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                    </Field>
                  </div>
                  <div className="password-rules" aria-label="Requisitos de contraseña">
                    {passwordRules.map((rule) => (
                      <span key={rule.label} className={rule.met ? "is-met" : ""}>
                        <Check size={14} /> {rule.label}
                      </span>
                    ))}
                  </div>
                  <div className="account-panel__actions">
                    <Button
                      disabled={authLoading || !currentPassword || !newPassword || !confirmPassword}
                      onClick={savePassword}
                    >
                      Actualizar contraseña
                    </Button>
                  </div>
                </Card>
              )}

              {section === "access" && (
                <Card className="account-panel">
                  <PanelHeading
                    icon={IdCard}
                    title="Acceso y permisos"
                    description="Información asignada por administración para operar dentro del sistema."
                  />
                  <div className="account-access-grid">
                    <InfoItem label="Estado" value={account?.isActive === false ? "Inactiva" : "Activa"} />
                    <InfoItem label="Inicio de participación" value={formatDate(account?.participationStartDate)} />
                    <InfoItem label="Fin de participación" value={account?.participationEndDate ? formatDate(account.participationEndDate) : "Sin fecha límite"} />
                    <InfoItem label="Correo de acceso" value={user.email} />
                  </div>
                  <section className="account-access-section">
                    <h3>Roles asignados</h3>
                    <div className="account-role-list">
                      {user.roles.map((role) => <Badge key={role} tone="blue">{translate(role)}</Badge>)}
                    </div>
                  </section>
                  <section className="account-access-section">
                    <h3>Permisos efectivos</h3>
                    {user.permissions.includes("*") ? (
                      <div className="account-full-access"><ShieldCheck size={20} /><span><strong>Acceso administrativo completo</strong><small>La cuenta puede administrar todos los módulos habilitados.</small></span></div>
                    ) : (
                      <div className="permission-list">
                        {user.permissions.map((permission) => (
                          <span key={permission}><Check size={14} />{formatPermission(permission)}</span>
                        ))}
                      </div>
                    )}
                  </section>
                  <p className="account-access-footnote">Los roles, permisos y vigencias sólo pueden modificarse desde Administración de usuarios.</p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeading({ icon: Icon, title, description }: { icon: typeof CircleUserRound; title: string; description: string }) {
  return <header className="account-panel__heading"><span><Icon size={22} /></span><div><h2>{title}</h2><p>{description}</p></div></header>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="account-info-item"><small>{label}</small><strong>{value}</strong></div>;
}

function formatValidity(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return "Sin fecha límite";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `Desde ${formatDate(start)}` : `Hasta ${formatDate(end)}`;
}

function formatPermission(permission: string) {
  const [module, ...segments] = permission.split(".");
  const modules: Record<string, string> = {
    cases: "Expedientes",
    clients: "Usuarios",
    students: "Alumnos",
    documents: "Documentos",
    activities: "Actividades",
    reports: "Reportes",
    users: "Usuarios",
    catalogs: "Catálogos",
    audit: "Auditoría",
    records: "Registros",
    retention: "Retención",
  };
  const actions: Record<string, string> = {
    read: "consultar",
    write: "administrar",
    manage: "administrar",
    generate: "generar",
    preview: "consultar",
    deactivate: "desactivar",
    assigned: "casos asignados",
    self: "perfil propio",
    deleted: "eliminados",
  };
  return `${modules[module] ?? module}: ${segments.map((part) => actions[part] ?? part).join(" · ") || "acceso"}`;
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
