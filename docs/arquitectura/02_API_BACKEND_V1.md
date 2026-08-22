# Contrato funcional del backend API v1

## Estado y alcance

Este documento registra el contrato implementado para el backend del Bufete
Jurídico UMG. La fuente funcional continúa siendo
`docs/requerimientos/06_CONTEXTO_REUNION.md` y `docs/requerimientos/`.

Todas las rutas funcionales usan el prefijo `/api/v1`. No se asume una versión
cuando falta el segmento y una versión no soportada es rechazada. El documento
OpenAPI está disponible en desarrollo en `/openapi/v1.json`.

## Autenticación y autorización

- El acceso usa JWT de corta duración y refresh tokens rotativos.
- Los refresh tokens se guardan como hash y se invalidan al rotar, revocar,
  cambiar contraseña, restablecer contraseña o modificar roles.
- El token incluye roles, permisos y sello de seguridad del usuario.
- Cada petición autenticada vuelve a comprobar que la cuenta esté activa, no
  eliminada lógicamente, dentro de su período de participación y con el mismo
  sello de seguridad.
- La autorización se decide por permisos persistidos, no por condicionales fijos
  de interfaz.
- El inicio de sesión y la renovación tienen límite de 10 solicitudes por minuto
  por instancia.

Roles iniciales:

| Rol | Alcance inicial |
|---|---|
| Administrador | Todos los permisos disponibles |
| Secretaria | Operación de clientes, alumnos, expedientes, documentos, actividades y reportes; sin administrar usuarios |
| Alumno | Perfil propio, catálogos, expedientes asignados, documentos permitidos y memoriales de sus casos |

Los roles y permisos pueden administrarse sin recompilar. La baja de usuario es
lógica para preservar la autoría histórica.

## Inventario de recursos

### Plataforma y sesión

- `GET /api/v1/system`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/revoke`
- `GET /api/v1/auth/me`
- `GET /health/live`
- `GET /health/ready`

### Usuarios, roles y permisos

- consulta paginada y detalle de usuarios;
- alta, modificación y baja lógica;
- asignación y retiro de roles con vigencia opcional;
- cambio de contraseña propia y restablecimiento administrativo;
- consulta, alta y modificación de roles;
- consulta del catálogo de permisos.

Base: `/api/v1/users` y `/api/v1/roles`.

### Clientes y evaluación de ingresos

- búsqueda paginada, detalle y perfil consolidado;
- alta y modificación de cliente;
- declaraciones de ingresos estructuradas;
- generación HTML imprimible de la declaración;
- asociación de documentos y expedientes.

Base: `/api/v1/clients`.

### Alumnos e inscripción

- búsqueda, detalle y perfil consolidado con expedientes;
- alta y modificación;
- solicitudes de inscripción;
- transiciones controladas de estado;
- requisitos, vigencia documental y observaciones;
- registro de carné y vigencia;
- acceso del alumno limitado a su perfil y casos asignados.

Base: `/api/v1/students`.

### Catálogos

- tipos de proceso y sus requisitos;
- alta/modificación administrativa de tipos y requisitos;
- requisitos de inscripción del alumno.

Base: `/api/v1/catalogs`.

La semilla contiene solamente los siete procesos evidenciados por las fuentes.
No se inventaron los aproximadamente dieciocho pendientes.

### Expedientes judiciales

- apertura y consulta paginada/detallada;
- requisitos copiados desde el catálogo al abrir el expediente;
- contraparte y sus datos;
- asignación temporal de uno o más alumnos;
- actuaciones cronológicas;
- memoriales con versiones y revisiones;
- presentación del memorial;
- notificaciones del juzgado;
- cierre y reapertura con motivo;
- último paso calculable desde la línea de tiempo.

Base: `/api/v1/cases`.

### Documentos

- carga multipart de PDF, JPEG, PNG y WebP;
- verificación de firma binaria, no solo extensión declarada;
- límite configurable, por defecto 25 MiB;
- SHA-256, tamaño, MIME, fecha, autor, origen y versión;
- contextos de cliente, alumno, expediente, memorial, notificación y reporte;
- descarga autorizada y listado filtrado;
- soporte de origen `Scanner` para archivos producidos por el componente local
  de adquisición;
- almacenamiento seleccionable local/S3 compatible;
- descarga local por streaming o redirección mediante URL firmada cuando el
  proveedor es S3.

Base: `/api/v1/documents`.

### Escaneo directo

- `POST /api/v1/scan-sessions`: selecciona contexto, casilla, proveedor y
  dispositivo;
- `POST /api/v1/scan-sessions/{id}/capture`: recibe el PDF o imagen producido
  por el equipo local;
- `GET /api/v1/scan-sessions/{id}/preview`: entrega la captura y registra que
  fue revisada;
- `POST /api/v1/scan-sessions/{id}/complete`: confirma y crea el documento
  versionado con origen `Scanner`;
- `POST /api/v1/scan-sessions/{id}/cancel`: cancela y elimina la captura
  temporal;
- `POST /api/v1/scan-sessions/{id}/failure`: conserva el código y mensaje de
  fallos de dispositivo o adquisición.

Las sesiones pertenecen al usuario que las inició, expiran, requieren el
permiso `scanner.use` y se limpian automáticamente. Solamente administrador y
secretaría reciben ese permiso inicialmente. Una confirmación exige una
previsualización posterior a la última captura.

### Operación, reportes y consultas

- actividades de secretaría con corrección trazable;
- reporte semanal, revisión, HTML imprimible y envío SMTP registrado;
- búsqueda global por cliente o alumno;
- consulta administrativa de auditoría;
- candidatos y vista previa de retención sin eliminación irreversible.

Bases: `/api/v1/activities`, `/api/v1/reports`, `/api/v1/search`,
`/api/v1/audit` y `/api/v1/retention`.

## Respuestas y concurrencia

- Los errores se entregan como `ProblemDetails`.
- Las validaciones de negocio producen 400, ausencia 404, conflicto 409,
  autenticación 401, autorización 403 y límite de solicitudes 429.
- Las entidades auditables usan un token de concurrencia optimista para no
  sobrescribir silenciosamente cambios simultáneos.
- Los listados principales son paginados.
- Los enums se serializan como nombres legibles.

## Límites funcionales intencionales

No constituyen defectos pendientes de programación:

1. La depuración destructiva permanece bloqueada hasta aprobar por escrito
   conservación, autorización, recuperación e impacto sobre el expediente legal.
2. La adquisición del escáner físico requiere el frontend o un agente instalado
   en la estación. El backend de sesiones, previsualización, confirmación,
   versionado, errores, expiración y auditoría ya está implementado.
3. El envío real requiere credenciales SMTP del cliente. Cada intento y error
   se registra.
4. Los tipos y requisitos no entregados se agregan por catálogo cuando exista
   fuente aprobada.
