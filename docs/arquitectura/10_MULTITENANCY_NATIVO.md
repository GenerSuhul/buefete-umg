# Administración multi-sede nativa

## Requisito y decisión

El superusuario administra las sedes; cada administrador administra únicamente las cuentas y los registros de su sede. La sede Petén conserva la base de datos existente. Cada nueva sede dispone de una base PostgreSQL independiente, con el mismo modelo, migraciones y catálogos. El registro central no se acepta del cliente: el servidor resuelve el código de sede a una base registrada.

Referencia: [patrones de tenencia de Microsoft](https://learn.microsoft.com/azure/azure-sql/database/saas-tenancy-app-design-patterns), patrón database-per-tenant. Se aplica el patrón a PostgreSQL, no implica utilización de Azure SQL ni disponibilidad automática.

## Flujos y límites

- Acceso local: código de sede + correo + contraseña. La sede por defecto es `peten` para conservar compatibilidad.
- Acceso global: cuenta de plataforma en Petén. Su privilegio es un atributo del servidor, no un rol asignable por administradores locales.
- Crear sede: validar código y administrador inicial → reservar sede → crear base → migrar y sembrar catálogos → habilitar sede. Una provisión fallida no habilita acceso y queda registrada.
- Cambiar sede: verificar cuenta global central → emitir nueva sesión vinculada a la sede → recargar aplicación para descartar estado previo.
- Suspender sede: impedir nuevas solicitudes y renovaciones; conservar datos. No se permite suspender Petén, que aloja el plano de administración.
- Los archivos nuevos incluyen prefijo de sede. Los antiguos de Petén mantienen sus claves. La metadata documental se consulta exclusivamente en la base de la sesión.
- No hay borrado de bases desde la interfaz. El respaldo/restauración y la alta disponibilidad son operaciones de infraestructura, no garantías de este módulo.

## Matriz de trazabilidad

| Requisito | Pantalla / acción | Endpoint | Servicio / persistencia | Permiso | Prueba de aceptación |
| --- | --- | --- | --- | --- | --- |
| Administrar sedes | /sedes listar, crear, modificar | /platform/tenants | TenantRegistry / tenants central | platform_admin verificado contra cuenta central | administrador local recibe 403 |
| Crear administrador local | /sedes alta | POST /platform/tenants | TenantRegistry / users, roles en base nueva | superusuario | iniciar sesión y crear secretaria |
| Aislamiento | acceso y módulos existentes | todos | TenantSelection / BufeteDbContext por conexión registrada | JWT vinculado a tenant_code | token de A con cabecera B rechazado; GUID de A no existe en B |
| Cambiar sede | /sedes entrar | POST /platform/tenants/{code}/session | TenantRegistry / AuthenticationService | superusuario central activo | entrar, refrescar y volver sin mezclar registros |
| Suspender | /sedes suspender | PUT /platform/tenants/{code} | TenantRegistry / tenants | superusuario | sesión existente y login dejan de operar |
| Proteger cuenta global | directorio y operaciones de cuentas | /users | UserManagementService / users | atributo de plataforma no asignable | local no lista, modifica ni restablece cuenta global |
| Documentos | carga y recuperación | /documents | almacenamiento con prefijo y metadata por base | permisos existentes de sede | lectura cruzada rechazada |

## Estado de verificación

Validación local del 10 de octubre de 2026:

- `scripts/native-tenancy-e2e.ps1`: 49 comprobaciones reales contra PostgreSQL y MinIO; dos sedes con identidades separadas, secretaría, clientes, documentos, cambio de contexto, renovación y revocación de sesiones, suspensión/reactivación, identidad global reservada y auditoría global no visible al administrador local. Evidencia: `.artifacts/tenancy/abf34b99ff97`.
- `scripts/backend-e2e.ps1 -Port 5119 -ProxyS3Downloads`: regresión completa aprobada de clientes, alumnos, inscripción, expedientes, documentos, escáner, memoriales, notificaciones, actividades, reportes, auditoría, retención, sesiones, bajas, restauración y eliminación definitiva de cuentas. Base QA desechable `bufete_juridico_e2e_528c790c574d`.
- `dotnet test BufeteJuridico.slnx --no-restore`: 30 pruebas unitarias y 21 pruebas de integración aprobadas.
- `npm test`: 71 pruebas del frontend aprobadas, incluidas vinculación de cabeceras, descarga de archivos e intercambio de tokens por sede.
- `scripts/native-tenancy-ui-e2e.cjs`: navegador Chrome real automatizado sobre las imágenes finales; inicio de sesión global, creación de sede y administrador, edición y refresco, cambio de sede, inicio de sesión local, creación de secretaría y persistencia tras refrescar, y rechazo de administración global. Sin errores de consola ni excepciones JavaScript en el recorrido final. Evidencia visual: `.artifacts/tenancy-ui/qa-ui-1791668921537`.
- `npm run typecheck` y `npm run check:unused`: aprobados. La validación HTML del código de acceso fue ajustada al modo Unicode `v` utilizado por Chrome y comprobada en el recorrido final.
- Imágenes Docker de frontend y backend construidas; respaldo previo `.data/pre-native-tenancy-20261010.dump`. Las bases y sedes temporales de las pruebas se retiran al cerrar cada recorrido; no se modifican los registros operativos existentes de Petén.

La demo publicada es un backend distinto y no acredita aislamiento del backend .NET. Esta verificación no sustituye pruebas de carga, recuperación ante desastres ni despliegue productivo. La regresión documental cubre las sesiones y páginas de la API de escaneo; no se validó un escáner físico en esta fase.

## Operación local y despliegue

1. Respaldar la base central antes de actualizar. Aplicar migraciones con el comando existente `--migrate`; también migra las bases registradas. El modo de desarrollo puede migrar al arrancar.
2. El bootstrap global es explícito: configurar `PlatformAdmin__Email` y `PlatformAdmin__Password` mediante secretos del entorno. No existe contraseña predeterminada. Si la cuenta existe, no se restablece su contraseña ni se promociona una cuenta local.
3. Para Docker local, el archivo ignorado `.env.platform.local` puede suministrarse con `docker compose --env-file .env --env-file .env.platform.local -f compose.yaml -f compose.app.yaml up -d`. No versionar este archivo.
4. El superusuario inicia sesión en `peten` y abre **Administración de sedes**. Crea la sede con código, nombre y credenciales del administrador inicial. Entregar al administrador su código y credenciales por canal privado.
5. Los administradores de sede utilizan **Accesos y personal** para crear sus secretarías y cuentas. No pueden asignar el atributo global ni acceder al módulo de sedes.
6. El superusuario utiliza **Entrar a la sede** para operar allí. Para cambiar su contraseña o perfil global debe volver a Petén. Las fotografías y los datos operativos siguen asociados a la sede.
7. Un aprovisionamiento fallido conserva estado `Failed` y puede reintentarse desde el formulario con el mismo código. No se borran bases automáticamente. Si el proceso fue interrumpido abruptamente en `Provisioning`, el operador debe revisar los logs antes de marcarlo fallido y reintentar; no hay todavía una cola distribuida de aprovisionamiento.

### Límites de infraestructura

La API local utiliza la identidad PostgreSQL existente para aprovisionar y acceder a las bases. Esa identidad necesita permiso `CREATEDB`. Antes de producción, revisar identidades/secretos por entorno, capacidad y límites de conexiones, respaldo y recuperación por sede, supervisión y réplica. El servidor PostgreSQL y el almacenamiento compartidos continúan siendo dependencias comunes; base por sede no equivale a alta disponibilidad ni certifica aislamiento frente a una toma completa del servidor/API. No se cambia la demo Vercel en esta tarea.
