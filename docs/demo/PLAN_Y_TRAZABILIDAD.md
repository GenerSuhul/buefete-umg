# Demo independiente y sedes

Estado: implementación en `codex/demo-multisede`. No se modifica la base de datos, los contenedores ni la rama de producción.

## Decisión y aceptación

La demo de revisión usa la misma interfaz y contratos TypeScript, con un backend de demostración en Next.js, PostgreSQL Neon y almacenamiento privado Vercel Blob. No sustituye al backend .NET de producción. El almacenamiento de prueba es independiente. Sólo se admiten datos ficticios.

La sede es un límite de datos, no un filtro visual: cada sesión queda vinculada a una sede; el servidor valida el acceso antes de consultar registros o archivos. El administrador de plataforma crea sedes; las cuentas locales sólo acceden a su sede. Cambiar de sede emite una sesión nueva y reinicia el estado de pantalla. No se permite seleccionar una sede arbitraria mediante un ID enviado con una operación de negocio.

La administración definitiva (institución, sedes, delegación y retención) requiere validación del cliente antes de trasladar este modelo a .NET. La demo usa un agregado JSONB por sede y bloqueo transaccional; es deliberadamente un entorno pequeño de revisión, no una arquitectura de alta disponibilidad para producción.

## Matriz

| Requisito | Módulo/pantalla/acción | Endpoint | Servicio/persistencia | Permiso | Prueba de aceptación |
|---|---|---|---|---|---|
| Acceso aislado | Acceso/iniciar sesión | POST /api/demo | Auth + sesiones PostgreSQL | Cuenta vigente | Credencial válida, inválida y sesión revocada |
| Varias sedes | Sedes/crear/cambiar | POST /api/demo | Control plane + demo_tenants | Administrador de plataforma | Crear sede vacía, cambiar, volver y comprobar aislamiento |
| Personas y expedientes | Usuarios, alumnos, expedientes/CRUD | POST /api/demo | Dominio demo + agregado transaccional por sede | Rol local | Crear, guardar, recargar, editar, vincular y recuperar |
| Documentos y fotos | Papelería/adjuntar/revisar/descargar | POST /api/demo | Metadata PostgreSQL + Blob privado | Rol y propietario de sede | Subir bytes, recuperar bytes, rechazar acceso cruzado |
| Inscripción/asignación | Alumno/papelería/aprobar/asignar | POST /api/demo | Reglas de requisitos + relaciones | Rol local | No aceptar sin evidencia; no asignar sin aprobación |
| Seguimiento | Expediente/memorial/revisión/notificación/cierre | POST /api/demo | Dominio + histórico | Rol local | Versiones, revisión, estado e histórico tras recarga |
| Eliminados | Listados/eliminar/restaurar | POST /api/demo | Estado lógico e histórico | Administrador local | Desaparece, conserva relaciones, restaura |
| Manual | Ayuda/descargar | /manual-demo.pdf | PDF versionado | Acceso al entorno | Renderizado visual y concordancia con flujos |

## Límites explícitos

- No enviar correos reales, notificaciones judiciales ni documentos a terceros desde la demo.
- Escáner físico depende del agente local y dispositivo; la importación de PDF/imágenes es alternativa.
- Máximo de archivo de demo: 3 MiB por solicitud.
- No importar usuarios, credenciales, fotografías ni expedientes reales de la instalación actual.
- Cualquier prueba no ejecutada se registra como pendiente; un build no equivale a aceptación funcional.

## Evidencia de validación · 9 de octubre de 2026

- Suite frontend: 15 archivos, 67 pruebas aprobadas. La suite incluye 5 pruebas nuevas del dominio demo.
- TypeScript y detección de código sin uso: aprobados. Auditoría npm: cero vulnerabilidades reportadas.
- Build Next de producción y despliegue Vercel: aprobados. URL: https://bufete-umg-demo.vercel.app.
- Integración local y publicada: 78 comprobaciones por ejecución contra PostgreSQL y Blob reales, no fixtures. Incluyen concurrencia/conflicto 409, CRUD, inscripción con evidencia, asignación, memorial/versiones, seguimiento, reportes, importación de escáner con vista previa obligatoria, recuperación de bytes y fotografías, suspensión/restauración, eliminación lógica, aislamiento entre sedes y revocación de sesión.
- Navegador publicado: inicio de sesión, creación de sede de evaluación, confirmación de cambio, sede vacía, retorno a Petén con registros conservados, perfil académico aprobado y papelería tras recarga, descarga real de PDF. Consola consultada sin errores/advertencias durante el recorrido. El visor PDF integrado del navegador de pruebas no renderizó el iframe; la recuperación del archivo sí se comprobó y su vista integrada debe revisarse también en el navegador del cliente. Se mantienen los ejemplos ficticios y la sede de evaluación para revisión del cliente; se retiran las sedes técnicas desechables.
- Manual: 14 páginas renderizadas e inspeccionadas; corregidos saltos que dejaban texto huérfano. Incluye recorridos, roles, límites y lista de revisión.
- Pendiente de aceptación del cliente: gobierno definitivo de tenants e integración de ese dominio en .NET; pruebas de escáner físico y entrega de correo real. No se presentan como aprobados ni se declara disponibilidad de producción.

## Referencias de diseño

- Microsoft Azure Architecture Center: https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data
- Vercel Storage: https://vercel.com/docs/storage
- Vercel Blob privado: https://vercel.com/docs/vercel-blob/private-storage
