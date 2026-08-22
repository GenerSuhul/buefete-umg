# Decisiones pendientes y validación del prototipo

## 1. Propósito

La reunión definió con claridad el núcleo del sistema, pero dejó varias reglas
abiertas. Este documento evita que el equipo convierta esas ambigüedades en
supuestos de diseño o desarrollo.

## 2. Decisiones funcionales por resolver

### DP-01. Acceso real del alumno

**Lo confirmado:** existe un perfil de alumno, se carga su papelería, puede tener
múltiples casos y se sigue su actividad.  
**Resuelto para versión 1 y ratificado el 15 de agosto de 2026:** el alumno inicia
sesión con su correo electrónico y cuenta personal. Puede consultar únicamente
su perfil y sus casos asignados; no puede agregar, editar ni eliminar información
jurídica. Puede administrar nombre, correo, fotografía y contraseña propios.

Las minutas demuestran además que `secretaría ad honorem` puede ser una modalidad
de práctica realizada por un estudiante. La modalidad académica y el rol
operativo continúan siendo conceptos separados.

La identidad de acceso no usa un alias adicional: el correo es el usuario de
autenticación. Sigue pendiente precisar el nivel de detalle sensible del cliente
visible dentro de sus casos.

### DP-02. Administración de usuarios por secretarías

**Lo confirmado:** las secretarías tienen acceso a todo excepto eliminar
usuarios.  
**Resuelto para versión 1:** secretaría no puede crear, editar, activar,
bloquear, eliminar usuarios ni asignar roles o permisos. Puede operar todos los
procesos funcionales del bufete.

### DP-03. Significado de “eliminar usuario”

**Lo confirmado:** el administrador puede eliminar y las secretarías no.  
**Resuelto para versión 1:** eliminar significa baja lógica. Se bloquea el acceso
y se conserva el perfil mínimo y toda su autoría histórica.

### DP-04. Lista oficial de procesos y documentos

**Lo confirmado:** se esperan aproximadamente 25 tipos y requisitos distintos
por tipo. Las fotografías confirman por ahora siete: fijación de pensión,
aumento/disminución de pensión, divorcio por causal, paternidad/filiación, guarda
y custodia, cobro de pensiones atrasadas y cambio de nombre. Hay requisitos
fotografiados para seis.  
**Decisión incremental:** se inicia con los siete procesos evidenciados y el
catálogo permitirá agregar los restantes cuando el cliente los entregue.

Para cada tipo se necesita:

- nombre oficial;
- lista ordenada de documentos;
- cuáles son obligatorios;
- si se aceptan alternativas;
- cuándo se considera completo el expediente;
- quién puede modificar esta configuración.

### DP-05. Requisitos del alumno

Las fuentes confirman solicitud, DPI, Curriculum Vitae, tres fotografías tamaño
cédula, certificación original de Derecho Procesal Civil y Mercantil I y II y
boletas o pagos de inscripción. Falta conciliar diferencias entre la ficha, la
fotografía y las minutas, especialmente décimo ciclo, pago anual e inscripción
para estudiantes con pensum cerrado.

### DP-06. Apertura con papelería incompleta

Debe definirse si un proceso puede abrirse con requisitos pendientes y qué
acciones quedan bloqueadas hasta completarlos.

### DP-07. Asignaciones

Debe confirmarse:

- si un proceso puede tener varios alumnos al mismo tiempo;
- si existe responsable principal y colaboradores;
- quién puede asignar y reasignar;
- cómo termina una asignación;
- qué sucede con casos activos cuando finaliza el período del alumno.

### DP-08. Flujo de memoriales

La reunión describe varias revisiones, correcciones, firma y presentación. Falta
aprobar los estados y responsables exactos.

**Propuesta para validar en prototipo:**

`Recibido → En revisión → Requiere corrección → Corregido → Aprobado para firma → Presentado`.

Preguntar además si cada versión debe preservarse y quién puede marcarla como
aprobada o presentada.

### DP-09. Etapas y estados del proceso

Se requiere la nomenclatura usada realmente por la clínica. No debe confundirse
el estado general del expediente con cada actuación cronológica.

### DP-10. Registro de actividades de secretaría

Falta definir:

- campos obligatorios;
- catálogo o texto libre de actividades;
- si una actividad se relaciona siempre con alumno, cliente o proceso;
- si puede corregirse después del cierre semanal;
- quién revisa y aprueba el reporte.

### DP-11. Reporte semanal y correo

Solicitar un ejemplo real del reporte y confirmar:

- columnas y orden;
- rango semanal y día/hora de corte;
- agrupación por secretaría;
- formato para imprimir;
- destinatarios y copias;
- asunto y cuerpo del correo;
- quién puede pulsar `Enviar`;
- si el envío requiere aprobación previa;
- si se necesita reenvío o corrección.

### DP-12. Alcance de la trazabilidad

**Lo confirmado:** debe existir para todo lo que se haga.  
Debe detallarse si incluye también iniciar sesión, buscar, visualizar, descargar,
imprimir y enviar, además de altas, cambios y eliminaciones.

También debe decidirse quién puede consultar el historial completo.

### DP-13. Depuración y conservación

Es la decisión de mayor riesgo funcional.

**Lo dicho en la reunión:** conservar aproximadamente un año y contar con un
botón para eliminar documentos e historial vinculados con alumnos que ya
completaron su proceso.  
**Ambigüedad:** un caso involucra al alumno y al cliente, por lo que borrar “el
expediente del alumno” podría eliminar el expediente jurídico del cliente y la
trazabilidad del personal.

Debe aprobarse por escrito:

- desde qué evento se cuenta el año;
- si el plazo cambia según el tipo de documento;
- qué significa que el alumno “completó su proceso”;
- si se elimina papelería del alumno, expediente judicial del cliente o ambos;
- si se borran documentos, datos, historial de actuaciones y auditoría;
- si existen casos compartidos entre alumnos;
- quién autoriza y ejecuta;
- si hay vista previa, doble confirmación y posibilidad de recuperación;
- qué evidencia mínima debe conservarse después de depurar.

### DP-14. Escáner directo

Para validar factibilidad se necesitan modelos de escáner, sistema operativo de
las estaciones y flujo actual. El prototipo debe evaluar al menos:

- elección de casilla antes de escanear;
- vista previa;
- escaneo de varias páginas;
- generación de PDF o imagen;
- reintento y cancelación.

### DP-15. Datos identificadores y duplicados

La búsqueda solicitada es por nombre. Deben definirse datos adicionales para
distinguir homónimos de clientes y alumnos y la regla para prevenir duplicados.

### DP-16. Adjuntos y correcciones

Debe confirmarse si al sustituir un documento se conserva la versión anterior,
qué formatos se aceptan además de PDF e imagen y si existen límites de tamaño o
cantidad de páginas.

### DP-17. Cierre del proceso

Falta definir quién cierra, estados finales posibles, información obligatoria y
si un caso cerrado puede reabrirse.

### DP-18. Captura y firma de formularios del cliente

Las fichas evidencian declaración jurada de ingresos y recepción de datos con
firma o impresión digital. Debe definirse si el sistema:

- captura los campos y genera un documento;
- guarda únicamente el formulario escaneado;
- realiza ambas acciones;
- admite firma manuscrita escaneada, firma en dispositivo o impresión digital;
- asigna automáticamente el número de expediente.

### DP-19. Alumno frente a secretaría ad honorem

Debe confirmarse cómo se aprueba y habilita al estudiante que realizará esta
modalidad, quién le asigna permisos de secretaría y qué ocurre al finalizar los
diez meses. También debe validarse si el límite de una persona por jornada sigue
vigente.

### DP-20. Resolución de inscripción y carné

Las minutas solicitan formar expediente, resolver y extender carné. Debe
definirse:

- autoridad que admite y resuelve;
- estados del trámite;
- manejo de requisitos observados;
- numeración y vigencia del carné;
- si el sistema genera el carné o solo registra su entrega.

### DP-21. Reglas documentales observadas

Debe confirmarse:

- desde qué fecha se calculan los seis meses de vigencia;
- cómo se acredita que un documento es original;
- si el recibo de agua tachado quedó eliminado definitivamente;
- la regla de constancia de ingresos indicada solo para el cónyuge varón;
- si la capacidad económica para ADN es una declaración, validación o documento;
- requisitos de cambio de nombre y de los procesos todavía no entregados.

## 3. Prototipos que deben validarse

### P-01. Inicio y navegación interna

Debe mostrar identidad del usuario activo, funciones según rol, búsqueda global
y accesos principales. Debe permitir demostrar que un alumno aprobado como
secretaría ad honorem conserva ambos contextos sin compartir cuentas.

### P-02. Registro de cliente y papelería

Debe demostrar casillas etiquetadas, carga PDF/imagen, acción de escaneo,
documentos completos y pendientes, ficha de recepción, datos de contraparte,
declaración jurada de ingresos y evidencia de firma o impresión digital.

### P-03. Apertura de proceso

Debe demostrar selección del tipo y despliegue de sus requisitos específicos,
incluidos original/copia, vigencia de seis meses, requisitos condicionales y
datos que no son archivos.

### P-04. Expediente y línea de tiempo

Debe demostrar memorial, múltiples revisiones, presentación, notificación,
adjuntos, estado y último paso.

### P-05. Perfil de alumno

Debe demostrar papelería, completitud, múltiples casos, cliente y estado de cada
proceso, solicitud de inscripción, resolución, modalidad, sede, jornada, horario
y carné.

### P-06. Búsqueda

Debe probar nombres coincidentes, diferenciación cliente/alumno y navegación al
último paso.

### P-07. Actividades y reporte semanal

Debe demostrar registro diario, revisión, impresión y botón de envío por correo.

### P-08. Trazabilidad

Debe demostrar quién creó un dato, quién lo modificó y quién añadió seguimiento.

### P-09. Depuración

Solo debe prototiparse después de discutir DP-13. La vista debe explicar
elegibilidad, impacto, autorización y confirmación; no debe reducirse a un botón
sin contexto.

## 4. Guion recomendado para validar el prototipo

Pedir al cliente que complete, en este orden, un escenario real:

1. registrar a una clienta nueva;
2. completar ficha de recepción y declaración jurada de ingresos;
3. cargar DPI y certificación de nacimiento con fecha de emisión;
4. abrir un proceso real del catálogo;
5. observar requisitos completos, vencidos, condicionales y faltantes;
6. registrar un alumno con su papelería y solicitud;
7. aprobar su inscripción, asignar modalidad y registrar carné;
8. asignarle el proceso;
9. subir un memorial inicial;
10. registrar dos ciclos de revisión;
11. marcar fecha de presentación;
12. adjuntar una notificación posterior;
13. buscar a la clienta y explicar el último paso;
14. buscar al alumno y revisar todos sus casos;
15. registrar la atención como actividad de secretaría;
16. generar, imprimir y enviar el reporte semanal;
17. consultar la trazabilidad de las acciones anteriores.

El prototipo se considera funcionalmente comprendido cuando el cliente pueda
completar este recorrido y validar términos, permisos, datos y excepciones.

## 5. Criterio para incorporar nuevos requerimientos

Cada nuevo requisito comunicado durante el proyecto debe registrar:

- fuente y fecha;
- módulo afectado;
- actor autorizado;
- flujo esperado;
- excepciones;
- criterio de aceptación;
- prioridad para MVP o fase posterior;
- aprobación del cliente.

Esto permitirá ampliar el alcance sin perder lo acordado en la reunión inicial.
