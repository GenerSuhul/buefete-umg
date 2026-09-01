# Catálogo de casos de uso

## 1. Convenciones

- **Actor principal:** quien inicia la interacción.
- **Precondición:** situación que debe existir antes de comenzar.
- **Resultado:** condición observable al finalizar correctamente.
- Los permisos marcados como pendientes no deben implementarse definitivamente
  hasta su validación con el cliente.

## 2. Resumen

| ID | Caso de uso | Actor principal | Prioridad MVP |
|---|---|---|:---:|
| CU-01 | Iniciar sesión | Usuario interno | Alta |
| CU-02 | Administrar usuario interno | Administrador / secretaría autorizada | Alta |
| CU-03 | Dar de baja o eliminar usuario | Administrador | Alta |
| CU-04 | Registrar cliente | Secretaría / administrador | Alta |
| CU-05 | Gestionar papelería del cliente | Secretaría / administrador | Alta |
| CU-06 | Digitalizar documento con escáner | Secretaría / administrador | Media, sujeta a factibilidad |
| CU-07 | Configurar tipos y requisitos de proceso | Actor por confirmar | Alta |
| CU-08 | Abrir proceso | Secretaría / administrador | Alta |
| CU-09 | Consultar expediente del proceso | Secretaría / administrador | Alta |
| CU-10 | Registrar alumno y papelería | Secretaría / administrador | Alta |
| CU-11 | Asignar caso a alumno | Secretaría / administrador | Alta |
| CU-12 | Consultar casos de un alumno | Secretaría / administrador | Alta |
| CU-13 | Registrar memorial | Actor autorizado por confirmar | Alta |
| CU-14 | Registrar revisión de memorial | Actor autorizado por confirmar | Alta |
| CU-15 | Registrar presentación al juzgado | Secretaría / administrador | Alta |
| CU-16 | Registrar notificación del juzgado | Secretaría / administrador | Alta |
| CU-17 | Registrar otro paso procesal | Secretaría / administrador | Alta |
| CU-18 | Buscar cliente o alumno | Secretaría / administrador | Alta |
| CU-19 | Consultar último paso del caso | Secretaría / administrador | Alta |
| CU-20 | Registrar actividad de secretaría | Secretaría | Alta |
| CU-21 | Generar e imprimir reporte semanal | Secretaría / responsable | Alta |
| CU-22 | Enviar reporte por correo | Responsable autorizado | Alta |
| CU-23 | Consultar trazabilidad | Actor autorizado por confirmar | Alta |
| CU-24 | Cerrar proceso o participación | Actor autorizado por confirmar | Alta |
| CU-25 | Depurar expedientes | Administrador recomendado | Pendiente de política |
| CU-26 | Registrar declaración jurada de ingresos | Secretaría / administrador | Alta |
| CU-27 | Tramitar solicitud de inscripción del alumno | Actor autorizado por confirmar | Alta |
| CU-28 | Gestionar modalidad, jornada y carné | Actor autorizado por confirmar | Alta |
| CU-29 | Habilitar alumno como secretaría ad honorem | Administrador | Alta si aplica esta modalidad |

## 3. Casos de uso detallados

### CU-01. Iniciar sesión

**Actor principal:** usuario interno.  
**Precondición:** posee una cuenta habilitada.  
**Disparador:** necesita operar el sistema.

**Flujo principal**

1. El actor ingresa sus credenciales.
2. El sistema las valida.
3. El sistema abre la sesión y muestra las funciones permitidas.
4. El sistema asocia las acciones posteriores con ese usuario.

**Excepciones:** credenciales inválidas, cuenta inactiva o período vencido.  
**Resultado:** existe una sesión autenticada y trazable.

### CU-02. Administrar usuario interno

**Actor principal:** administrador; secretaría para las acciones que se le
confirmen.  
**Precondición:** sesión con permiso de administración.

**Flujo principal**

1. El actor abre la lista de usuarios.
2. Crea un registro nuevo o selecciona uno existente.
3. Registra o modifica nombre, rol, fotografía y período.
4. Confirma los cambios.
5. El sistema valida y guarda.
6. La operación queda auditada.

**Resultado:** el perfil y la vigencia del usuario quedan actualizados.

### CU-03. Dar de baja o eliminar usuario

**Actor principal:** administrador.  
**Precondición:** el usuario objetivo existe.

**Flujo principal**

1. El administrador selecciona al usuario.
2. Solicita la baja o eliminación.
3. El sistema advierte el impacto y solicita confirmación.
4. El administrador confirma.
5. El sistema impide nuevos accesos y conserva la autoría histórica, salvo que
   el cliente apruebe otra regla.
6. Registra la acción.

**Excepción:** una secretaría intenta la operación; el sistema la rechaza.  
**Resultado:** la cuenta deja de estar disponible sin volver anónimas sus acciones.

### CU-04. Registrar cliente

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor busca coincidencias por nombre.
2. Si no corresponde a una persona existente, solicita el alta.
3. Ingresa identidad, residencia, escolaridad, ocupación, salario, cantidad de
   hijos y asistencia solicitada.
4. Registra nombre y dirección de la persona de quien reclama un derecho, cuando
   corresponda.
5. Registra lugar, fecha y evidencia de firma o impresión digital.
6. Confirma el registro.
7. El sistema crea el perfil sin acceso al sistema.
8. Registra al autor del alta.

**Resultado:** el cliente está disponible para adjuntar papelería y abrir procesos.

### CU-05. Gestionar papelería del cliente

**Actor principal:** secretaría o administrador.  
**Precondición:** el cliente existe.

**Flujo principal**

1. El actor abre la papelería del cliente.
2. Selecciona una casilla etiquetada.
3. Adjunta un PDF o imagen.
4. Revisa el archivo cargado.
5. Confirma.
6. El sistema marca el requisito como disponible y registra autor y fecha.

**Alternativas:** reemplazar un archivo incorrecto; dejar un requisito pendiente.  
**Resultado:** la papelería queda organizada e identificable.

### CU-06. Digitalizar documento con escáner

**Actor principal:** secretaría o administrador.  
**Precondiciones:** cliente o expediente abierto; escáner compatible disponible.

**Flujo principal esperado**

1. El actor selecciona la casilla documental.
2. Pulsa `Escanear`.
3. El sistema permite adquirir la imagen o PDF desde el equipo.
4. El actor previsualiza el resultado.
5. Confirma la asociación con la casilla.
6. El sistema registra archivo, fecha y autor.

**Excepciones:** escáner no detectado, digitalización cancelada o ilegible.  
**Resultado:** el documento queda adjunto sin guardado manual intermedio.  
**Nota:** requiere validación técnica antes de comprometer la implementación.

### CU-07. Configurar tipos y requisitos de proceso

**Actor principal:** pendiente de confirmar.  
**Precondición:** existe una lista parcial o completa aprobada por el cliente;
actualmente solo se han evidenciado siete tipos.

**Flujo principal**

1. El actor selecciona un tipo de proceso o crea uno autorizado.
2. Registra su nombre.
3. Agrega y ordena las casillas de documentos requeridos.
4. Guarda la configuración.
5. El sistema la ofrece al abrir procesos de ese tipo.

**Resultado:** el tipo despliega su lista documental correcta.

### CU-08. Abrir proceso

**Actor principal:** secretaría o administrador.  
**Precondiciones:** el cliente y el tipo de proceso existen.

**Flujo principal**

1. El actor abre el perfil del cliente.
2. Elige `Abrir proceso`.
3. Selecciona el tipo.
4. El sistema presenta los requisitos correspondientes.
5. El actor adjunta o verifica la documentación.
6. Confirma la apertura.
7. El sistema crea el expediente y su seguimiento cronológico.

**Resultado:** existe un proceso identificable con estado y papelería.

### CU-09. Consultar expediente del proceso

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor accede al proceso desde cliente, alumno o búsqueda.
2. El sistema muestra cliente, tipo, alumno asignado, estado y último paso.
3. El actor consulta requisitos, documentos y línea de tiempo.

**Resultado:** el actor conoce la situación documentada del caso.

### CU-10. Registrar alumno y papelería

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor busca posibles coincidencias.
2. Registra datos personales, académicos, laborales y de contacto.
3. Registra fecha de inscripción, tipo de práctica, sede, jornada y horario.
4. El sistema muestra sus requisitos documentales.
5. El actor carga solicitud, DPI, Curriculum Vitae, fotografías, certificación
   original de cursos y boletas o pagos aplicables.
6. El sistema muestra completitud y pendientes.
7. Registra autor y fecha de cada acción.

**Resultado:** el alumno tiene un perfil listo para consulta y eventual asignación.

### CU-11. Asignar caso a alumno

**Actor principal:** secretaría o administrador.  
**Precondiciones:** alumno y proceso existentes.

**Flujo principal**

1. El actor solicita la asignación.
2. Selecciona alumno y proceso.
3. Confirma la relación.
4. El sistema actualiza ambos perfiles.
5. Registra quién asignó y cuándo.

**Resultado:** el caso aparece entre los asignados al alumno.

### CU-12. Consultar casos de un alumno

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor abre el perfil del alumno.
2. El sistema lista todos los casos asignados.
3. Cada elemento muestra cliente, proceso, estado y último paso.
4. El actor abre el caso que necesita revisar.

**Resultado:** se conoce la carga y avance de casos del alumno.

### CU-13. Registrar memorial

**Actor principal:** usuario autorizado por confirmar.  
**Precondición:** proceso abierto.

**Flujo principal**

1. El actor selecciona `Agregar memorial`.
2. Indica fecha y descripción.
3. Adjunta el documento recibido del alumno.
4. Confirma.
5. El sistema incorpora el memorial a la línea de tiempo.

**Resultado:** existe una versión inicial lista para revisión.

### CU-14. Registrar revisión de memorial

**Actor principal:** revisor autorizado por confirmar.  
**Precondición:** existe un memorial.

**Flujo principal**

1. El actor abre el memorial.
2. Agrega una revisión con fecha y observaciones.
3. Adjunta la versión revisada cuando corresponda.
4. Indica si requiere modificación o puede continuar.
5. El sistema conserva el ciclo en orden temporal.

**Resultado:** la revisión y su responsable pueden consultarse posteriormente.

### CU-15. Registrar presentación al juzgado

**Actor principal:** secretaría o administrador.  
**Precondición:** el memorial está listo y fue llevado al juzgado.

**Flujo principal**

1. El actor abre el memorial relacionado.
2. Registra fecha y resultado de la presentación.
3. Adjunta lo presentado y la constancia disponible.
4. Confirma.
5. El sistema actualiza la línea de tiempo y el último paso.

**Resultado:** queda evidencia de qué y cuándo se presentó.

### CU-16. Registrar notificación del juzgado

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor localiza el proceso.
2. Agrega la notificación con su fecha.
3. Adjunta la resolución o documento recibido.
4. Actualiza estado o etapa si corresponde.
5. Confirma.
6. El sistema muestra la notificación cronológicamente.

**Resultado:** la respuesta judicial queda disponible como evidencia y seguimiento.

### CU-17. Registrar otro paso procesal

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor selecciona el proceso.
2. Elige el tipo de paso o indica una descripción.
3. Registra fecha, detalle y adjuntos opcionales.
4. Confirma.
5. El sistema actualiza el último paso.

**Resultado:** el expediente digital refleja cada etapa relevante, no solo
memoriales y notificaciones.

### CU-18. Buscar cliente o alumno

**Actor principal:** secretaría o administrador.

**Flujo principal**

1. El actor escribe un nombre en la barra de búsqueda.
2. El sistema muestra todas las coincidencias.
3. Cada resultado indica si es cliente o alumno.
4. El actor selecciona el registro correcto.

**Resultado:** accede rápidamente al perfil buscado.

### CU-19. Consultar último paso del caso

**Actor principal:** secretaría o administrador.  
**Precondición:** el proceso existe.

**Flujo principal**

1. El actor abre el proceso desde una búsqueda o perfil.
2. El sistema destaca la actuación más reciente.
3. El actor consulta su fecha, descripción, autor y documento adjunto.

**Resultado:** puede informar en qué punto se encuentra el caso.

### CU-20. Registrar actividad de secretaría

**Actor principal:** secretaría.

**Flujo principal**

1. La secretaría selecciona `Registrar actividad`.
2. Indica fecha, actividad ejecutada y detalle.
3. Relaciona alumno, cliente o proceso si corresponde.
4. Guarda.
5. El sistema atribuye el registro a su cuenta.

**Resultado:** la actividad queda disponible para el reporte semanal.

### CU-21. Generar e imprimir reporte semanal

**Actor principal:** secretaría o responsable autorizado.

**Flujo principal**

1. El actor elige el período semanal.
2. El sistema reúne las actividades correspondientes.
3. El actor revisa el contenido.
4. Genera la versión imprimible.
5. Imprime o descarga para el oficio correspondiente.

**Resultado:** existe un reporte consistente con el registro de actividades.

### CU-22. Enviar reporte por correo

**Actor principal:** responsable autorizado.  
**Precondición:** el reporte fue revisado.

**Flujo principal**

1. El actor abre el reporte.
2. Revisa destinatarios y contenido.
3. Pulsa `Enviar por correo`.
4. El sistema realiza el intento de envío.
5. Muestra confirmación o error.
6. Registra al usuario responsable.

**Resultado:** el reporte se envía sin redactarlo nuevamente.

### CU-23. Consultar trazabilidad

**Actor principal:** pendiente de confirmar.

**Flujo principal**

1. El actor abre el historial de un registro o una consulta global.
2. Filtra por usuario, fecha, acción o expediente.
3. El sistema muestra quién creó, modificó o dio seguimiento.
4. El actor consulta el detalle permitido.

**Resultado:** las responsabilidades pueden reconstruirse.

### CU-24. Cerrar proceso o participación

**Actor principal:** pendiente de confirmar.  
**Precondición:** se cumplieron las condiciones institucionales.

**Flujo principal**

1. El actor abre el proceso o asignación.
2. Solicita cerrarlo.
3. Indica fecha y motivo o resultado.
4. Confirma.
5. El sistema actualiza el estado y registra la acción.

**Resultado:** el elemento deja de figurar como activo y comienza, cuando
corresponda, el período de conservación.

### CU-25. Depurar expedientes

**Actor principal recomendado:** administrador.  
**Precondiciones:** política aprobada y expedientes elegibles.

**Flujo principal propuesto**

1. El administrador consulta candidatos.
2. Selecciona los expedientes.
3. El sistema muestra todos los datos y archivos afectados.
4. El administrador confirma expresamente.
5. El sistema elimina o anonimiza lo autorizado.
6. Presenta un resultado y conserva el rastro mínimo permitido.

**Excepciones:** expediente aún no elegible, proceso activo, error parcial o
falta de permiso.  
**Resultado:** la información autorizada queda depurada.  
**Estado:** bloqueado para implementación hasta definir política y alcance.

### CU-26. Registrar declaración jurada de ingresos

**Actor principal:** secretaría o administrador.  
**Precondición:** el cliente existe o está siendo registrado.

**Flujo principal**

1. El actor abre la declaración jurada de ingresos.
2. Registra datos personales, de residencia y contacto.
3. Registra empresa, dirección laboral y salario mensual o quincenal.
4. El cliente declara que es persona de escasos recursos y solicita el servicio.
5. Se registra lugar y fecha.
6. Se adjunta o captura evidencia de firma o impresión digital.
7. El sistema vincula la declaración con el expediente del cliente.
8. La operación queda auditada.

**Resultado:** el expediente conserva la justificación socioeconómica utilizada
para la recepción del servicio.

### CU-27. Tramitar solicitud de inscripción del alumno

**Actor principal:** responsable autorizado por confirmar.  
**Precondiciones:** existe perfil de alumno y se presentó el memorial.

**Flujo principal**

1. El actor registra la solicitud dirigida a la Dirección.
2. Asocia los documentos presentados.
3. Inicia la formación del expediente.
4. Verifica requisitos académicos y administrativos.
5. Registra admisión, observaciones o documentos faltantes.
6. Registra la resolución favorable o desfavorable.
7. El sistema conserva fechas, responsables y evidencia de la decisión.

**Resultado:** la solicitud tiene estado y resolución consultables.

### CU-28. Gestionar modalidad, jornada y carné

**Actor principal:** responsable autorizado por confirmar.  
**Precondición:** la inscripción del alumno fue aprobada.

**Flujo principal**

1. El actor selecciona la modalidad de práctica.
2. Registra sede, dirección, jornada, días y horario.
3. Registra fecha de inicio y finalización.
4. Registra la emisión y entrega del carné del Bufete Popular.
5. El sistema muestra la asignación vigente en el perfil del alumno.

**Resultado:** la participación académica del alumno queda formalizada.

### CU-29. Habilitar alumno como secretaría ad honorem

**Actor principal:** administrador.  
**Precondiciones:** solicitud aprobada para secretaría ad honorem y período
vigente.

**Flujo principal**

1. El administrador abre el perfil del alumno aprobado.
2. Verifica modalidad, jornada y período.
3. Crea o habilita su cuenta personal.
4. Asigna permisos de secretaría sin permitir eliminar usuarios.
5. El sistema registra la autorización y vigencia.
6. Al finalizar el período, el administrador retira los permisos.
7. El historial de acciones permanece atribuido a la persona.

**Resultado:** el estudiante puede operar como secretaría durante la modalidad
autorizada sin dejar de ser alumno en su expediente académico.

### CU-30. Eliminar lógicamente y restaurar registros operativos

**Actores:** secretaría o administrador para eliminar; administrador para
consultar y restaurar.
**Precondición:** existe un cliente, alumno o expediente activo.

1. El actor solicita eliminar el registro y confirma el alcance.
2. El sistema lo oculta de la operación ordinaria y conserva datos, documentos,
   usuario, fecha, motivo e identificador de lote.
3. Solo el administrador puede consultarlo en `Eliminados`.
4. El administrador puede restaurarlo; las dependencias del mismo lote se
   recuperan de forma consistente.
5. Eliminación y restauración quedan auditadas.

**Resultado:** el registro no es visible durante la operación diaria, pero puede
recuperarse sin ejecutar una eliminación física.

## 4. Relaciones entre casos de uso

- CU-08 depende de CU-04 y CU-07.
- CU-11 depende de CU-08 y CU-10.
- CU-14 depende de CU-13.
- CU-15 normalmente sucede después de CU-14.
- CU-16 puede suceder después de CU-15 u otra actuación judicial.
- CU-19 utiliza la información generada por CU-13 a CU-17.
- CU-21 utiliza las actividades de CU-20.
- CU-22 depende de CU-21 y de revisión previa.
- CU-23 cruza todos los casos de uso que modifican o consultan información
  sensible.
- CU-25 depende de CU-24 y de una política de conservación aprobada.
- CU-26 complementa CU-04 y puede formar parte del mismo recorrido de recepción.
- CU-27 depende de CU-10 y de la revisión de su papelería.
- CU-28 depende de una resolución favorable en CU-27.
- CU-29 depende de CU-28 y no sustituye el perfil académico del alumno.
- CU-30 es independiente de CU-25: la primera es reversible y la segunda es una
  depuración física sujeta a política institucional.
