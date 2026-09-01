# Auditoría técnica integral — corte al 29 de agosto de 2026

## Dictamen

**APTO CON OBSERVACIONES**

La línea base de la aplicación es consistente, compila sin advertencias, inicia directamente desde el proyecto API, aplica y valida sus migraciones, se conecta a PostgreSQL y al almacenamiento S3/MinIO, y supera pruebas unitarias, de integración, de componentes y un recorrido E2E real sobre una base aislada.

Las observaciones restantes no son defectos que impidan desarrollar o realizar pruebas de aceptación. Sí son puertas operativas obligatorias antes de abrir el sistema a producción: envío SMTP real, prueba con el escáner físico objetivo, restauración comprobada de respaldos, TLS/proxy en el VPS, despliegue redundante y prueba de carga/recuperación.

## Alcance auditado

- solución .NET 10: API, aplicación, dominio, infraestructura, pruebas y agente WIA;
- React 19 + TypeScript + Vite;
- PostgreSQL 18 y migraciones EF Core;
- almacenamiento de objetos compatible con S3 mediante MinIO;
- autenticación JWT, roles, permisos y aislamiento del rol Alumno;
- clientes, declaraciones de ingresos, alumnos, inscripciones, expedientes, asignaciones, documentos, escaneo, memoriales, notificaciones, actividades, reportes, auditoría, borrado lógico y retención;
- configuración local, secretos, CORS, HTTPS, forwarded headers, OpenAPI, health checks y dependencias;
- contratos y navegación frontend → API → PostgreSQL/MinIO → respuesta → UI.

## Hallazgos y correcciones

### Críticos

#### La API no iniciaba directamente desde Visual Studio o el `.csproj`

- **Causa:** la configuración segura sólo se importaba mediante `scripts/run-local.ps1`; Visual Studio encontraba la conexión almacenada en User Secrets, pero no la clave JWT y fallaba por validación de opciones.
- **Corrección:** se añadió un cargador de `.env` exclusivo de `Development`, acotado al repositorio y ejecutado antes de construir la configuración. Las variables explícitas del proceso conservan mayor prioridad y el mecanismo no opera en producción.
- **Archivos:** `DevelopmentEnvironmentLoader.cs`, `Program.cs`, `bootstrap-local.ps1`, README y documentación de operación local.
- **Prueba:** inicio directo con `dotnet run --project src/BufeteJuridico.Api/BufeteJuridico.Api.csproj --no-build --launch-profile http`; API escuchando en `5103`, sin `OptionsValidationException`.

### Altos

#### Paginación visible sin navegación, historiales truncados y relaciones incompletas

- **Causa:** el componente compartido mostraba botones anterior/siguiente sin ejecutar cambio de página; varios formularios cargaban sólo los primeros 50 o 100 clientes, alumnos, expedientes o usuarios; el historial de reportes descartaba silenciosamente todo registro posterior al centésimo.
- **Corrección:** todas las listas operativas conservan página en estado y ejecutan carga paginada; los campos relacionales utilizan búsqueda remota con debounce y preservan el elemento seleccionado aunque no pertenezca a la primera página; reportes y candidatos de asignación exponen y consumen `PagedResult`.
- **Cobertura:** clientes, alumnos, expedientes, documentos, actividades, reportes, usuarios, auditoría, retención, papelera y documentos del cliente.
- **Prueba:** componentes `Pagination` y `RelationLookup`, typecheck, `knip` y build de producción.

#### Contrato de búsqueda incompatible con React

- **Causa:** backend devolvía `Cliente` y `Alumno`; el frontend sólo reconoce `Client`, `Student` y `LegalCase`. Una persona se presentaba y navegaba como expediente.
- **Corrección:** se normalizaron los discriminadores del DTO a los valores contractuales del frontend.
- **Prevención:** el E2E ahora exige expresamente resultados `Client` y `Student`.
- **Archivos:** `QueryService.cs`, `backend-e2e.ps1`.

#### Consultas N+1 en búsqueda global

- **Causa:** después de obtener personas, se consultaba el último expediente individualmente por cada cliente y alumno; el peor caso podía superar 500 consultas.
- **Corrección:** proyecciones agrupadas por lote para clientes y alumnos; orden estable antes de `Take`; máximo de cuatro consultas funcionales para la búsqueda.
- **Archivo:** `QueryService.cs`.

#### Consultas N+1 en candidatos de retención

- **Causa:** cada expediente paginado provocaba consultas adicionales para requisitos, memoriales y documentos.
- **Corrección:** propietarios de contextos y conteos documentales se recuperan por lote; se eliminó la consulta dentro del ciclo.
- **Archivo:** `QueryService.cs`.

#### OpenAPI no documentaba autenticación Bearer

- **Causa:** los endpoints estaban protegidos en ejecución, pero el contrato OpenAPI no exponía el esquema ni diferenciaba operaciones anónimas.
- **Corrección:** transformadores de documento y operación registran JWT Bearer y aplican requisitos según metadatos `Authorize`/`AllowAnonymous`.
- **Archivos:** `BearerSecurityTransformers.cs`, `Program.cs`, `PlatformEndpointsTests.cs`.
- **Referencia técnica:** [personalización de OpenAPI en ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/customize-openapi?view=aspnetcore-10.0).

### Medios

#### Borradores de escaneo expiraban como sesiones interactivas

- **Causa:** `SaveDraftAsync` reutilizaba la expiración corta de `SessionMinutes`; la opción `DraftRetentionDays` estaba configurada pero no se aplicaba.
- **Corrección:** un borrador guardado recibe la retención configurada en días; las sesiones no guardadas mantienen expiración corta.
- **Prueba:** el E2E exige una vigencia mínima de 29 días con la configuración local de 30 días y finaliza/limpia el flujo documental.

#### Búsqueda por fragmentos sin índice apropiado

- **Causa:** `Contains` produce búsqueda `LIKE '%valor%'`; un B-tree convencional no resuelve bien ese patrón al crecer la tabla.
- **Corrección:** extensión `pg_trgm` e índices GIN `gin_trgm_ops`, parciales para registros no eliminados, en nombres normalizados de clientes y alumnos.
- **Migración:** `20260826021206_AddTrigramSearchIndexes`.
- **Estado:** aplicada en la base local; EF confirma que no hay cambios pendientes del modelo.

#### Solicitudes documentales repetidas y versión truncada al primer centenar

- **Causa:** cada miniatura montada pedía su propia URL firmada y la UI consultaba una página fija de 100 documentos del contexto para reemplazo e historial.
- **Corrección:** las solicitudes simultáneas del mismo documento se deduplican sin conservar URLs firmadas entre sesiones; el reemplazo usa búsqueda paginada de documentos vigentes y el historial consulta por etiqueta exacta, recorriendo todas sus páginas.
- **Prueba:** prueba React con dos avatares y una sola solicitud; contrato OpenAPI con filtro `label`; E2E de historial filtrado y paginado.

#### Reporte imprimible exponía identificadores técnicos y usaba límites UTC

- **Causa:** la plantilla insertaba `CreatedByUserId` como responsable y construía el período desde medianoche UTC, aunque la definición funcional fija `America/Guatemala`.
- **Corrección:** el servicio resuelve los nombres de responsables en una consulta por lote, codifica el texto para HTML y convierte límites y horas a la zona local del bufete.
- **Prueba:** el E2E exige que la versión imprimible identifique por nombre al usuario autor y que el historial respete `page/pageSize`.

#### Una solicitud por cada tecla en búsqueda global

- **Causa:** el término era dependencia directa del cargador asíncrono.
- **Corrección:** debounce de 250 ms antes de consultar la API.
- **Archivo:** `AppShell.tsx`.

#### Advertencia HTTPS al usar el perfil HTTP local

- **Causa:** `UseHttpsRedirection` se ejecutaba aun cuando el perfil HTTP no publicaba puerto HTTPS.
- **Corrección:** en desarrollo se permite el perfil HTTP explícito; HSTS y redirección HTTPS permanecen obligatorios fuera de desarrollo.
- **Archivo:** `Program.cs`.

#### Ejecución intermitente de Vitest en Windows

- **Causa:** el worker podía no responder al cargar `App.test.tsx`, dejando el gate sin resultado aunque las pruebas aisladas pasaran.
- **Corrección:** pool por procesos y ejecución de archivos sin paralelismo; conserva aislamiento entre archivos y produce un resultado reproducible.
- **Archivo:** `vite.config.ts`.
- **Referencia técnica:** [paralelismo de archivos en Vitest](https://vitest.dev/config/fileparallelism).

### Menores

- Se normalizó codificación y fin de línea de la migración nueva para cumplir `.editorconfig` y el gate de formato.
- Se verificó que el cliente HTTP está centralizado; las únicas llamadas fuera de `dataSource.ts` corresponden al agente local de escáner.
- La carga de datos mock queda limitada a pruebas o a la opción explícita `VITE_DATA_SOURCE=mock`; la ejecución normal utiliza API.
- No se encontraron `TODO`, `FIXME`, `NotImplementedException`, esperas síncronas `.Result`/`.Wait()`, `try/catch` vacíos ni token GitHub versionado en el código auditado.

## Backend

- Arquitectura conservada por capas: API → Application → Domain/Infrastructure.
- Controllers delegan en servicios y el manejo global produce respuestas seguras tipo Problem Details.
- JWT valida emisor, audiencia y material criptográfico al iniciar; login tiene rate limiting.
- Las rutas sensibles están autorizadas; alumno sólo consulta sus expedientes/documentos y administra su perfil permitido.
- CORS requiere lista explícita de orígenes; Kestrel no publica cabecera `Server`.
- Se aplican cabeceras `nosniff`, `DENY` para frames y `no-referrer`.
- OpenAPI contiene **104 operaciones versionadas** bajo `/api/v1` y esquema Bearer.
- `/health/live` y `/health/ready` responden `200`; readiness comprobó PostgreSQL y almacenamiento.
- Build final: **0 advertencias, 0 errores**.
- Pruebas: **15 unitarias + 17 de integración**, todas aprobadas.

## Frontend

- TypeScript estricto y build Vite de producción aprobados.
- `knip` no encontró archivos, exports o dependencias sin uso.
- **23 pruebas** de componentes/UX aprobadas.
- API centralizada, sesión/refresh gestionados por un solo cliente y feedback de error visible.
- Búsqueda global con debounce y discriminadores de navegación consistentes.
- La pantalla pública de acceso cargó con estructura accesible y consola sin errores en la regresión del 29/08/2026.
- La aceptación autenticada de creación, detalle, edición, refresh y continuidad por cada rol debe repetirse antes de cerrar la evaluación de navegador; no se introdujeron credenciales sin autorización explícita.

## Base de datos y almacenamiento

- PostgreSQL y MinIO se ejecutan saludables y sólo publican puertos en `127.0.0.1` durante desarrollo.
- Diez migraciones versionadas y aplicadas, incluidas búsqueda trigram, papelera/restauración e integridad documental/de expedientes.
- `dotnet ef migrations has-pending-model-changes`: sin cambios pendientes.
- Todas las claves foráneas auditadas tienen índice de soporte.
- Borrado lógico y restauración conservan trazabilidad y ocultan registros eliminados a usuarios no autorizados.
- Los documentos no se guardan como BLOB en PostgreSQL: la BD conserva metadatos, hash, versiones y asociación; los bytes se almacenan en S3/MinIO.
- El E2E validó carga documental, lectura autorizada, fotografía y sesión de escaneo multipágina.

## Verificación ejecutada

```powershell
.\scripts\quality-gate.ps1
# Docker Compose válido
# formato .NET válido
# build .NET: 0 warnings, 0 errors
# tests .NET: 32/32
# modelo EF: sin cambios pendientes
# NuGet: sin vulnerabilidades conocidas
# npm audit: 0 vulnerabilidades
# knip: sin código/archivos sin uso
# Vitest: 23/23
# Vite production build: correcto

.\scripts\backend-e2e.ps1
# 17 bloques funcionales E2E: OK
# base PostgreSQL temporal creada, migrada y eliminada automáticamente

dotnet run --project src/BufeteJuridico.Api/BufeteJuridico.Api.csproj --no-build --launch-profile http
# inicio directo correcto

GET /health/live
GET /health/ready
GET /openapi/v1.json
# 200 / 200 / 200; 104 operaciones y Bearer documentado
```

El E2E cubrió autenticación, perfil, roles, catálogos, cliente, declaración, alumno, inscripción, autorización del alumno, escaneo multipágina, retención de borradores, almacenamiento, expediente, asignación, documentos/versiones, memoriales, revisiones, presentación, notificación, actividad, reporte, retención, búsqueda, auditoría, papelera/restauración y rotación/revocación de tokens.

## Concurrencia de edición

- **Hallazgo:** las entidades tenían `ConcurrencyToken` en EF, pero los contratos HTTP no lo devolvían ni lo exigían; dos editores podían aplicar la última escritura sin detectar que trabajaban sobre una versión anterior.
- **Corrección:** cliente, alumno y expediente devuelven su token; los formularios lo reenvían en `PUT`; el servicio lo establece como valor original de EF y el manejador global responde HTTP 409 ante una escritura obsoleta.
- **Defecto relacionado corregido:** el registro transaccional del alumno rotaba el token al vincular la cuenta, pero devolvía el DTO anterior; ahora recarga el perfil persistido antes de responder.
- **Prueba:** el E2E realiza una edición válida seguida por una modificación distinta con el token anterior para los tres agregados; las tres escrituras obsoletas reciben 409 y el recorrido completo continúa correctamente.

## Observaciones obligatorias antes de producción

1. Configurar y probar un proveedor SMTP real; en desarrollo está deshabilitado y el fallo queda trazado como `SendFailed`.
2. Validar el agente WIA con el modelo exacto de escáner, drivers y políticas del equipo institucional.
3. Implementar backup automático de PostgreSQL y MinIO, cifrado externo y una restauración ensayada con RPO/RTO aprobados.
4. Desplegar tras proxy inverso con TLS válido, `KnownProxies` exactos y secretos administrados fuera de archivos.
5. Para alta disponibilidad real, utilizar PostgreSQL administrado o réplica/failover y almacenamiento S3 distribuido; el Compose local es de desarrollo, no un clúster HA.
6. Ejecutar prueba de carga, escaneo de seguridad dinámico y aceptación institucional con datos anonimizados antes del go-live.
7. Definir por escrito conservación legal, respaldo y autorización antes de habilitar depuración física; actualmente sólo se ofrece vista previa segura.

## Conclusión

El error inicial no se ocultó: se corrigió su dependencia ambiental y se continuó por todas las capas. El sistema ya tiene una línea base técnica reproducible y sus flujos principales funcionan de extremo a extremo. El código queda **apto con observaciones**; la promoción a **apto para producción** depende de cerrar y evidenciar las siete puertas operativas anteriores en el entorno VPS definitivo.
