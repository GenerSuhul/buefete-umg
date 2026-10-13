import {
  Activity,
  Bell,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
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
  Trash2,
  UserRoundCog,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Home20Regular } from "@fluentui/react-icons/svg/home";
import { Building20Regular } from "@fluentui/react-icons/svg/building";
import { People20Regular } from "@fluentui/react-icons/svg/people";
import { Folder20Regular } from "@fluentui/react-icons/svg/folder";
import { Book20Regular } from "@fluentui/react-icons/svg/book";
import { DocumentTable20Regular } from "@fluentui/react-icons/svg/document-table";
import { DocumentCopy20Regular } from "@fluentui/react-icons/svg/document-copy";
import { TaskListSquareLtr20Regular } from "@fluentui/react-icons/svg/task-list-square-ltr";
import { Pulse20Regular } from "@fluentui/react-icons/svg/pulse";
import { Settings20Regular } from "@fluentui/react-icons/svg/settings";
import { PersonAccounts20Regular } from "@fluentui/react-icons/svg/person-accounts";
import { Shield20Regular } from "@fluentui/react-icons/svg/shield";
import { Delete20Regular } from "@fluentui/react-icons/svg/delete";
import { PanelLeftContract20Regular } from "@fluentui/react-icons/svg/panel-left-contract";
import { PanelLeftExpand20Regular } from "@fluentui/react-icons/svg/panel-left-expand";
import { NavLink, useLocation, useNavigate } from "../../routing/navigation";
import { useAuth } from "../../context/AuthContext";
import { dataSource } from "../../data/dataSource";
import { demoEnabled } from "../../demo/client";
import { WorkspaceBanner } from "../../demo/WorkspaceBanner";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { SearchResult } from "../../types/domain";
import { translate } from "../../utils/format";
import {
  Avatar,
  Badge,
  IconButton,
} from "../ui";
import { motion, type MotionHandle } from "../ui/motion/motion";

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

const fluentNavigationIcons = new Map([
  [LayoutDashboard, Home20Regular], [ShieldCheck, Shield20Regular],
  [FolderKanban, Folder20Regular], [UsersRound, People20Regular],
  [FileStack, DocumentCopy20Regular], [BookOpenCheck, Book20Regular],
  [Activity, Pulse20Regular], [ClipboardList, TaskListSquareLtr20Regular],
  [FileClock, DocumentTable20Regular], [Settings2, Settings20Regular],
  [UserRoundCog, PersonAccounts20Regular], [Trash2, Delete20Regular],
]);

function NavigationIcon({ icon: Icon, fluent, size = 20 }: { icon: LucideIcon; fluent: boolean; size?: number }) {
  const FluentIcon = fluent ? fluentNavigationIcons.get(Icon) : undefined;
  return FluentIcon ? <FluentIcon aria-hidden="true" width={20} height={20} /> : <Icon size={size} aria-hidden="true" />;
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
        label: "Usuarios",
        description: "Atención y papelería",
        icon: UsersRound,
        permissions: ["clients.read"],
      },
      {
        to: "/documentos",
        label: "Archivo digital",
        description: "Documentos y escáner",
        icon: FileStack,
        permissions: ["documents.read"],
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
        label: "Accesos y personal",
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
        to: "/eliminados",
        label: "Eliminados",
        description: "Restauración de registros",
        icon: Trash2,
        permissions: ["records.deleted.read"],
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

export function AppShell({ children }: { children: ReactNode }) {
  const [workspaceName,setWorkspaceName]=useState('Verificando sede…');
  const pageRef = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState(
    () => new Set(navigationGroups.map((group) => group.id)),
  );
  const { user, logout } = useAuth();
  const isAdminCenter = !demoEnabled && Boolean(user?.isPlatformAdmin);
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
  const [platformStatus, setPlatformStatus] = useState<
    "checking" | "available" | "unavailable"
  >(dataSource.mode === "mock" ? "available" : "checking");

  useEffect(() => {
    if (dataSource.mode === "mock") return;
    let active = true;
    let requestInProgress = false;

    const checkPlatform = async () => {
      if (requestInProgress) return;
      if (!navigator.onLine) {
        if (active) setPlatformStatus("unavailable");
        return;
      }
      requestInProgress = true;
      try {
        const health = await dataSource.getPlatformHealth();
        if (active)
          setPlatformStatus(
            health.status === "Healthy" ? "available" : "unavailable",
          );
      } catch {
        if (active) setPlatformStatus("unavailable");
      } finally {
        requestInProgress = false;
      }
    };

    void checkPlatform();
    const interval = window.setInterval(() => void checkPlatform(), 30_000);
    window.addEventListener("online", checkPlatform);
    const markOffline = () => setPlatformStatus("unavailable");
    window.addEventListener("offline", markOffline);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", checkPlatform);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    let animation: MotionHandle | null = null;
    const frame = window.requestAnimationFrame(() => {
      if (pageRef.current) animation = motion.routeEnter(pageRef.current);
    });
    return () => { window.cancelAnimationFrame(frame); animation?.cancel(); };
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
    <div className={`app-viewport${isAdminCenter ? " admin-center" : ""}${isAdminCenter && sidebarCollapsed ? " admin-center--collapsed" : ""}`}>
      <div className="app-shell">
        <aside
          className={`app-sidebar ${mobileOpen ? "app-sidebar--open" : ""}`}
          aria-label="Navegación principal"
        >
          <div className="sidebar-brand">
            <img src="/umg.png" alt="Universidad Mariano Gálvez" />
            <span>
              <strong>Bufete Popular UMG</strong>
              <small>{demoEnabled ? workspaceName : /^sede\b/i.test(user?.tenantName ?? '') ? user?.tenantName : `Sede ${user?.tenantName ?? 'Petén'}`}</small>
            </span>
            {isAdminCenter && <IconButton
              label={sidebarCollapsed ? "Expandir navegación" : "Contraer navegación"}
              className="sidebar-collapse"
              aria-expanded={!sidebarCollapsed}
              aria-controls="workspace-navigation"
              onClick={() => setSidebarCollapsed(current => !current)}
            >{sidebarCollapsed ? <PanelLeftExpand20Regular aria-hidden="true" /> : <PanelLeftContract20Regular aria-hidden="true" />}</IconButton>}
            <IconButton
              label="Cerrar navegación"
              className="sidebar-close"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </IconButton>
          </div>
          <nav className="sidebar-nav" id="workspace-navigation">
            <span className="sidebar-nav__eyebrow">ESPACIO DE TRABAJO</span>
            {!demoEnabled && user?.roles.includes('Administrador') && <NavLink to="/vetos" title="Vetos de atención" aria-label="Vetos de atención" className={({ isActive }) => `sidebar-home ${isActive ? 'active' : ''}`}><span><ShieldCheck size={20} /></span><span><strong>Vetos de atención</strong><small>Control global por DPI</small></span></NavLink>}
            {isAdminCenter && <NavLink to="/sedes" title="Administración de sedes" aria-label="Administración de sedes" className={({ isActive }) => `sidebar-home ${isActive ? "active" : ""}`}><span><Building20Regular aria-hidden="true" /></span><span><strong>Administración de sedes</strong><small>Superusuario</small></span></NavLink>}
            <NavLink
              to={isStudent ? "/expedientes" : "/"}
              end
              title={isStudent ? "Mis casos" : "Resumen operativo"}
              aria-label={isStudent ? "Mis casos" : "Resumen operativo"}
              className={({ isActive }) =>
                `sidebar-home ${isActive ? "active" : ""}`
              }
            >
              <span>
                <NavigationIcon icon={LayoutDashboard} fluent={isAdminCenter} size={19} />
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
                      <NavigationIcon icon={GroupIcon} fluent={isAdminCenter} size={18} />
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
                      <SidebarLink key={item.to} item={item} fluent={isAdminCenter} />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <span
              className={`sidebar-footer__mode sidebar-footer__mode--${platformStatus}`}
              role="status"
              aria-live="polite"
            >
              <i />
              {dataSource.mode === "mock"
                ? "Datos de demostración"
                : platformStatus === "available"
                  ? "Servicios disponibles"
                  : platformStatus === "unavailable"
                    ? "Servicio no disponible"
                    : "Verificando servicios"}
            </span>
            <div>
              <Avatar
                name={user?.fullName ?? "Usuario UMG"}
                documentId={user?.photoDocumentId}
              />
              <span>
                <strong>{user?.fullName}</strong>
                <small>{user?.isPlatformAdmin ? "Superusuario" : user?.roles.map(translate).join(", ")}</small>
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
              <span>Buscar usuario, alumno o expediente</span>
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
                  {user?.isPlatformAdmin ? "Superusuario" : user?.roles[0] ? translate(user.roles[0]) : "Sin rol"}
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
                <NavLink
                  to="/mi-cuenta"
                  onClick={() => {
                    setProfileOpen(false);
                  }}
                >
                  <UserRoundCog size={17} />
                  Mi perfil y seguridad
                </NavLink>
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
        <main className="page-content" ref={pageRef}>
          {demoEnabled && <WorkspaceBanner onWorkspaceName={setWorkspaceName} />}
          {children}
        </main>
        {canGlobalSearch && (
          <SearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function SidebarLink({ item, fluent = false }: { item: NavigationItem; fluent?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={`${item.label}: ${item.description}`}
      title={item.label}
      className={({ isActive }) => (isActive ? "active" : "")}
    >
      <span className="nav-item__icon">
        <NavigationIcon icon={item.icon} fluent={fluent} size={17} />
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
      section: "Gestión jurídica / Usuarios",
      page: "Expediente del usuario",
    };
  if (pathname === "/personas/clientes")
    return { section: "Gestión jurídica", page: "Usuarios" };
  if (pathname.startsWith("/personas/alumnos/"))
    return {
      section: "Práctica académica / Alumnos",
      page: "Perfil del alumno",
    };
  if (pathname === "/personas/alumnos")
    return { section: "Práctica académica", page: "Alumnos" };
  const known: Record<string, { section: string; page: string }> = {
    "/sedes": { section: "Administración de plataforma", page: "Bufetes y sedes" },
    "/documentos": { section: "Gestión jurídica", page: "Archivo digital" },
    "/actividades": { section: "Operación interna", page: "Actividades" },
    "/reportes": { section: "Operación interna", page: "Reportes" },
    "/usuarios": { section: "Administración", page: "Accesos y personal" },
    "/catalogos": { section: "Administración", page: "Catálogos" },
    "/auditoria": { section: "Administración", page: "Auditoría" },
    "/eliminados": { section: "Administración", page: "Eliminados" },
    "/retencion": { section: "Administración", page: "Retención y depuración" },
    "/mi-cuenta": { section: "Cuenta", page: "Mi perfil y seguridad" },
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
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedTerm(term.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [term]);
  const loader = useMemo(
    () => () =>
      debouncedTerm.length >= 2
        ? dataSource.search(debouncedTerm)
        : Promise.resolve({
            items: [] as SearchResult[],
            page: 1,
            pageSize: 25,
            totalCount: 0,
            totalPages: 0,
          }),
    [debouncedTerm],
  );
  const { data, loading } = useAsyncData(loader, [debouncedTerm]);
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
            placeholder="Buscar usuario, alumno o expediente…"
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
                    ? "Usuario"
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
