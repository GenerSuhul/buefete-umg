# Modelo de dominio y alcance implementable del backend

## Estado

**Vigente desde:** 14 de agosto de 2026.  
**Fuentes:** `docs/requerimientos/06_CONTEXTO_REUNION.md` y `docs/requerimientos/`.  
**Regla:** este documento reemplaza cualquier inferencia del ERD retirado, pero
no reemplaza los requerimientos funcionales.

## Decisiones funcionales cerradas

- Los alumnos pueden iniciar sesión con una cuenta personal.
- Los permisos se administran dinámicamente mediante roles y permisos; los
  permisos iniciales pueden agregarse o retirarse posteriormente.
- Secretaría puede operar clientes, alumnos, expedientes, seguimientos,
  actividades y reportes, pero no puede administrar usuarios, roles o permisos.
- El administrador es el único que puede administrar o dar de baja usuarios.
- La baja de usuarios es lógica y conserva toda la trazabilidad histórica.
- La primera versión incluye los siete tipos de proceso evidenciados. El
  catálogo permite incorporar los restantes sin cambiar el esquema.
- La declaración jurada de ingresos admite captura estructurada, generación de
  formato y carga del documento firmado.

## Defaults reversibles de versión 1

Estos defaults permiten construir un sistema utilizable sin convertir dudas en
restricciones permanentes:

- Un proceso puede abrirse con requisitos pendientes y comienza en
  `RecoleccionDocumental`.
- Un proceso admite varios alumnos y como máximo uno se marca responsable
  principal en una fecha determinada.
- Las versiones sustituidas de documentos se conservan y la versión vigente se
  identifica expresamente.
- El flujo inicial de memorial es `Recibido`, `EnRevision`,
  `RequiereCorreccion`, `Corregido`, `AprobadoParaFirma` y `Presentado`.
- Los estados y requisitos se guardan como catálogos configurables cuando el
  cliente aún debe aprobar su nomenclatura final.
- Los alumnos ven su perfil y casos asignados. La ampliación de permisos se hace
  mediante roles; los controles por recurso impiden consultar casos ajenos.

## Bloqueos que se respetan

- No se ejecutará depuración física. La API únicamente identificará candidatos
  y generará una vista previa hasta que exista política institucional aprobada.
- La Web API aceptará archivos cuya fuente sea `Escaner`, pero controlar el
  hardware requiere validar los equipos y un componente local o frontend.
- No se inventarán los aproximadamente dieciocho tipos de proceso restantes.
- El envío de correo requiere configuración SMTP real. Cada intento y resultado
  quedará registrado aunque el proveedor no esté configurado localmente.

## Módulos y agregados

| Módulo | Datos principales | Responsabilidad |
|---|---|---|
| Identidad | usuario, rol, permiso, sesión renovable | acceso interno y permisos dinámicos |
| Auditoría | evento, actor, fecha, entidad, cambios | trazabilidad append-only |
| Documentos | metadatos, hash, versión, origen, ubicación | PDF/imágenes sin guardar binarios en PostgreSQL |
| Clientes | ficha de recepción, contraparte, declaración | recepción y evaluación socioeconómica |
| Alumnos | perfil, requisitos, solicitud, modalidad, carné | expediente académico-administrativo |
| Catálogos | tipo de proceso y definición de requisito | crecimiento sin migraciones por cada nuevo tipo |
| Expedientes | caso, checklist, asignaciones, estado | expediente judicial digital |
| Seguimiento | memorial, versión, revisión, presentación, notificación, actuación | línea de tiempo reconstruible |
| Actividades | actividad de secretaría y relaciones | registro operativo diario |
| Reportes | período, revisión, representación imprimible, envío | reporte semanal y evidencia de correo |
| Retención | candidato y vista previa | preparación segura para futura depuración |

## Reglas de persistencia

- Identificadores UUID generados por la aplicación.
- Fechas operativas en UTC; fechas civiles mediante `date` de PostgreSQL.
- Nombres normalizados para búsqueda sin depender de mayúsculas.
- Índices únicos para usuario, correo, DPI cuando exista, carné, número de caso y
  códigos de catálogo.
- Concurrencia optimista mediante token de versión en registros modificables.
- Archivos fuera de la base de datos; PostgreSQL conserva metadatos, SHA-256,
  tamaño, tipo MIME, versión y relación funcional.
- Auditoría append-only y referencias históricas aun cuando un usuario quede
  inactivo.

## Seguridad inicial por rol

| Capacidad | Administrador | Secretaría | Alumno |
|---|:---:|:---:|:---:|
| Usuarios, roles y permisos | Sí | No | No |
| Clientes y expedientes | Sí | Sí | Solo casos asignados |
| Alumnos | Sí | Sí | Solo perfil propio |
| Documentos y seguimiento | Sí | Sí | Permitido en casos asignados según permiso |
| Actividades y reportes | Sí | Sí | No |
| Auditoría global | Sí | No | No |
| Vista previa de retención | Sí | No | No |

## Contrato HTTP

- Prefijo obligatorio `/api/v{version}`.
- Versión inicial `1.0`, representada en URL como `/api/v1/...`.
- JWT de corta duración y token de renovación rotatorio y revocable.
- Errores RFC 9457 mediante `ProblemDetails` con `traceId`.
- Paginación en listados, búsqueda y auditoría.
- OpenAPI separado por versión y habilitado solo en desarrollo.

## Datos iniciales

El inicializador crea de forma idempotente:

- roles `Administrador`, `Secretaria` y `Alumno`;
- catálogo de permisos y asignaciones base;
- administrador inicial leído de variables de entorno;
- siete tipos de proceso confirmados;
- requisitos documentales conocidos de seis tipos;
- requisitos documentales iniciales del alumno.

Los datos faltantes se incorporan mediante endpoints de catálogo y quedan
auditados.
