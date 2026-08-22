import {
  Activity,
  Bell,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  KeyRound,
  FileClock,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCog,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dataSource } from "../../data/dataSource";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { SearchResult } from "../../types/domain";
import {
  Avatar,
  Badge,
  Button,
  Field,
  FilePicker,
  IconButton,
  Modal,
} from "../ui";

interface NavigationItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  end?: boolean;
  permissions: string[];
}

interface NavigationGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    id: "legal",
    label: "Gestión jurídica",
    icon: FolderKanban,
    items: [
      {
        to: "/expedientes",
        label: "Expedientes",
        description: "Procesos y seguimiento",
        icon: FolderKanban,
        permissions: ["cases.read", "cases.assigned.read"],
      },
      {
        to: "/personas/clientes",
        label: "Clientes",
        description: "Atención y papelería",
        icon: UsersRound,
        permissions: ["clients.read"],
      },
      {
        to: "/documentos",
        label: "Archivo digital",
        description: "Documentos y escáner",
        icon: FileStack,
        permissions: ["clients.read"],
      },
    ],
  },
  {
    id: "academic",
    label: "Práctica académica",
    icon: BookOpenCheck,
    items: [
      {
        to: "/personas/alumnos",
        label: "Alumnos",
        description: "Inscripción y casos",
        icon: BookOpenCheck,
        permissions: ["students.read", "students.self.read"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operación interna",
    icon: Activity,
    items: [
      {
        to: "/actividades",
        label: "Actividades",
        description: "Bitácora de secretaría",
        icon: ClipboardList,
        permissions: ["activities.read"],
      },
      {
        to: "/reportes",
        label: "Reportes",
        description: "Revisión, impresión y envío",
        icon: FileClock,
        permissions: ["reports.generate"],
      },
    ],
  },
  {
    id: "administration",
    label: "Administración",
    icon: Settings2,
    items: [
      {
        to: "/usuarios",
        label: "Usuarios y permisos",
        description: "Acceso interno",
        icon: UserRoundCog,
        permissions: ["users.read"],
      },
      {
        to: "/catalogos",
        label: "Catálogos",
        description: "Procesos y requisitos",
        icon: Settings2,
        permissions: ["catalogs.manage"],
      },
      {
        to: "/auditoria",
        label: "Auditoría",
        description: "Trazabilidad completa",
        icon: FileClock,
        permissions: ["audit.read"],
      },
      {
        to: "/retencion",
        label: "Retención",
        description: "Vista previa de depuración",
        icon: ShieldCheck,
        permissions: ["retention.preview"],
      },
    ],
  },
];

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(
    () => new Set(navigationGroups.map((group) => group.id)),
  );
  const { user, logout } = useAuth();
  const location = useLocation();
  const breadcrumb = getBreadcrumb(location.pathname);
  const hasAnyPermission = (permissions: string[]) =>
    Boolean(
      user?.permissions.includes("*") ||
        permissions.some((permission) =>
          user?.permissions.includes(permission),
        ),
    );
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyPermission(item.permissions)),
    }))
    .filter((group) => group.items.length > 0);
  const canAdministerUsers = hasAnyPermission(["users.read"]);
  const isStudent =
    hasAnyPermission(["cases.assigned.read"]) &&
    !hasAnyPermission(["cases.read"]);
  const canGlobalSearch = hasAnyPermission(["clients.read"]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const toggleGroup = (groupId: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  return (
    <div className="app-viewport">
      <div className="app-shell">
        <aside
          className={`app-sidebar ${mobileOpen ? "app-sidebar--open" : ""}`}
          aria-label="Navegación principal"
        >
          <div className="sidebar-brand">
            <img src="/umg.png" alt="Universidad Mariano Gálvez" />
            <span>
              <strong>Bufete Jurídico</strong>
              <small>Clínica universitaria</small>
            </span>
            <IconButton
              label="Cerrar navegación"
              className="sidebar-close"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </IconButton>
          </div>
          <nav className="sidebar-nav">
            <span className="sidebar-nav__eyebrow">ESPACIO DE TRABAJO</span>
            <NavLink
              to={isStudent ? "/expedientes" : "/"}
              end
              className={({ isActive }) =>
                `sidebar-home ${isActive ? "active" : ""}`
              }
            >
              <span>
                <LayoutDashboard size={19} />
              </span>
              <span>
                <strong>{isStudent ? "Mis casos" : "Resumen operativo"}</strong>
                <small>
                  {isStudent
                    ? "Expedientes asignados"
                    : "Prioridades y movimiento"}
                </small>
              </span>
            </NavLink>
            {visibleGroups.map((group) => {
              const expanded = openGroups.has(group.id);
              const groupActive = group.items.some(
                (item) =>
                  location.pathname === item.to ||
                  location.pathname.startsWith(`${item.to}/`),
              );
              const GroupIcon = group.icon;
              return (
                <div
                  className={`nav-group ${groupActive ? "nav-group--active" : ""}`}
                  key={group.id}
                >
                  <button
                    type="button"
                    className="nav-group__trigger"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={expanded}
                    aria-controls={`nav-group-${group.id}`}
                  >
                    <span>
                      <GroupIcon size={18} />
                    </span>
                    <strong>{group.label}</strong>
                    <ChevronDown
                      className={expanded ? "expanded" : ""}
                      size={16}
                    />
                  </button>
                  <div
                    className={`nav-group__items ${expanded ? "expanded" : ""}`}
                    id={`nav-group-${group.id}`}
                  >
                    {group.items.map((item) => (
                      <SidebarLink key={item.to} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <span className="sidebar-footer__mode">
              <i />
              {dataSource.mode === "mock"
                ? "Datos de demostración"
                : "Conexión activa"}
            </span>
            <div>
              <Avatar
                name={user?.fullName ?? "Usuario UMG"}
                documentId={user?.photoDocumentId}
              />
              <span>
                <strong>{user?.fullName}</strong>
                <small>{user?.roles.join(", ")}</small>
              </span>
              <IconButton label="Cerrar sesión" onClick={() => void logout()}>
                <LogOut size={17} />
              </IconButton>
            </div>
          </div>
        </aside>
        {mobileOpen && (
          <button
            type="button"
            className="sidebar-scrim"
            aria-label="Cerrar navegación"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <header className="topbar">
          <div className="topbar__context">
            <IconButton
              label="Abrir navegación"
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </IconButton>
            <span>
              <small>{breadcrumb.section}</small>
              <strong>{breadcrumb.page}</strong>
            </span>
          </div>
          {canGlobalSearch ? (
            <button
              className="global-search-trigger"
              type="button"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
              <span>Buscar cliente, alumno o expediente</span>
              <kbd>Ctrl K</kbd>
            </button>
          ) : (
            <div />
          )}
          <div className="topbar__actions">
            <IconButton label="Notificaciones" className="notification-button">
              <Bell size={20} />
              <span className="notification-dot" />
            </IconButton>
            <button
              className="profile-trigger"
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
            >
              <Avatar
                name={user?.fullName ?? "Usuario UMG"}
                documentId={user?.photoDocumentId}
              />
              <span className="profile-trigger__copy">
                <strong>{user?.fullName ?? user?.username}</strong>
                <small>
                  {user?.roles[0] === "AdministradorGeneral"
                    ? "Administrador"
                    : user?.roles[0]}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu__header">
                  <Avatar
                    name={user?.fullName ?? "Usuario UMG"}
                    documentId={user?.photoDocumentId}
                    size="lg"
                  />
                  <div>
                    <strong>{user?.fullName}</strong>
                    <span>{user?.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setAccountOpen(true);
                  }}
                >
                  <UserRoundCog size={17} />
                  Mi perfil y seguridad
                </button>
                {canAdministerUsers && (
                  <NavLink to="/usuarios">
                    <Settings2 size={17} />
                    Administrar usuarios
                  </NavLink>
                )}
                <button type="button" onClick={() => void logout()}>
                  <LogOut size={17} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        {canGlobalSearch && (
          <SearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
          />
        )}
        <AccountDialog
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
        />
      </div>
    </div>
  );
}

function AccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, loading, updateProfile, updatePhoto, changePassword, logout } =
    useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.fullName);
    setEmail(user.email);
    setPhoto(null);
    setError(null);
    setNotice(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [open, user]);

  const saveProfile = async () => {
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ fullName: fullName.trim(), email: email.trim() });
      if (photo) await updatePhoto(photo);
      setPhoto(null);
      setNotice("Perfil actualizado correctamente.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar el perfil.",
      );
    }
  };

  const savePassword = async () => {
    setError(null);
    setNotice(null);
    if (newPassword !== confirmPassword) {
      setError("La confirmación de la contraseña no coincide.");
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setNotice(
        "Contraseña actualizada. Por seguridad debe iniciar sesión nuevamente.",
      );
      setTimeout(() => void logout(), 900);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cambiar la contraseña.",
      );
    }
  };

  return (
    <Modal
      size="lg"
      open={open}
      onClose={onClose}
      title="Mi perfil"
      description="Información personal y seguridad de la cuenta."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            disabled={loading || !fullName.trim() || !email.trim()}
            onClick={saveProfile}
          >
            {loading ? "Guardando…" : "Guardar perfil"}
          </Button>
        </>
      }
    >
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="operation-notice" role="status">
          {notice}
        </div>
      )}
      <div className="account-profile-summary">
        <Avatar
          name={user?.fullName ?? "Usuario UMG"}
          documentId={user?.photoDocumentId}
          size="lg"
        />
        <div>
          <strong>{user?.username}</strong>
          <span>{user?.roles.join(", ")}</span>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Nombre completo">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>
        <Field label="Correo institucional">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
      </div>
      <FilePicker
        label="Fotografía de perfil"
        hint="JPG, PNG o WEBP · visible en el perfil"
        file={photo}
        onChange={setPhoto}
        accept="image/png,image/jpeg,image/webp"
      />
      <section className="account-security">
        <div>
          <KeyRound size={20} />
          <span>
            <strong>Cambiar contraseña</strong>
            <small>
              Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo.
            </small>
          </span>
        </div>
        <div className="form-grid">
          <Field label="Contraseña actual">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field label="Nueva contraseña">
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirmar nueva contraseña">
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          disabled={
            loading || !currentPassword || !newPassword || !confirmPassword
          }
          onClick={savePassword}
        >
          Actualizar contraseña
        </Button>
      </section>
    </Modal>
  );
}

function SidebarLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={`${item.label}: ${item.description}`}
      className={({ isActive }) => (isActive ? "active" : "")}
    >
      <span className="nav-item__icon">
        <Icon size={17} />
      </span>
      <span>
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
      <ChevronRight size={14} />
    </NavLink>
  );
}

function getBreadcrumb(pathname: string) {
  if (pathname === "/") return { section: "Inicio", page: "Resumen operativo" };
  if (pathname.startsWith("/expedientes/"))
    return {
      section: "Gestión jurídica / Expedientes",
      page: "Detalle del expediente",
    };
  if (pathname === "/expedientes")
    return { section: "Gestión jurídica", page: "Expedientes" };
  if (pathname.startsWith("/personas/clientes/"))
    return {
      section: "Gestión jurídica / Clientes",
      page: "Expediente del cliente",
    };
  if (pathname === "/personas/clientes")
    return { section: "Gestión jurídica", page: "Clientes" };
  if (pathname.startsWith("/personas/alumnos/"))
    return {
      section: "Práctica académica / Alumnos",
      page: "Perfil del alumno",
    };
  if (pathname === "/personas/alumnos")
    return { section: "Práctica académica", page: "Alumnos" };
  const known: Record<string, { section: string; page: string }> = {
    "/documentos": { section: "Gestión jurídica", page: "Archivo digital" },
    "/actividades": { section: "Operación interna", page: "Actividades" },
    "/reportes": { section: "Operación interna", page: "Reportes" },
    "/usuarios": { section: "Administración", page: "Usuarios y permisos" },
    "/catalogos": { section: "Administración", page: "Catálogos" },
    "/auditoria": { section: "Administración", page: "Auditoría" },
    "/retencion": { section: "Administración", page: "Retención y depuración" },
  };
  return (
    known[pathname] ?? { section: "Bufete Jurídico", page: "Módulo interno" }
  );
}

function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const loader = useMemo(
    () => () =>
      term.trim().length >= 2
        ? dataSource.search(term.trim())
        : Promise.resolve({
            items: [] as SearchResult[],
            page: 1,
            pageSize: 25,
            totalCount: 0,
            totalPages: 0,
          }),
    [term],
  );
  const { data, loading } = useAsyncData(loader, [term]);
  if (!open) return null;
  const openResult = (result: SearchResult) => {
    onClose();
    if (result.resultType === "Client")
      navigate(`/personas/clientes/${result.id}`);
    else if (result.resultType === "Student")
      navigate(`/personas/alumnos/${result.id}`);
    else navigate(`/expedientes/${result.id}`);
  };
  return (
    <div
      className="search-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda global"
      >
        <div className="search-dialog__input">
          <Search size={22} />
          <input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar cliente, alumno o expediente…"
            aria-label="Término de búsqueda"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-dialog__body">
          {term.length < 2 ? (
            <div className="search-hint">
              <SlidersHorizontal size={22} />
              <p>Escriba al menos dos caracteres: nombre, carné o expediente.</p>
            </div>
          ) : loading ? (
            <div className="search-hint">Buscando coincidencias…</div>
          ) : data?.items.length ? (
            data.items.map((result) => (
              <button
                type="button"
                key={`${result.resultType}-${result.id}`}
                className="search-result"
                onClick={() => openResult(result)}
              >
                <span className="search-result__icon">
                  {result.resultType === "Client" ? (
                    <UsersRound size={19} />
                  ) : result.resultType === "Student" ? (
                    <BookOpenCheck size={19} />
                  ) : (
                    <FolderKanban size={19} />
                  )}
                </span>
                <span>
                  <strong>{result.displayName}</strong>
                  <small>{result.secondaryText}</small>
                  {result.lastStep && (
                    <small>Último paso: {result.lastStep}</small>
                  )}
                </span>
                <Badge tone="blue">
                  {result.resultType === "Client"
                    ? "Cliente"
                    : result.resultType === "Student"
                      ? "Alumno"
                      : "Expediente"}
                </Badge>
              </button>
            ))
          ) : (
            <div className="search-hint">
              No encontramos coincidencias para “{term}”.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
