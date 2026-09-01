# Flujos funcionales end-to-end

## Cómo leer este documento

Cada flujo describe el recorrido completo desde una necesidad operativa hasta un
resultado verificable. No define pantallas ni tecnología. Los pasos marcados
como pendientes dependen de decisiones del cliente.

## E2E-01. Alta y habilitación de un usuario interno

**Objetivo:** permitir que una persona autorizada opere con identidad propia y
que sus acciones sean trazables.

**Actor principal:** administrador general.  
**Precondición:** el administrador tiene una sesión válida.

### Flujo principal

1. El administrador abre la gestión de usuarios.
2. Solicita crear un usuario interno.
3. Registra nombre, rol, fotografía opcional, fecha de inicio y fecha de fin.
4. Define o genera sus credenciales de acceso.
5. Confirma el registro.
6. El sistema habilita la cuenta según su período y estado.
7. El nuevo usuario inicia sesión con su identidad.
8. A partir de ese momento, cada acción queda asociada a esa cuenta.

**Resultado:** existe un usuario identificable y sus permisos corresponden a su
rol.

**Alternativas:** si los datos de acceso ya existen, el sistema rechaza el alta;
si todavía no inicia el período, la cuenta permanece sin acceso.

## E2E-02. Registro de cliente y conformación de papelería

**Objetivo:** crear el expediente inicial de una persona atendida.

**Actor principal:** secretaría o administrador.  
**Precondición:** el actor inició sesión.

### Flujo principal

1. El usuario busca al cliente para evitar registrar una coincidencia evidente.
2. Si no existe, selecciona `Registrar cliente`.
3. Ingresa los datos de la ficha de recepción: identidad, residencia, ocupación,
   ingresos, cantidad de hijos y asistencia solicitada.
4. Registra, cuando corresponda, el nombre y dirección de la persona de quien el
   cliente reclama un derecho.
5. Completa la declaración jurada de ingresos o adjunta su versión firmada.
6. Registra lugar, fecha y evidencia de firma o impresión digital.
7. El sistema crea el perfil interno del cliente, sin credenciales de acceso.
8. El usuario abre la sección de papelería.
9. Selecciona una casilla etiquetada, por ejemplo `DPI`.
10. Adjunta un PDF o imagen, o utiliza `Escanear` si la integración está disponible.
11. Repite el procedimiento para certificaciones y demás documentos.
12. El sistema muestra requisitos adjuntos y pendientes.
13. Cada captura y carga queda registrada con fecha y usuario responsable.

**Resultado:** el cliente puede localizarse y su documentación está ordenada por
tipo de requisito.

**Alternativas:** si existe una coincidencia, el usuario revisa el perfil antes
de decidir si continúa; si el archivo no es admitido o falla el escaneo, el
sistema informa el error sin marcar el requisito como completo.

## E2E-03. Apertura de un proceso judicial

**Objetivo:** crear el expediente digital correspondiente a un servicio jurídico.

**Actor principal:** secretaría o administrador.  
**Precondiciones:** el cliente existe; el tipo de proceso y sus requisitos están
disponibles.

### Flujo principal

1. El usuario localiza y abre el perfil del cliente.
2. Selecciona `Abrir proceso`.
3. Elige uno de los tipos de proceso, por ejemplo pensión alimenticia.
4. El sistema despliega la lista específica de documentos requeridos.
5. El sistema indica si cada requisito es documento, dato o condición, y si
   requiere original, copia, vigencia o aplicación condicional.
6. El usuario incorpora o verifica la papelería disponible en cada casilla.
7. Registra datos complementarios, por ejemplo información de la contraparte,
   fecha de separación o período del estado de cuenta, cuando apliquen.
8. Adjunta los requisitos que aún falten.
9. Revisa el resumen de documentos completos, vencidos y pendientes.
10. Confirma la apertura.
11. El sistema crea el expediente digital y registra quién lo abrió.

**Resultado:** el cliente tiene un proceso consultable con estado inicial,
requisitos y línea de tiempo disponible.

**Pendiente:** confirmar si puede abrirse el proceso con requisitos incompletos.

## E2E-04. Inscripción y expediente del alumno

**Objetivo:** registrar al alumno y verificar su documentación para participar
en los casos.

**Actor principal:** secretaría o administrador.

### Flujo principal

1. El usuario busca al alumno para descartar duplicidad.
2. Selecciona `Agregar alumno`.
3. Registra datos personales, académicos, laborales y de contacto.
4. Indica la modalidad solicitada: práctica civil/familia, pasantía externa o
   secretaría ad honorem.
5. Registra sede, jornada, días, horario y período previsto.
6. Selecciona el estado inicial permitido de la solicitud: `Borrador` o `Presentada`.
7. Registra el correo que también funcionará como identidad de acceso y define
   la contraseña temporal; no existe un nombre de usuario separado.
8. El sistema muestra las casillas de requisitos del alumno.
9. El usuario carga solicitud dirigida a la Dirección, DPI, Curriculum Vitae,
   fotografías, certificación original de cursos y boletas de inscripción o
   pago aplicables.
10. El sistema indica cuáles requisitos están completos o pendientes.
11. La Dirección o responsable admite y revisa el trámite.
12. Se registra la resolución.
13. Si es favorable, se registra o genera el carné del Bufete Popular.
14. El alumno queda disponible para asignación o inicio de modalidad cuando
    cumpla las condiciones institucionales.

**Resultado:** existe un perfil integral con papelería y espacio para casos
asignados.

**Decisión vigente:** el alumno recibe credenciales basadas en su correo y sólo
puede consultar su perfil y sus casos. Debe tener inscripción aprobada antes de
recibir una asignación. Sigue pendiente confirmar qué actor registra la resolución.

## E2E-05. Asignación de un caso a un alumno

**Objetivo:** establecer quién dará seguimiento académico al proceso.

**Actor principal:** secretaría o administrador.  
**Precondiciones:** existen el proceso y el alumno.

### Flujo principal

1. El usuario abre el proceso o el perfil del alumno.
2. Selecciona `Asignar alumno` o `Asignar caso`.
3. Busca y selecciona al alumno correspondiente.
4. Revisa el caso y el alumno que quedarán relacionados.
5. Confirma la asignación.
6. El sistema agrega el caso al perfil del alumno.
7. El proceso muestra al alumno asignado.
8. La acción queda registrada con usuario y fecha.

**Resultado:** el alumno puede tener este y otros casos asignados; el personal
puede consultar la relación desde ambos contextos.

**Pendiente:** confirmar si un mismo proceso admite varios alumnos simultáneos y
cómo se finaliza o reasigna una asignación.

## E2E-06. Elaboración, revisión y presentación de un memorial

**Objetivo:** conservar todo el ciclo de trabajo de un memorial hasta su
presentación ante el juzgado.

**Actores:** alumno asignado, secretaría y/o administrador, según permisos por
confirmar.  
**Precondición:** el proceso está abierto y tiene alumno asignado.

### Flujo principal

1. Se recibe o registra el memorial elaborado por el alumno.
2. El usuario adjunta la primera versión y registra la fecha.
3. La persona revisora registra la revisión y sus observaciones.
4. Si requiere cambios, el alumno corrige y se adjunta una nueva versión.
5. Los pasos 3 y 4 se repiten tantas veces como sea necesario.
6. Cuando la revisión es satisfactoria, se registra que está listo para firma o
   presentación, usando el estado que apruebe el cliente.
7. Después de entregarlo al juzgado, el usuario registra la fecha de presentación.
8. Adjunta la versión efectivamente presentada y, si existe, constancia de
   recepción.
9. El sistema ordena todas las revisiones y la presentación en la línea de tiempo.
10. La presentación pasa a ser el último paso visible del caso hasta que exista
    una actuación posterior.

**Resultado:** se puede reconstruir qué versiones existieron, cuándo se revisaron
y cuándo se presentó el memorial.

**Alternativas:** si el juzgado no recibe el memorial, se registra el resultado
sin marcarlo como presentado satisfactoriamente; si hay otra corrección, se abre
un nuevo ciclo conservando los anteriores.

## E2E-07. Recepción de notificación y actualización del caso

**Objetivo:** registrar la respuesta o resolución recibida del juzgado.

**Actor principal:** secretaría o administrador.

### Flujo principal

1. El juzgado notifica mediante el canal externo correspondiente.
2. El usuario localiza el proceso.
3. Selecciona `Agregar notificación`.
4. Registra la fecha de la notificación y una descripción.
5. Adjunta el documento recibido.
6. Si corresponde, actualiza la etapa o estado del proceso.
7. Confirma el registro.
8. El sistema incorpora la notificación en orden cronológico.
9. La notificación queda visible como último paso del proceso.
10. La acción identifica al usuario que la ingresó.

**Resultado:** el personal puede informar el estado del caso basándose en la
última evidencia registrada.

## E2E-08. Atención de consulta de un cliente

**Objetivo:** responder rápidamente “¿en qué va mi proceso?”.

**Actor principal:** secretaría o administrador.

### Flujo principal

1. El usuario escribe el nombre del cliente en la barra de búsqueda.
2. El sistema muestra todas las personas coincidentes y las identifica como
   clientes.
3. El usuario selecciona a la persona correcta.
4. El sistema muestra los procesos asociados.
5. El usuario abre el proceso consultado.
6. Visualiza estado, alumno asignado, requisitos y último paso.
7. Si necesita contexto, consulta la línea de tiempo completa y los documentos.
8. Responde al cliente fuera del sistema.

**Resultado:** la consulta se resuelve sin depender de la memoria o disponibilidad
del alumno asignado.

## E2E-09. Atención de consulta de un alumno

**Objetivo:** mostrar al alumno sus casos y el avance conocido de cada uno.

**Actor principal:** secretaría o administrador.

### Flujo principal

1. El usuario escribe el nombre del alumno en la barra de búsqueda.
2. El sistema muestra las coincidencias identificadas como alumnos.
3. El usuario abre el perfil correcto.
4. Consulta su papelería y todos los casos asignados.
5. Cada caso muestra el cliente, el tipo de proceso, el estado y el último paso.
6. El usuario abre el caso sobre el que existe la consulta.
7. Revisa la línea de tiempo y documentos permitidos.

**Resultado:** se conoce cuántos casos tiene asignados el alumno y el avance de
cada uno.

## E2E-10. Registro y envío del reporte semanal

**Objetivo:** sustituir el registro manual y el reenvío repetitivo de actividades.

**Actores:** secretaría que registra; responsable que revisa y envía.

### Flujo principal

1. Durante la semana, la secretaría registra cada actividad realizada.
2. Cuando corresponde, relaciona la actividad con alumno, cliente o proceso.
3. Al finalizar el período, el usuario solicita el reporte semanal.
4. El sistema reúne las actividades del período y las presenta para revisión.
5. El responsable comprueba el contenido.
6. Si hay errores, vuelve al registro correspondiente y lo corrige con trazabilidad.
7. Genera la versión imprimible.
8. Puede imprimirla para el oficio interno.
9. Pulsa `Enviar por correo`.
10. El sistema utiliza los destinatarios definidos y muestra el resultado.
11. Queda constancia de quién generó y quién ordenó el envío.

**Resultado:** existe un reporte semanal revisado, imprimible y enviado sin
redactar nuevamente el correo y su contenido.

**Pendiente:** confirmar plantilla, destinatarios, día de corte y si la revisión
la realiza exclusivamente el administrador.

## E2E-11. Consulta de trazabilidad

**Objetivo:** determinar quién ingresó y quién dio seguimiento a la información.

**Actor principal:** usuario autorizado, por confirmar.

### Flujo principal

1. El usuario abre un cliente, alumno, proceso, documento o reporte.
2. Solicita ver la actividad o historial asociado.
3. El sistema presenta las acciones en orden temporal.
4. Cada acción muestra usuario, fecha, tipo y elemento afectado.
5. El usuario filtra o revisa el seguimiento hasta identificar a los responsables.

**Resultado:** se puede atribuir cada acción a un usuario interno aun si su cuenta
ya no está activa.

## E2E-12. Cierre y depuración controlada

**Objetivo:** retirar información que ya cumplió el período institucional sin
afectar registros por error.

**Actor recomendado:** administrador general.  
**Precondición:** el cliente aprobó política, cómputo del plazo y alcance.

### Flujo principal propuesto para validación

1. El proceso o participación del alumno se marca como concluido.
2. El sistema conserva la información durante el plazo aprobado.
3. El administrador solicita ver candidatos a depuración.
4. El sistema explica por qué cada expediente es elegible y desde qué fecha.
5. El administrador selecciona uno o varios candidatos.
6. El sistema presenta una vista previa detallada de documentos e historial que
   se eliminarán.
7. El administrador confirma expresamente la operación.
8. El sistema ejecuta la depuración conforme a la política aprobada.
9. Se muestra el resultado y se conserva el rastro mínimo permitido.

**Resultado:** únicamente se depura información elegible y autorizada.

**Bloqueo:** este flujo no debe pasar de prototipo hasta resolver las decisiones
documentadas sobre conservación y alcance.

## E2E-13. Gestión de una excepción o dato incorrecto

**Objetivo:** corregir información sin perder responsabilidad histórica.

### Flujo principal

1. El usuario detecta un dato o documento incorrecto.
2. Abre el registro afectado.
3. Corrige el dato o sustituye el documento según sus permisos.
4. Registra observación o motivo cuando la operación lo requiera.
5. El sistema muestra la versión vigente.
6. La trazabilidad conserva quién hizo la corrección y cuándo.

**Resultado:** la operación continúa con información correcta y la modificación
no queda anónima.

## E2E-14. Incorporación de estudiante como secretaría ad honorem

**Objetivo:** tramitar una modalidad académica y, después de su aprobación,
habilitar las funciones operativas que correspondan durante un período limitado.

**Actores:** estudiante solicitante, Dirección/administración y usuario que
registra el trámite.  
**Precondición:** existe expediente de alumno con requisitos documentales.

### Flujo principal

1. El alumno presenta memorial para solicitar el beneficio de secretaría ad
   honorem y adjunta la documentación exigida.
2. El usuario interno registra la solicitud y forma el expediente.
3. Se verifica aprobación de Derecho Procesal Civil y Mercantil I y II, DPI,
   fotografías, Curriculum Vitae y pagos correspondientes.
4. Se selecciona jornada matutina de 08:00 a 12:00 o vespertina de 14:00 a 18:00.
5. Se registra el período, descrito en la minuta como febrero a noviembre.
6. La autoridad responsable admite y resuelve la solicitud.
7. Si se aprueba, se registra la emisión del carné.
8. El administrador asigna el rol de acceso de secretaría por el período
   autorizado.
9. El sistema permite las funciones operativas de secretaría excepto eliminar
   usuarios.
10. Todas las acciones quedan atribuidas a la cuenta personal del estudiante.
11. Al finalizar el período, se retiran los permisos sin borrar su historial.

**Resultado:** la persona conserva su perfil académico de alumno y, al mismo
tiempo, opera temporalmente con permisos de secretaría.

**Pendientes:** confirmar si el plazo siempre es de diez meses, el límite de una
persona por jornada, quién aprueba y si la habilitación del rol es automática o
manual.

## E2E-15. Validación de vigencia y naturaleza de requisitos

**Objetivo:** impedir que una casilla marcada como cargada oculte que el documento
no cumple su regla material.

### Flujo principal

1. El usuario abre el checklist del proceso.
2. El sistema muestra para cada requisito si corresponde a original, copia,
   dato, condición o documento con vigencia.
3. El usuario carga el archivo o completa el dato.
4. Cuando existe vigencia máxima, registra la fecha de emisión.
5. El sistema advierte si una certificación excede seis meses.
6. Un usuario autorizado revisa y marca el requisito como aceptado, observado o
   pendiente.
7. La decisión, fecha y responsable quedan trazados.

**Resultado:** el expediente diferencia entre archivo presente y requisito
realmente cumplido.

## E2E-16. Eliminación lógica y restauración

**Objetivo:** retirar un registro de la operación diaria sin destruir la
trazabilidad ni los documentos.

**Actores:** secretaría o administrador para eliminar; administrador para
consultar y restaurar.

1. El actor abre un cliente, alumno o expediente y selecciona `Eliminar`.
2. El sistema explica el alcance y solicita confirmación; puede registrarse un
   motivo.
3. El backend marca el registro, sus dependencias aplicables y documentos con un
   mismo identificador de lote, fecha y usuario responsable.
4. El registro desaparece de búsquedas, listados y accesos ordinarios.
5. El administrador abre `Eliminados`, filtra el registro y revisa quién lo
   eliminó, cuándo y por qué.
6. Si corresponde, confirma `Restaurar`.
7. El sistema recupera el lote y registra la restauración en auditoría.

**Resultado:** el registro vuelve a la operación sin pérdida física de archivos
ni de historial. La depuración irreversible permanece como un flujo separado.
