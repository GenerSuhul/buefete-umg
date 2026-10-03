import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FolderKanban,
  Minus,
  Plus,
} from "lucide-react";
import { Link } from "../routing/navigation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  OpenAction,
  PageHeader,
  SectionHeading,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { dataSource } from "../data/dataSource";
import { useAsyncData } from "../hooks/useAsyncData";
import type { DashboardData } from "../types/domain";
import { formatDateTime, statusTone, translate } from "../utils/format";

function ChangeBadge({
  value,
  suffix = "vs. período anterior",
  compact = false,
}: {
  value: number | null;
  suffix?: string;
  compact?: boolean;
}) {
  if (value === null)
    return (
      <Badge tone="neutral">
        <Minus size={12} />{" "}
        {compact ? "Sin referencia" : "Sin base comparativa"}
      </Badge>
    );
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const sign = value > 0 ? "+" : "";
  return (
    <Badge tone={value > 0 ? "success" : value < 0 ? "warning" : "neutral"}>
      <Icon size={12} /> {sign}
      {value}%{suffix ? ` ${suffix}` : ""}
    </Badge>
  );
}

function PracticeTeamAvatars({
  members,
  limit,
  size,
}: {
  members: DashboardData["practiceTeam"];
  limit: number;
  size: "sm" | "lg";
}) {
  const visibleMembers = members.slice(0, limit);
  const remaining = members.length - visibleMembers.length;
  return (
    <>
      {visibleMembers.map((student) => (
        <Avatar
          key={student.studentId}
          name={student.fullName}
          documentId={student.photoDocumentId}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <span aria-label={`${remaining} alumnos adicionales`}>
          +{remaining}
        </span>
      )}
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsyncData(
    () => dataSource.getDashboard(),
    [],
  );
  if (loading) return <LoadingState label="Preparando el resumen del bufete" />;
  if (error || !data)
    return (
      <ErrorState error={error ?? new Error("Sin datos")} retry={reload} />
    );

  const maxBar = Math.max(...data.caseSeries.map((item) => item.value), 1);
  const today = new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  const currentYear = new Date().getFullYear();
  const welcomeName =
    user?.fullName
      .replace(/^(Lic\.?|Licenciada|Licenciado)\s+/i, "")
      .split(/\s+/)[0] ?? "equipo";

  return (
    <>
      <PageHeader
        eyebrow="Operación del bufete"
        title={
          <>
            Hola, <em>{welcomeName}</em>
          </>
        }
        description="Resumen de expedientes, documentos y práctica supervisada."
        actions={
          <>
            <span className="date-pill">
              <CalendarDays size={17} />
              {today}
              <span className="date-pill__sep" />
              Ciclo {currentYear}
            </span>
            <Link to="/expedientes">
              <Button>
                <Plus size={18} />
                Nuevo expediente
              </Button>
            </Link>
          </>
        }
      />
      <div className="dashboard-grid">
        <Card className="dashboard-card dashboard-primary">
          <SectionHeading
            title="Expedientes activos"
            description="En recolección, activos o suspendidos"
            action={<OpenAction />}
          />
          <div className="primary-stat">
            <span>CASOS</span>
            <strong>{data.activeCases}</strong>
            <small>
              <ChangeBadge
                value={data.caseMovementChangePercentage}
                suffix="vs. mes anterior"
              />
            </small>
          </div>
          <div className="primary-card__footer">
            <div>
              <span>En recolección</span>
              <strong>{data.documentCollectionCases}</strong>
            </div>
            {data.practiceTeam.length > 0 && (
              <div className="avatar-stack">
                <PracticeTeamAvatars
                  members={data.practiceTeam}
                  limit={3}
                  size="sm"
                />
              </div>
            )}
          </div>
        </Card>

        <Card className="dashboard-card chart-card">
          <SectionHeading
            title="Movimiento de expedientes"
            description="Casos distintos con actuaciones registradas por mes"
            action={<span className="chart-period">Últimos 6 meses</span>}
          />
          <div
            className="bar-chart"
            role="img"
            aria-label="Casos con actuaciones registradas durante los últimos seis meses"
          >
            {data.caseSeries.map((item, index) => {
              const isEmpty = item.value === 0;
              return (
                <div
                  className={`bar-chart__item ${index === data.caseSeries.length - 1 ? "is-current" : ""} ${isEmpty ? "is-empty" : ""}`}
                  key={item.label}
                  aria-label={`${item.label}: ${item.value} casos`}
                >
                  <span className="bar-chart__value">{item.value}</span>
                  <span className="bar-chart__slot">
                    <span
                      className="bar-chart__bar"
                      style={{
                        height: isEmpty
                          ? "0%"
                          : `${(item.value / maxBar) * 100}%`,
                      }}
                    />
                  </span>
                  <small>{item.label}</small>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="dashboard-card trend-card">
          <SectionHeading
            title="Completitud documental"
            description="Requisitos aplicables en expedientes activos"
            action={<OpenAction />}
          />
          <div className="trend-stat">
            <span>Cumplimiento global</span>
            <strong>
              {data.completionRate}
              <small>%</small>
            </strong>
          </div>
          <div
            className="completion-meter"
            role="progressbar"
            aria-label="Completitud documental"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={data.completionRate}
          >
            <span style={{ width: `${data.completionRate}%` }} />
          </div>
          <p className="completion-caption">
            {data.totalRequirements === 0
              ? "Aún no hay requisitos aplicables para medir."
              : `${data.completedRequirements} de ${data.totalRequirements} requisitos aceptados o no aplicables.`}
          </p>
          <div className="trend-card__footer">
            <span>
              <CheckCircle2 size={15} /> {data.completedRequirements} validados
            </span>
            <span>
              <Clock3 size={15} /> {data.pendingRequirements} pendientes
            </span>
          </div>
        </Card>

        <Card className="dashboard-card kpi-card">
          <span className="kpi-icon">
            <FileCheck2 size={20} />
          </span>
          <div>
            <small>Actividades en los últimos 7 días</small>
            <strong>{data.weeklyActivities}</strong>
          </div>
          <ChangeBadge
            value={data.weeklyActivityChangePercentage}
            suffix=""
            compact
          />
        </Card>

        <Card className="dashboard-card recent-cases">
          <SectionHeading
            title="Expedientes recientes"
            description="Últimos expedientes abiertos y su movimiento más reciente"
            action={
              <Link to="/expedientes">
                <OpenAction label="Ver expedientes" />
              </Link>
            }
          />
          {data.recentCases.length === 0 ? (
            <p className="dashboard-empty">
              Todavía no hay expedientes registrados.
            </p>
          ) : (
            <div className="compact-table">
              <div className="compact-table__head">
                <span>Expediente</span>
                <span>Responsable</span>
                <span>Estado</span>
                <span>Último movimiento</span>
              </div>
              {data.recentCases.map((legalCase) => {
                const responsible =
                  legalCase.assignments.find(
                    (assignment) =>
                      assignment.status === "Active" && assignment.isPrimary,
                  ) ??
                  legalCase.assignments.find(
                    (assignment) => assignment.status === "Active",
                  );
                return (
                  <Link
                    className="compact-table__row"
                    to={`/expedientes/${legalCase.id}`}
                    key={legalCase.id}
                  >
                    <span className="case-cell">
                      <span className="row-icon">
                        <FolderKanban size={17} />
                      </span>
                      <span>
                        <strong>{legalCase.caseNumber}</strong>
                        <small>{legalCase.clientName}</small>
                      </span>
                    </span>
                    <span className="person-cell">
                      <Avatar
                        name={responsible?.studentName ?? "Sin asignar"}
                        documentId={responsible?.studentPhotoDocumentId}
                        size="sm"
                      />
                      <span>
                        {responsible?.studentName
                          .split(" ")
                          .slice(0, 2)
                          .join(" ") ?? "Sin asignar"}
                      </span>
                    </span>
                    <Badge tone={statusTone(legalCase.status)}>
                      {translate(legalCase.status)}
                    </Badge>
                    <span className="last-step">
                      <strong>
                        {legalCase.lastStep?.title ?? "Sin movimientos"}
                      </strong>
                      <small>
                        {formatDateTime(legalCase.lastStep?.occurredAtUtc)}
                      </small>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="dashboard-card students-card">
          <SectionHeading
            title="Equipo en práctica"
            description="Alumnos con al menos un caso activo asignado"
            action={
              <Link to="/personas/alumnos">
                <OpenAction />
              </Link>
            }
          />
          {data.practiceTeam.length === 0 ? (
            <p className="dashboard-empty">
              No hay alumnos con casos activos asignados.
            </p>
          ) : (
            <div className="student-highlight">
              <div className="student-highlight__avatars">
                <PracticeTeamAvatars
                  members={data.practiceTeam}
                  limit={4}
                  size="lg"
                />
              </div>
              <strong>{data.activeStudents}</strong>
              <small>alumnos con casos activos</small>
            </div>
          )}
          {data.processDistribution.length > 0 && (
            <div className="distribution">
              <div
                className="distribution__bar"
                aria-label="Distribución de expedientes activos por tipo"
              >
                {data.processDistribution.map((item, index) => (
                  <span
                    key={item.label}
                    title={`${item.label}: ${item.count} casos (${item.value}%)`}
                    style={{ width: `${item.value}%` }}
                    className={`segment-${index + 1}`}
                  />
                ))}
              </div>
              {data.processDistribution.map((item, index) => (
                <div className="distribution__legend" key={item.label}>
                  <span className={`legend-dot segment-${index + 1}`} />
                  <span>
                    {item.label}
                    <small>
                      {item.count} {item.count === 1 ? "caso" : "casos"}
                    </small>
                  </span>
                  <strong>{item.value}%</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
