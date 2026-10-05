# Gestión de accesos y personal — trazabilidad de la fase

## Alcance y criterio

El administrador gestiona cuentas de personal y acceso de alumnos sin mezclar
identidad de inicio de sesión con la ficha académica o los expedientes. La
secretaría no dispone de permisos de administración de cuentas. Se siguió el
patrón de directorio activo + eliminados recuperables + eliminación definitiva
que emplean Microsoft Entra y Google Workspace; la suspensión separada sigue
el patrón de AWS IAM. La eliminación definitiva afecta la **cuenta de acceso**,
no los registros jurídicos sujetos a conservación institucional.

## Matriz de trazabilidad

| Requisito | Módulo / pantalla / acción | Endpoint | Servicio / persistencia | Permiso | Prueba |
|---|---|---|---|---|---|
| Buscar personal o alumnos sin mezclar bajas | Accesos y personal / filtros y búsqueda | `GET /users?lifecycle&personType&search&page` | `UserManagementService.GetUsersAsync` / `users`, `user_roles` | `users.read` | E2E: cuenta dada de baja sólo en eliminados |
| Suspender o habilitar acceso | Accesos y personal / Suspender, Habilitar | `PUT /users/{id}/access` | `SetAccessAsync` / `users`, `refresh_tokens`, `audit_logs` | `users.deactivate` | E2E: login rechazado tras suspensión; habilitación explícita |
| Baja recuperable | Accesos y personal / Eliminar | `DELETE /users/{id}` | `DeactivateUserAsync` / `users`, `refresh_tokens`, `audit_logs` | `users.deactivate` | E2E: login rechazado y registro en eliminados |
| Restaurar sin conceder acceso | Eliminados / Restaurar | `POST /users/{id}/restore` | `RestoreUserAsync` / `users`, `audit_logs` | `users.deactivate` | E2E: ficha restaurada, login aún rechazado |
| Borrar la cuenta definitivamente | Eliminados / confirmación por correo / Eliminar definitivamente | `DELETE /users/{id}/permanent` | `PurgeUserAsync` / `users`, `user_roles`, `refresh_tokens`, `students.UserAccountId`, documentos `UserPhoto`, MinIO y `audit_logs` | `users.purge` + rol `Administrador` | E2E: 403 a alumno, 404 a cuenta/foto, ficha de alumno conservada |

## Reglas de seguridad y límites

- No se permite suspender, dar de baja o purgar la propia cuenta.
- No se permite dejar al sistema sin otro administrador activo.
- Una cuenta eliminada no puede editarse, restablecer contraseña ni recuperar
  acceso sin restauración previa.
- Los datos personales/académicos del alumno se editan en **Alumnos**, no desde
  el directorio de accesos. Su ficha y casos sobreviven al borrado de la cuenta.
- El rol Alumno exige una ficha académica vinculada y no puede retirarse de una
  cuenta todavía vinculada, incluso por los endpoints genéricos de roles.
- La operación definitiva borra los objetos `UserPhoto` antes de confirmar la
  eliminación de la fila. Si el almacenamiento falla, la cuenta permanece en
  eliminados para reintento. No hay transacción distribuida entre PostgreSQL y
  MinIO: una falla de base de datos posterior a la eliminación de un objeto
  puede dejar una foto inaccesible de una cuenta ya inactiva. Queda pendiente
  formalizar una cola de limpieza/reconciliación para garantía fuerte.
- Los `audit_logs` conservan identificador de actor y hechos jurídicos. Se
  limpian los antiguos `ChangesJson` del registro de cuenta purgada para no
  retener sus credenciales o datos de perfil allí; la definición final de
  retención histórica institucional está pendiente.

## Validación ejecutada

- `dotnet build BufeteJuridico.slnx --no-restore -v:q`: sin errores ni advertencias.
- `dotnet test BufeteJuridico.slnx --no-restore -v:q`: 30 pruebas unitarias y
  21 de integración aprobadas.
- `npm run typecheck`, `npm test` (62 pruebas), `npm run build` y
  `npm run check:unused`: aprobados.
- `scripts/backend-e2e.ps1 -Port 5106`: aprobado contra PostgreSQL temporal y
  almacenamiento MinIO; cubre suspensión, baja, restauración, reactivación,
  permisos de eliminación definitiva y conservación de la ficha académica.
- Navegador local con cuenta administradora: inicio de sesión, directorio de
  personal, directorio de alumnos, vista vacía de eliminados, confirmación de
  baja recuperable, creación y edición de personal comprobados. Se canceló la
  baja antes de confirmar para no alterar cuentas reales.

La eliminación definitiva sólo se ejecutó sobre una cuenta temporal de la
prueba E2E. La limpieza entre PostgreSQL y MinIO sigue teniendo el riesgo de
consistencia indicado arriba; no se declara resuelto.

## Referencias de diseño

- [Microsoft Entra: restaurar o eliminar definitivamente un usuario](https://learn.microsoft.com/en-us/entra/fundamentals/users-restore).
- [AWS IAM: desactivar o quitar un usuario](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_remove.html).
- [Google Workspace: eliminar un usuario](https://support.google.com/a/answer/33314?hl=es-419-mx&ref_topic=4388359).
