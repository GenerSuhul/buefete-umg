# Base de datos y operación local

## PostgreSQL local

PostgreSQL se ejecuta en Docker y publica el puerto solamente en
`127.0.0.1:55432`. El volumen persistente es
`bufete_juridico_postgres_data`. El contenedor no incluye la API ni expone la
base a la red local.

La configuración sensible reside en `.env`, excluido del control de versiones.
`.env.example` contiene solo marcadores y nombres de variables. Para generar
secretos locales:

```powershell
.\scripts\bootstrap-local.ps1
docker compose up -d postgres
.\scripts\database-update.ps1
```

La inicialización es idempotente: aplica migraciones y asegura permisos, roles,
administrador inicial, siete tipos de proceso evidenciados y requisitos
conocidos. No se imprimen contraseñas en consola.

## Esquema relacional

Todas las tablas de negocio viven en el esquema PostgreSQL `bufete`.

| Módulo | Tablas |
|---|---|
| Identidad | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens` |
| Auditoría | `audit_logs` |
| Documentos y escaneo | `documents`, `scan_sessions`, `scan_pages` |
| Clientes | `clients`, `income_declarations` |
| Alumnos | `students`, `enrollment_applications`, `student_requirements` |
| Catálogos | `process_types`, `requirement_definitions` |
| Expedientes | `legal_cases`, `case_requirements`, `case_assignments`, `counterparties`, `timeline_entries` |
| Memoriales y juzgado | `memorials`, `memorial_versions`, `memorial_reviews`, `case_presentations`, `court_notifications` |
| Operación | `secretariat_activities`, `weekly_reports`, `report_activities`, `email_deliveries` |

Son 31 tablas. Las claves de negocio relevantes tienen índices únicos y las
relaciones se expresan con claves foráneas. Los identificadores son UUID. Las
fechas de auditoría son UTC y los períodos civiles usan `date`.

## Auditoría y archivos

Las entidades auditables conservan creador, fecha de creación, último editor,
fecha de edición y token de concurrencia. `audit_logs` registra cambios de EF y
acciones HTTP autenticadas, incluidas consultas, búsquedas, descargas,
impresiones y envíos. No se copian hashes de contraseña, secretos ni sellos de
seguridad al JSON de cambios.

Los binarios no se guardan dentro de PostgreSQL. En desarrollo se almacenan en
un bucket privado de MinIO; en producción se utiliza almacenamiento de objetos
S3 compatible con replicación y versionado. PostgreSQL conserva una clave
neutral, metadatos, contexto, versión y hash, por lo que cambiar de proveedor no
altera el dominio.

## Migraciones

La historia parte de `20260814144624_InitialBackendSchema` y actualmente incluye
`20260821223714_AddAuditAndRetentionIndexes`. Para actualizar una base y ejecutar
la siembra idempotente:

```powershell
.\scripts\database-update.ps1
```

Para comprobar que el modelo no se alejó de las migraciones:

```powershell
. .\scripts\common.ps1
Import-BufeteEnvironment -Path .\.env
dotnet tool restore
dotnet tool run dotnet-ef migrations has-pending-model-changes `
  --project src/BufeteJuridico.Infrastructure `
  --startup-project src/BufeteJuridico.Api
```

Nunca se debe editar una migración ya aplicada en un ambiente compartido; se
crea una migración nueva y se prueba primero en una base aislada.

## Ejecución y verificación

```powershell
dotnet restore BufeteJuridico.slnx
dotnet build BufeteJuridico.slnx --no-restore
dotnet test BufeteJuridico.slnx --no-build
.\scripts\run-local.ps1
```

Validaciones reproducibles:

```powershell
.\scripts\smoke-test.ps1
.\scripts\backend-e2e.ps1
dotnet list BufeteJuridico.slnx package --vulnerable --include-transitive
dotnet format BufeteJuridico.slnx --no-restore --verify-no-changes
.\scripts\quality-gate.ps1
```

`backend-e2e.ps1` crea una base con nombre aleatorio validado, aplica la
migración, ejecuta el recorrido funcional y elimina exclusivamente esa base en
un bloque `finally`.

## Antes de producción

- sustituir todos los secretos y el administrador inicial;
- deshabilitar la creación automática de administrador después del primer
  aprovisionamiento o custodiar el secreto mediante el proveedor de despliegue;
- configurar CORS con el dominio definitivo;
- mantener OpenAPI deshabilitado públicamente si no existe una necesidad
  operativa;
- usar HTTPS en el proxy y reenviar correctamente protocolo/IP;
- configurar almacenamiento persistente, SMTP y copias de seguridad;
- ensayar restauración de base y archivos juntos;
- ejecutar migraciones como paso controlado de despliegue;
- centralizar logs y alertas sin incluir documentos ni datos personales.
