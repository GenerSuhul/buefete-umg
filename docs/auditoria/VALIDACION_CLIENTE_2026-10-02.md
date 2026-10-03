# Cambios solicitados por el cliente — 2 de octubre de 2026

## Alcance y criterios

Fuente: hoja entregada por el cliente (semana del 29 de agosto de 2026) y solicitud de migrar a Next.js. Mantener .NET, PostgreSQL, MinIO, permisos, URLs y datos existentes. La persona atendida se denomina **usuario**; las cuentas autenticadas se distinguen como **accesos y personal**. Este cambio de vocabulario reemplaza la etiqueta «cliente» de RF-CLI-06, no concede acceso a las personas atendidas ni renombra tablas o contratos.

## Plan de ejecución

1. Arranque local y línea base real: frontend, API, PostgreSQL y MinIO.
2. Migración de navegación y compilación a Next.js; conservar contratos y rutas.
3. Legibilidad, etiquetas, máscaras, baja/reactivación de personas y reportes con identidad institucional.
4. Regresión automatizada API/DB/almacenamiento y navegador; registrar resultados y límites sin asumir aprobaciones históricas.

## Matriz del cambio

| Requisito | Módulo / pantalla / acción | API y servicio | Persistencia | Permiso | Criterio y estado |
|---|---|---|---|---|---|
| Arranque local | Acceso y navegación | health/ready | PostgreSQL y MinIO existentes | Sin datos sensibles en health | VERIFICADO: frontend HTTP 200; API Healthy para ambas dependencias |
| Next.js con React | Todas las rutas y enlaces | Contratos /api/v1 conservados | Sin migración por cambio de framework | RouteGuard + permisos API | VERIFICADO: build de producción, acceso autenticado, navegación principal y refresh del detalle; no equivale a todos los escenarios de cada rol |
| Usuarios / personal | Directorio, detalle, búsqueda, formularios y acciones | clients / ClientService; users / UserManagementService | Clients, Users, roles sin renombrar | clients.read/write y users.read/write | VERIFICADO en navegación y recorridos de alta/edición; textos históricos y nombres persistidos no se reescriben |
| Tamaño y fuente | Componentes compartidos, formularios, tablas, navegación | No aplica | No aplica | Sin cambio | VERIFICADO visualmente: directorio y formulario desktop, cuenta a 390px sin desbordamiento horizontal de página; no se ha revisado cada pantalla móvil |
| DPI y teléfonos | Alta / edición / reutilización | clients / ClientService | bufete.clients | clients.write | VERIFICADO: CUI 4-5-4 y teléfono 4-4, guardar/refrescar/editar/consulta SQL; se preservan valores heredados inválidos sin truncarlos |
| Personas sin atención vigente | Directorio / detalle / finalizar y reactivar atención | PUT clients/{id}/attention / ClientService.SetAttentionAsync / EF | bufete.clients.IsActive + bufete.audit_logs | clients.write | VERIFICADO: confirmación UI, refresh, auditoría con autor; filtro y conflicto 409 en E2E; nueva apertura bloqueada, restauración independiente |
| Logo y sede | Reportes / generar / imprimir | reports / ActivityReportService; declaraciones / ClientService | WeeklyReports.PrintableHtml; logo embebido | reports.generate / clients.read | VERIFICADO API: HTML del reporte incluye logo base64 y Sede Petén. Impresora física y compatibilidad SMTP pendientes |
| Regresión de procesos | Usuarios atendidos → expediente → documentos → alumnos → histórico | API existente completa | PostgreSQL y MinIO | Matriz por rol | VERIFICADO API/DB/objetos: backend-e2e. Navegador: alta/edición/atención/eliminación de persona y navegación de módulos; no todos los E2E visuales |

## Cierre técnico y evidencia

### Encontrado y causa raíz

- El runtime anterior seguía en Vite/React Router. La migración se realizó con rutas
  App Router y pantallas reutilizadas; `src/pages` se movió a `src/screens` para no
  activar accidentalmente el Pages Router de Next.js.
- El estado de atención no tenía una acción propia; se separó de la eliminación
  lógica sin duplicar tablas ni cerrar casos existentes.
- La ficha ignoraba `phone` cuando faltaba `mobilePhone`; el componente de
  información usaba una condición falsy que ocultaba el cero. Ambos corregidos.
- La edición omitía «Prefiere no indicar», aunque el alta lo permitía. Se alineó
  esa opción y se comprobó su conservación al editar y refrescar.
- npm 10 falló al resolver pares de Vitest (`edgesOut`). Con npm 11 se actualizó
  Vitest a 4.1.11 manteniendo el lockfile. Auditoría npm: cero vulnerabilidades.

### Capas modificadas

- `frontend/src/app`, `routing`, `screens`, estilos y configuración Next.js.
- `ClientsController` → `SetClientAttentionRequest` → `ClientService` → EF/auditoría.
- `DeletedRecordService`: restaurar no altera arbitrariamente el estado de atención.
- `InstitutionalReportHeader` y recurso PNG embebido, usados por reportes y declaraciones.
- `scripts/backend-e2e.ps1`: atención, concurrencia, permisos y encabezado institucional.

### Pruebas realizadas

- Build Release .NET: cero errores y advertencias; 15 pruebas unitarias y 21 de integración aprobadas.
- Frontend: TypeScript, knip y build Next.js de producción aprobados. Ejecución final:
  **46/46 pruebas en 10 archivos**; incluye regresiones de cero/ausencia y conserva
  las pruebas de paginación y búsqueda de relaciones de `Shared.test.tsx`.
- `npm audit --audit-level=moderate`: cero vulnerabilidades reportadas.
- `scripts/backend-e2e.ps1`: PostgreSQL temporal y MinIO reales; sesión, roles,
  inscripción, casos, documentos, escaneo multipágina a nivel API, memoriales,
  notificaciones, reportes, búsqueda, auditoría, retención y eliminación/restauración.
  Última ejecución completa: base temporal `bufete_juridico_e2e_a720e4f21ad0`,
  todos los bloques aprobados, incluido `403` al intentar cambiar atención con rol Alumno.
- Navegador real autenticado: crear «Validación UI Octubre 2026», elegir sexo,
  guardar CUI/teléfono, finalizar atención, recargar y comprobar bloqueo de apertura,
  reactivar, editar fecha con selector de año/día, guardar y recargar. Consulta SQL
  confirmó valores y cinco entradas de auditoría con autor (Create, tres Update,
  SoftDelete). El registro de prueba quedó en Eliminados, recuperable.
- Navegación: dashboard, expedientes, alumnos, documentos, actividades, reportes,
  accesos, catálogos, auditoría, eliminados, retención y cuenta; sin excepciones JS
  reportadas. Red comprobada con respuestas reales de API y MinIO. Logs locales
  disponibles en `%TEMP%/bufete-local-20261002`.
- Calendario: selector de año en primer plano, selección de 1990 y 15 de octubre;
  persistencia comprobada tras refresh. Cuenta a 390px y desktop inspeccionada.

## Estado de entrega

Aplicación local disponible en `http://127.0.0.1:5173/acceso`, API en `5103`;
readiness confirma PostgreSQL y almacenamiento saludables. No se han publicado
estos cambios en GitHub durante esta fase. Los datos institucionales existentes
y `.validate-cafeteria/` se conservaron. No se declara «100% del sistema» ni alta
disponibilidad por pruebas locales.

## Límites de aceptación

«Servidor» en la hoja no define proveedor, dominio, presupuesto ni topología de producción. El arranque local no demuestra alta disponibilidad. Escáner físico, SMTP institucional y failover requieren recursos externos y no se marcarán aprobados mediante mocks. Agriflow se toma como referencia de claridad operativa; no se ha recibido acceso ni una pantalla concreta para compararlo visualmente.
