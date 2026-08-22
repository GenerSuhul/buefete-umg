# Auditoría funcional y E2E — 15 de agosto de 2026

## Dictamen

El sistema tenía desviaciones críticas en inscripción de alumnos, identidad de
acceso, estabilidad de formularios y elegibilidad para asignar casos. La auditoría
se realizó contra los cuatro DOCX, las siete fotografías, la transcripción de la
reunión, la memoria vigente, la UI, API, reglas de dominio y PostgreSQL.

## Evidencia de las fuentes

La ficha de estudiantes exige nombre, edad, carné, DPI, semestre, jornada, datos
laborales, residencia, teléfonos, correo, fecha de inscripción, modalidad, lugar,
días y horario de práctica. La papelería consolidada contiene nueve casillas:
solicitud, DPI, CV, tres fotografías, certificación de cursos, inscripción, pago
del Bufete, pago anual UMG e inscripción anual condicional por pensum cerrado.
Ninguna fuente exige un nombre de usuario separado del correo.

El catálogo evidenciado contiene siete procesos y requisitos para seis. No deben
inventarse los tipos restantes hasta que el cliente los entregue.

## Hallazgos críticos encontrados

1. El modal global dependía de una función `onClose` recreada en cada render. Cada
   pulsación reinstalaba el control de foco y expulsaba al usuario del campo.
2. La autenticación consultaba `NormalizedUsername`, no el correo.
3. El alta pública permitía crear alumnos sin cuenta. En la base local había 15
   alumnos: 5 vinculados y 10 sin cuenta.
4. Las 15 inscripciones locales estaban en `Draft` porque el backend imponía ese
   estado y el alta no permitía seleccionarlo.
5. El formulario omitía campos y documentos de la ficha, pero pedía un alias de
   usuario no respaldado por las fuentes.
6. Era posible asignar un alumno activo sin comprobar una inscripción aprobada.
7. Las pantallas de sólo lectura mostraban acciones de escritura aunque el backend
   posteriormente pudiera rechazarlas.
8. Al editar un alumno se forzaba `IsActive=true`, reactivándolo implícitamente.
9. SMTP está deshabilitado en desarrollo; el flujo registra un envío fallido de
   forma trazable, pero no puede entregar correo hasta configurar proveedor.
10. La depuración continúa correctamente limitada a vista previa hasta aprobar la
    política de retención y eliminación.

## Correcciones aplicadas

- Foco estable en todos los modales controlados.
- Inicio de sesión por correo electrónico en API, frontend y scripts E2E.
- Alta transaccional de perfil, inscripción y cuenta; eliminado el endpoint público
  que generaba alumnos sin cuenta.
- Correo usado como identidad de acceso del alumno y sincronizado al editarlo.
- Estado inicial `Draft` o `Submitted` solicitado durante el alta.
- Formulario alineado con datos personales, laborales y de práctica de la ficha.
- Nueve casillas de carga documental incorporadas al alta.
- Asignación permitida únicamente con inscripción aprobada.
- Baja lógica/reactivación de alumno, bloqueo si conserva casos activos y sincronía
  con su cuenta de acceso.
- Acciones administrativas ocultas para el rol Alumno.
- Corregido E2E-05: se selecciona alumno, no contraparte.

## Estado de los 15 flujos

| Flujo | Estado después de correcciones | Observación |
|---|---|---|
| E2E-01 Usuarios | Parcial | Usuario administrador posee ciclo completo; falta ratificar alcance exacto de secretaría sobre cuentas |
| E2E-02 Clientes | Parcial | API almacena la ficha amplia; la UI de alta todavía no expone todos los campos originales |
| E2E-03 Apertura | Parcial | Catálogo real correcto; la lista de requisitos se visualiza después de abrir, no antes de confirmar |
| E2E-04 Alumnos | Corregido | Alta integrada, correo, estado, ficha y papelería real |
| E2E-05 Asignación | Corregido | Exige alumno activo con inscripción aprobada |
| E2E-06 Memoriales | Implementado | Versiones, revisión, presentación y documentos |
| E2E-07 Notificaciones | Implementado | Fecha, documento, descripción y línea cronológica |
| E2E-08 Consulta cliente | Implementado | Búsqueda, perfil, procesos y último paso |
| E2E-09 Consulta alumno | Implementado | Aislamiento por recurso y vista de casos propios |
| E2E-10 Reporte semanal | Parcial | Generación/revisión/impresión funcionan; SMTP local está deshabilitado |
| E2E-11 Trazabilidad | Implementado | Auditoría de entidad, petición y autenticación |
| E2E-12 Retención | Seguro/parcial | Sólo candidatos y vista previa; ejecución bloqueada por decisión pendiente |
| E2E-13 Correcciones | Parcial | Actividades y documentos conservan historial; faltan correcciones explícitas en algunos datos núcleo |
| E2E-14 Secretaría ad honorem | Parcial | Modalidad y rol existen; falta automatizar otorgamiento/retiro por resolución y período |
| E2E-15 Vigencia/naturaleza | Implementado | Naturaleza, fecha, caducidad y estados se validan en backend |

## Validación ejecutada

- Compilación .NET: correcta, cero advertencias y cero errores.
- Pruebas .NET: 21 aprobadas.
- Compilación frontend: correcta; queda advertencia de paquete principal mayor a 500 KB.
- Pruebas frontend: 5 aprobadas, incluida regresión del foco del modal.
- E2E backend en PostgreSQL temporal: todos los módulos reportaron `OK`.
- Humo contra PostgreSQL local: `live=200`, `ready=200`, autenticación correcta,
  7 procesos, acceso anónimo protegido con `401`.

## Deuda priorizada restante

1. Completar la ficha de cliente en la UI y mostrar requisitos antes de abrir caso.
2. Regularizar con un flujo de invitación/restablecimiento los 10 alumnos históricos
   sin cuenta; no asignar contraseñas silenciosamente.
3. Completar baja lógica y reactivación visibles para clientes y archivado formal de
   expedientes cerrados, sin borrado físico que destruya trazabilidad.
4. Configurar SMTP y ejecutar entrega real controlada.
5. Automatizar el rol temporal de secretaría ad honorem.
6. Añadir pruebas UI/E2E de todos los permisos y flujos, y dividir el paquete JS.
