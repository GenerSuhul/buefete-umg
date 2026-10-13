# Inscripción y edición de alumnos — 12 de octubre de 2026

## Requisito y decisiones

Actor: administrador o secretaría de la sede actual, con `students.write`.
El superusuario debe cambiar de contexto de sede antes de operar sus alumnos;
un lugar externo de práctica no cambia la sede propietaria del expediente.

Fuentes vigentes: RF-ALU-01/02/06/08/09/10, E2E-04 y
`00_FUENTES_Y_HALLAZGOS.md` (SRC-DOC-03/04). Las modalidades pasantía externa y
secretaría ad honorem están documentadas. Borrador/Presentada son estados de
alta; admisión, revisión, observación, aprobación/rechazo y cierre pertenecen al
trámite posterior. No se eliminan modalidades o controles documentales.

La recepción de documentos físicos no significa revisión ni aprobación. El alta
normal se presenta a revisión; se conserva borrador para capturas incompletas.
La fotografía de perfil es distinta del requisito de tres fotografías físicas.

## Trazabilidad y aceptación

| Requisito | Pantalla/acción | API/servicio | Persistencia/permisos | Prueba |
| --- | --- | --- | --- | --- |
| PDF o escáner antes del alta | Inscribir / papelería | agente NAPS2 existente → archivo revisado → POST documents → revisión de requisito | S3, documents, student_requirements; students.write/documents.write | capturar/importar, aceptar, guardar, refrescar y descargar |
| Fotografía de perfil | Inscribir / identidad | users/{id}/photo existente | documents/users.PhotoDocumentId, S3 | foto visible tras refresh |
| Sede del contexto | Alta/edición práctica | StudentService / TenantContext | enrollment_applications en BD de sesión | cliente no puede imponer otra sede interna |
| Edición completa | Editar perfil / práctica | PUT students/{id}, SaveStudentRequest.Practice | students/users/enrollment_applications, un SaveChanges, tokens de concurrencia, auditoría | modificar → guardar → refresh → reabrir; error no produce guardado parcial |
| Hora desplazable | TimePickerField | Sin API nueva | valor HH:mm existente | scroll interno conserva popup; selección y persistencia |
| Rango navegable | DateRangePickerField | Sin API nueva | fechas ISO existentes | inicio → cambiar mes/año directamente → final → aplicar |
| Estados coherentes | Alta y cambio de estado | EnrollmentRules y servicio existentes | status y requisitos obligatorios | alta presentada, aprobación bloqueada sin evidencia |

## Causas identificadas

- TimePicker cerraba con cualquier evento scroll capturado en document, incluidos
  los eventos de su propia lista.
- Rango no configuraba dropdown de mes/año; su cierre por scroll también afectaría
  los dropdowns personalizados portaleados.
- El alta sólo ofrecía FilePicker; el escáner existente presupone un propietario
  persistido. La captura previa debe mantenerse temporalmente y asociarse sólo
  después del alta, sin IDs ficticios ni alumnos parciales al navegar pasos.
- El endpoint de edición sólo aceptaba datos personales; faltaba un contrato de
  actualización de práctica vinculado al alumno y con concurrencia.
- Lugar asignado era texto libre, ajeno al contexto multitenant recién agregado.

## Cambios implementados

- `StudentsPage.tsx`: fotografía de perfil al iniciar; estado Presentada por defecto,
  Borrador conservado; sede responsable de sólo lectura e institución externa sólo
  para pasantía; jornada de práctica independiente de jornada académica; PDF o
  captura NAPS2 para cada uno de los nueve requisitos.
- `EnrollmentDocumentPicker.tsx`: captura previa al alta mediante el agente existente,
  selección de dispositivo, ADF/dúplex, revisión PDF y aceptación explícita. El archivo
  temporal se carga con origen Scanner después de existir la inscripción. No crea
  propietarios ficticios ni sustituye ScanWorkspace: la edición persistente por
  páginas del archivo ya registrado sigue disponible en el flujo documental existente.
- `StudentDetailPage.tsx`: edición directa de modalidad, dirección, jornada, días,
  horario y período además del perfil personal/académico/laboral. Estado, resolución,
  carné, papelería y autorización de acceso conservan sus acciones específicas.
- `SaveStudentRequest.Practice` → `StudentsController.Update` →
  `StudentService.UpdateStudentAsync` → `BufeteDbContext.SaveChangesAsync` →
  `students`, `users`, `enrollment_applications`, `audit_logs`. Se guardan los datos
  personales y de práctica en una sola transacción EF; tokens de alumno e inscripción
  controlan concurrencia. No hizo falta migración: columnas y token ya existían.
- Alta interna y edición imponen `TenantContext.Name`; la BD de la sesión determina
  la propiedad. El superusuario cambia de contexto; una institución externa no
  constituye un cambio de sede ni una asignación entre tenants.
- Controles compartidos: scroll dentro de hora/calendario/dropdown no cierra el
  popup; rango de un calendario con selectores de mes y año y fechas ISO existentes.
- Si falla un adjunto después del alta se informa que el alumno **ya existe** y se
  abre su perfil para completar documentos: no se repite el POST de inscripción.
  Si falla sólo la fotografía al editar, se informa que los datos sí quedaron guardados.
- Demo: compatibilidad del contrato de práctica, validación y token, con prueba
  aislada. No se desplegó Vercel en esta fase.

## Verificación realizada

- `dotnet test --no-restore`: **51 aprobadas** (30 unitarias + 21 integración).
- Vitest: **74 aprobadas / 17 archivos**, incluidos scroll, salto de año, captura
  previa con aceptación y recuperación sin agente, y edición de práctica en demo.
  Las pruebas simuladas de captura son unitarias; no acreditan hardware físico.
- Imágenes Docker API y web construidas; Next produjo las rutas de producción sin
  errores de TypeScript. Cuatro servicios Docker saludables.
- `scripts/student-enrollment-ui-e2e.cjs`: recorrido real aprobado en Chrome y una
  sede PostgreSQL temporal, sin modificar alumnos de Petén:
  1. administrador inicia sesión y crea alumno, cuenta e inscripción;
  2. carga foto visible en navegador y PDF en MinIO;
  3. conserva rango octubre 2026 → abril 2027 mediante salto mes/año;
  4. desplaza horas sin cierre y guarda 08:30–12:00;
  5. descarga PDF idéntico byte por byte;
  6. edita, refresca, reabre y comprueba práctica persistida;
  7. intenta imponer otra sede: el backend conserva la sede actual;
  8. horario inválido devuelve 400 y no guarda el cambio de nombre;
  9. versión antigua devuelve 409; sesión de otra sede devuelve 401;
  10. aprobación sin requisitos aceptados devuelve 409;
  11. PostgreSQL contiene auditoría de actualizaciones de inscripción;
  12. secretaría edita práctica de su sede y recupera los datos tras refrescar.
- Evidencia inicial (agente caído): `.artifacts/student-enrollment/qa-student-1791819471970/result.json`,
  `practica.png`, `edicion.png`. Sin excepciones JavaScript. La consola registró
  únicamente la conexión rechazada del agente durante el escenario negativo;
  dos requests abortados correspondieron a navegación/visor PDF. Logs API revisados,
  sin excepciones no controladas observadas.
- Segunda ronda con agente iniciado: `.artifacts/student-enrollment/qa-student-1791819716887/result.json`.
  Mismo E2E aprobado y descubrimiento real de dispositivos desde Chrome, sin
  simular respuestas del agente. No se ordenó captura física en equipos compartidos.
- Limpieza: se eliminaron exclusivamente las BD/filas de tenants QA creados por el
  script y sus objetos de prueba en prefijos MinIO propios. Los datos de negocio,
  volúmenes y objetos de Petén se conservaron.

## Pendiente físico y alcance

Después de la prueba negativa se inició `scripts/start-scanner-agent.ps1`:
`/health` respondió ready=true, NAPS2 2.0.0, WIA/TWAIN/ESCL.
`/devices` sí descubrió 12 entradas de controladores y equipos
Canon/Epson/HP (varias entradas pueden corresponder al mismo equipo). Falta acreditar la
adquisición de papel real con el escáner de la oficina, incluidas ADF y dúplex.
La revisión/carga de PDF sí se probó con almacenamiento real. Esto valida el flujo
descrito, no equivale a certificar todos los módulos ni alta disponibilidad del host.

Acceso local actualizado: http://127.0.0.1:5180/personas/alumnos.
