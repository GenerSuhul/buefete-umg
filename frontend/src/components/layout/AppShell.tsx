import {
  Activity,
  Bell,
  BookOpenCheck,
  Building2,
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
import { WorkspaceContext } from "../../demo/WorkspaceContext";
import { practiceNotices, type PracticeNotice } from "../../data/practiceNotices";
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
  platformOnly?: boolean;
  seatOnly?: boolean;
  administratorOnly?: boolean;
  nativeOnly?: boolean;
  hideForStudent?: boolean;
}

interface NavigationGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
}

const fluentNavigationIcons = new Map([
  [LayoutDashboard, Home20Regular], [ShieldCheck, Shield20Regular],
  [Building2, Building20Regular],
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
    id: 'platform', label: 'Administración global', icon: Building2,
    items: [
      { to: '/sedes', label: 'Bufetes y sedes', description: 'Crear y administrar sedes', icon: Building2, permissions: [], platformOnly: true },
      { to: '/vetos', label: 'Lista negra global', description: 'Atención bloqueada por DPI', icon: ShieldCheck, permissions: ['clients.write'], platformOnly: true },
    ],
  },
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
        label: "Usuarios atendidos",
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
        hideForStudent: true,
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
      {
        to: "/personas/alumnos/cierre-practica",
        label: "Cierre de práctica",
        description: "Alumnos que finalizaron",
        icon: ClipboardList,
        permissions: ["students.read"],
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
    label: "Administración de sede",
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
        to: '/vetos', label: 'Lista negra', description: 'Emitidos por esta sede', icon: ShieldCheck,
        permissions: ['clients.write'], administratorOnly: true, seatOnly: true,
      },
    ],
  },
  {
    id: 'governance', label: 'Control y trazabilidad', icon: ShieldCheck,
    items: [
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
  const [workspacePlatformAdmin,setWorkspacePlatformAdmin]=useState(false);
  const pageRef = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [notices, setNotices] = useState<PracticeNotice[]>([]);
  const [noticesError, setNoticesError] = useState('');
  const sounding = useRef(new Set<string>());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState(
    () => new Set(navigationGroups.map((group) => group.id)),
  );
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdminCenter = demoEnabled ? workspacePlatformAdmin : Boolean(user?.isPlatformAdmin);
  const location = useLocation();
  const breadcrumb = getBreadcrumb(location.pathname, isAdminCenter);
  const hasAnyPermission = (permissions: string[]) =>
    Boolean(
      user?.permissions.includes("*") ||
        permissions.some((permission) =>
          user?.permissions.includes(permission),
        ),
    );
  const isStudent =
    hasAnyPermission(["cases.assigned.read"]) &&
    !hasAnyPermission(["cases.read"]);
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (!item.nativeOnly || !demoEnabled) &&
        (!item.platformOnly || isAdminCenter) &&
        (!item.seatOnly || !isAdminCenter) &&
        (!item.administratorOnly || user?.roles.includes('Administrador') || (demoEnabled && user?.roles.includes('AdministradorGeneral'))) &&
        (!item.hideForStudent || !isStudent) &&
        (item.platformOnly ? isAdminCenter : hasAnyPermission(item.permissions))),
    }))
    .filter((group) => group.items.length > 0);
  const canAdministerUsers = hasAnyPermission(["users.read"]);
  const canGlobalSearch = hasAnyPermission(["clients.read"]);
  const canReadPracticeNotices = hasAnyPermission(["students.read"]);
  const unreadNotices = notices.filter((notice) => !notice.isRead).length;
  const soundNotice = async (notice: PracticeNotice) => {
    if (sounding.current.has(notice.id)) return;
    sounding.current.add(notice.id);
    try {
      const audio = new AudioContext();
      let timeout: number | undefined;
      const resumed = await Promise.race([
        audio.resume().then(() => true),
        new Promise<false>((resolve) => { timeout = window.setTimeout(() => resolve(false), 1500); }),
      ]);
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (!resumed || audio.state !== 'running') { await audio.close(); sounding.current.delete(notice.id); return; }
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.04, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.24);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + 0.24);
      oscillator.onended = () => { void audio.close(); };
      await practiceNotices.sounded(notice.id);
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, isSounded: true } : item));
    } catch { sounding.current.delete(notice.id); }
  };
  useEffect(() => {
    if (!canReadPracticeNotices) return;
    let active = true;
    const refresh = async () => {
      try {
        const rows = await practiceNotices.list();
        if (!active) return;
        setNotices(rows);
        setNoticesError('');
        const next = rows.find((notice) => !notice.isRead && !notice.isSounded && !sounding.current.has(notice.id));
        if (!next) return;
        void soundNotice(next);
      } catch (reason) { if (active) setNoticesError(reason instanceof Error ? reason.message : 'No se pudieron consultar las notificaciones.'); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [canReadPracticeNotices]);
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
            {visibleGroups.filter(group => group.id === 'platform').map(group => <SidebarGroup key={group.id} group={group} expanded={openGroups.has(group.id)} fluent={true} pathname={location.pathname} onToggle={toggleGroup} />)}
            <div className="sidebar-seat-context" aria-label="Contexto de sede">
              <span>{isAdminCenter ? 'Operación de sede' : 'Mi sede'}</span>
              <strong title={demoEnabled ? workspaceName : user?.tenantName ?? 'Petén'}>{demoEnabled ? workspaceName : user?.tenantName ?? 'Petén'}</strong>
              <small>Registros y personal de este espacio</small>
            </div>
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
                <NavigationIcon icon={LayoutDashboard} fluent={true} size={19} />
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
            {visibleGroups.filter(group => group.id !== 'platform').map(group => <SidebarGroup key={group.id} group={group} expanded={openGroups.has(group.id)} fluent={true} pathname={location.pathname} onToggle={toggleGroup} />)}
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
            {canReadPracticeNotices && <div className="notification-wrap"><IconButton label={`Notificaciones${unreadNotices ? `, ${unreadNotices} nuevas` : ''}`} className="notification-button" onClick={() => { setNoticesOpen((open) => !open); const next = notices.find((notice) => !notice.isRead && !notice.isSounded); if (next) void soundNotice(next); }}>
              <Bell size={20} />
              {unreadNotices > 0 && <span className="notification-count">{unreadNotices > 99 ? '99+' : unreadNotices}</span>}
            </IconButton>{noticesOpen && <div className="notification-panel" role="region" aria-label="Notificaciones de práctica"><strong>Próximos cierres de práctica</strong>{noticesError && <p role="alert">{noticesError}</p>}{!noticesError && notices.length === 0 && <p>Sin avisos pendientes.</p>}{notices.map((notice) => <button type="button" key={notice.id} className={notice.isRead ? 'notification-item is-read' : 'notification-item'} onClick={async () => { try { await practiceNotices.read(notice.id); setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, isRead: true } : item)); setNoticesOpen(false); navigate(`/personas/alumnos/${notice.studentId}`); } catch (reason) { setNoticesError(reason instanceof Error ? reason.message : 'No se pudo abrir el aviso.'); } }}><span>{notice.studentName}</span><small>La práctica finaliza el {notice.endDate}. {notice.daysRemaining === 0 ? 'Hoy es el último día.' : `Faltan ${notice.daysRemaining} días.`}</small></button>)}</div>}</div>}
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
          {demoEnabled && <WorkspaceContext onWorkspaceName={setWorkspaceName} onPlatformAdmin={setWorkspacePlatformAdmin} />}
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

function SidebarGroup({ group, expanded, fluent, pathname, onToggle }: { group: NavigationGroup; expanded: boolean; fluent: boolean; pathname: string; onToggle: (id: string) => void }) {
  const active = group.items.some(item => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return <div className={`nav-group ${active ? 'nav-group--active' : ''}`} data-module={group.id}>
    <button type="button" className="nav-group__trigger" onClick={() => onToggle(group.id)} aria-expanded={expanded} aria-controls={`nav-group-${group.id}`}>
      <span><NavigationIcon icon={group.icon} fluent={fluent} size={18} /></span><strong>{group.label}</strong><ChevronDown className={expanded ? 'expanded' : ''} size={16} />
    </button>
    <div className={`nav-group__items ${expanded ? 'expanded' : ''}`} id={`nav-group-${group.id}`}>
      {group.items.map(item => <SidebarLink key={item.to} item={item} fluent={fluent} />)}
    </div>
  </div>;
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

function getBreadcrumb(pathname: string, platform = false) {
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
    "/sedes": { section: "Administración global", page: "Bufetes y sedes" },
    "/vetos": { section: platform ? 'Administración global' : 'Administración de sede', page: platform ? 'Lista negra global' : 'Lista negra' },
    "/documentos": { section: "Gestión jurídica", page: "Archivo digital" },
    "/actividades": { section: "Operación interna", page: "Actividades" },
    "/reportes": { section: "Operación interna", page: "Reportes" },
    "/usuarios": { section: "Administración de sede", page: "Accesos y personal" },
    "/catalogos": { section: "Administración de sede", page: "Catálogos" },
    "/auditoria": { section: "Control y trazabilidad", page: "Auditoría" },
    "/eliminados": { section: "Control y trazabilidad", page: "Eliminados" },
    "/retencion": { section: "Control y trazabilidad", page: "Retención y depuración" },
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
