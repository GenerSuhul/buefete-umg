# Trazabilidad de requerimientos a implementación

## Matriz

| Capacidad requerida | Implementación backend | Persistencia | Verificación |
|---|---|---|---|
| Acceso interno y roles | JWT, refresh rotativo, usuarios, roles, permisos y vigencias | Identidad (6 tablas) | Unitarias, integración, humo y E2E |
| Administrador total | Semilla con todos los permisos (26 actualmente) | `roles`, `permissions`, relaciones | Humo con administrador |
| Secretaria sin usuarios | Rol semilla sin permisos `users.*` ni `roles.manage` | `role_permissions` | Políticas por endpoint |
| Alumno con casos propios | Cuenta vinculada, perfil propio y filtro por asignación activa | `users`, `students`, `case_assignments` | E2E de autenticación y aislamiento |
| Cliente y papelería | CRUD, perfil, declaraciones, documentos etiquetados | `clients`, `income_declarations`, `documents` | E2E cliente/declaración/documento |
| Tipos y requisitos | Catálogo administrable; siete tipos confirmados | `process_types`, `requirement_definitions` | Humo espera siete tipos |
| Expediente digital | Apertura, requisitos, contraparte, estado y perfil | `legal_cases`, `case_requirements`, `counterparties` | E2E de expediente |
| Escaneo directo | Sesión expirable, captura, vista previa obligatoria, confirmación, cancelación y fallo | `scan_sessions`, `documents` y almacenamiento temporal | E2E autorizado y rechazo al alumno |
| Alumno y solicitud | CRUD, solicitud, requisitos, resolución, carné y estados | Tablas de alumnos (3) | Unitarias de transición y E2E |
| Múltiples asignaciones | Asignaciones con inicio, fin y responsable principal | `case_assignments` | E2E de asignación |
| Seguimiento cronológico | Línea de tiempo append-oriented | `timeline_entries` | E2E judicial |
| Memorial y revisiones | Memorial, versiones, revisiones y presentación | Tablas de memorial/presentación (4) | E2E de revisión/presentación |
| Notificación judicial | Registro fechado, adjunto y evento cronológico | `court_notifications`, `documents`, `timeline_entries` | E2E de notificación |
| Búsqueda | Coincidencias de clientes/alumnos y último paso | Consultas indexadas del modelo | E2E búsqueda |
| Actividades | Registro y corrección con motivo | `secretariat_activities` | E2E actividad |
| Reporte semanal | Generación, revisión, impresión y envío registrado | `weekly_reports`, `report_activities`, `email_deliveries` | E2E reporte |
| Trazabilidad total | Auditoría EF y middleware de acciones HTTP | `audit_logs` y campos auditables | E2E auditoría |
| Depuración segura | Candidatos y vista previa, sin borrado irreversible | Consulta transversal | E2E/permiso; bloqueo funcional documentado |
| API versionada | Segmento obligatorio `/api/v1` y explorador versionado | No aplica | Integración v1/sin versión/v2/OpenAPI |
| Disponibilidad | Liveness y readiness de PostgreSQL | Health check EF | Integración y humo real |

## Cobertura automatizada actual

- 13 pruebas unitarias: dependencias arquitectónicas y reglas de acceso,
  vigencia documental y transiciones de inscripción.
- 7 pruebas de integración: plataforma, liveness, autenticación obligatoria,
  versión explícita y rutas OpenAPI concretas.
- prueba de humo contra el PostgreSQL local persistente;
- recorrido E2E ampliado contra PostgreSQL temporal con las 83 operaciones
  contractuales cubiertas por módulo, incluidos CRUD, ramas de escaneo,
  rotación de tokens y retención segura.

## Pendientes que dependen del cliente

| Pendiente externo | Estado seguro del backend |
|---|---|
| Aproximadamente 18 tipos de proceso y requisitos faltantes | No inventados; catálogo listo para recibirlos |
| Reglas finales de depuración | Solo candidatos y vista previa; borrado no expuesto |
| Modelos de escáner y estaciones | Backend completo; falta seleccionar WIA, TWAIN/TWAIN Direct o agente según equipos reales |
| Plantilla final de reporte y destinatarios | HTML funcional y configuración SMTP desacoplada |
| Nomenclatura final de estados y revisiones | Modelo soporta los ciclos; validar con prototipo |
| Identidad visual | Fuera del backend; pendiente del frontend/cliente |

Cuando el cliente resuelva un punto, primero se actualizan los requerimientos y
esta matriz; después se cambia dominio, migración, API y pruebas.
