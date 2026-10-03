import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { AppErrorBoundary } from "../components/ui/AppErrorBoundary";
import { LoadingState } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "../screens/LoginPage";

const ActivitiesPage = lazy(() =>
  import("../screens/ActivitiesPage").then((module) => ({
    default: module.ActivitiesPage,
  })),
);
const AccountPage = lazy(() =>
  import("../screens/AccountPage").then((module) => ({
    default: module.AccountPage,
  })),
);
const adminPages = () => import("../screens/AdminPages");
const AuditPage = lazy(() =>
  adminPages().then((module) => ({ default: module.AuditPage })),
);
const CatalogsPage = lazy(() =>
  adminPages().then((module) => ({ default: module.CatalogsPage })),
);
const RetentionPage = lazy(() =>
  adminPages().then((module) => ({ default: module.RetentionPage })),
);
const UsersPage = lazy(() =>
  adminPages().then((module) => ({ default: module.UsersPage })),
);
const CaseDetailPage = lazy(() =>
  import("../screens/CaseDetailPage").then((module) => ({
    default: module.CaseDetailPage,
  })),
);
const CasesPage = lazy(() =>
  import("../screens/CasesPage").then((module) => ({ default: module.CasesPage })),
);
const ClientDetailPage = lazy(() =>
  import("../screens/ClientDetailPage").then((module) => ({
    default: module.ClientDetailPage,
  })),
);
const ClientsPage = lazy(() =>
  import("../screens/ClientsPage").then((module) => ({
    default: module.ClientsPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../screens/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("../screens/DocumentsPage").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const DeletedRecordsPage = lazy(() =>
  import("../screens/DeletedRecordsPage").then((module) => ({ default: module.DeletedRecordsPage })),
);
const ReportsPage = lazy(() =>
  import("../screens/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const StudentDetailPage = lazy(() =>
  import("../screens/StudentDetailPage").then((module) => ({
    default: module.StudentDetailPage,
  })),
);
const StudentsPage = lazy(() =>
  import("../screens/StudentsPage").then((module) => ({
    default: module.StudentsPage,
  })),
);

function ProtectedShell() {
  const { user } = useAuth();
  return user ? <AppShell><Outlet /></AppShell> : <Navigate to="/acceso" replace />;
}

function Allowed({ any, children }: { any: string[]; children: ReactNode }) {
  const { user } = useAuth();
  const allowed = Boolean(
    user?.permissions.includes("*") ||
      any.some((permission) => user?.permissions.includes(permission)),
  );
  return allowed ? (
    children
  ) : (
    <Navigate
      to={
        user?.permissions.includes("cases.assigned.read") ? "/expedientes" : "/"
      }
      replace
    />
  );
}

function Home() {
  const { user } = useAuth();
  return user?.permissions.includes("cases.assigned.read") &&
    !user.permissions.includes("cases.read") ? (
    <Navigate to="/expedientes" replace />
  ) : (
    <DashboardPage />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingState label="Cargando sección" />}>
        <Routes>
          <Route path="/acceso" element={<LoginPage />} />
          <Route element={<ProtectedShell />}>
            <Route index element={<Home />} />
            <Route path="mi-cuenta" element={<AccountPage />} />
            <Route
              path="expedientes"
              element={
                <Allowed any={["cases.read", "cases.assigned.read"]}>
                  <CasesPage />
                </Allowed>
              }
            />
            <Route
              path="expedientes/:id"
              element={
                <Allowed any={["cases.read", "cases.assigned.read"]}>
                  <CaseDetailPage />
                </Allowed>
              }
            />
            <Route
              path="personas/clientes"
              element={
                <Allowed any={["clients.read"]}>
                  <ClientsPage />
                </Allowed>
              }
            />
            <Route
              path="personas/clientes/:id"
              element={
                <Allowed any={["clients.read"]}>
                  <ClientDetailPage />
                </Allowed>
              }
            />
            <Route
              path="personas/alumnos"
              element={
                <Allowed any={["students.read", "students.self.read"]}>
                  <StudentsPage />
                </Allowed>
              }
            />
            <Route
              path="personas/alumnos/:id"
              element={
                <Allowed any={["students.read", "students.self.read"]}>
                  <StudentDetailPage />
                </Allowed>
              }
            />
            <Route
              path="documentos"
              element={
                <Allowed any={["clients.read"]}>
                  <DocumentsPage />
                </Allowed>
              }
            />
            <Route
              path="actividades"
              element={
                <Allowed any={["activities.read"]}>
                  <ActivitiesPage />
                </Allowed>
              }
            />
            <Route
              path="reportes"
              element={
                <Allowed any={["reports.generate"]}>
                  <ReportsPage />
                </Allowed>
              }
            />
            <Route
              path="eliminados"
              element={<Allowed any={["records.deleted.read"]}><DeletedRecordsPage /></Allowed>}
            />
            <Route
              path="usuarios"
              element={
                <Allowed any={["users.read"]}>
                  <UsersPage />
                </Allowed>
              }
            />
            <Route
              path="auditoria"
              element={
                <Allowed any={["audit.read"]}>
                  <AuditPage />
                </Allowed>
              }
            />
            <Route
              path="retencion"
              element={
                <Allowed any={["retention.preview"]}>
                  <RetentionPage />
                </Allowed>
              }
            />
            <Route
              path="catalogos"
              element={
                <Allowed any={["catalogs.manage"]}>
                  <CatalogsPage />
                </Allowed>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
