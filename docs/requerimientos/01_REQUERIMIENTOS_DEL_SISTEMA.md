# Requerimientos funcionales del sistema

## 1. Propósito

Este documento define **qué debe permitir hacer el sistema** con base en la
reunión de levantamiento. No prescribe entidades, tablas, tecnología,
infraestructura ni diseño visual.

## 2. Alcance funcional

La aplicación debe permitir al personal interno administrar la atención de
clientes y el seguimiento de procesos judiciales desde la recepción de
papelería hasta la consulta del último paso realizado, manteniendo evidencia
documental y trazabilidad de las personas responsables.

### Incluido

- autenticación de usuarios internos;
- administración de usuarios y permisos;
- perfiles de usuarios internos con fotografía y período de participación;
- registro y consulta de clientes;
- ficha de recepción y declaración jurada de ingresos del cliente;
- carga de documentos PDF e imágenes en casillas identificadas;
- opción de adquisición directa desde escáner, sujeta a validación técnica;
- catálogo de aproximadamente 25 tipos de proceso;
- requisitos documentales particulares por tipo de proceso;
- expediente digital del cliente para cada proceso abierto;
- asignación de procesos a alumnos;
- papelería y perfil académico-administrativo del alumno;
- solicitud formal de inscripción, modalidad de práctica, horario, resolución y
  emisión de carné del alumno;
- seguimiento cronológico del proceso;
- memoriales, versiones o revisiones, presentación y notificaciones;
- búsqueda de clientes y alumnos;
- consulta del estado y último paso de los casos;
- registro diario de actividades de las secretarías;
- reportes imprimibles y envío por correo mediante botón;
- auditoría de todas las acciones relevantes;
- reportes de actividades de secretaria.
- depuración controlada después del período definido por la institución.

### Excluido de esta definición

- acceso del cliente atendido al sistema;
- portal público;
- identidad gráfica, colores y logo;
- arquitectura o selección tecnológica;
- hosting, servidor, dominio, costos y manual de renovación;
- definición inventada de los 25 tipos de proceso o de su papelería;
- automatización sin intervención humana del envío semanal, salvo posterior
  confirmación del cliente.

## 3. Actores y permisos conocidos

| Actor | Descripción | Capacidades confirmadas | Restricciones o dudas |
|---|---|---|---|
| Administrador general | Responsable con control completo | Ejecutar todas las tareas, crear, modificar y eliminar usuarios; consultar trazabilidad | Debe confirmarse si “eliminar” será baja lógica o eliminación física |
| Secretaría activa | Personal operativo del bufete | Acceso a todas las funciones operativas; registrar clientes, documentos, procesos, seguimientos, alumnos, actividades y reportes | No puede eliminar usuarios |
| Alumno | Persona inscrita y asignada a uno o varios casos | Inicia sesión con su correo, consulta únicamente su perfil y casos asignados, y administra sus datos de cuenta | No puede crear, modificar ni eliminar información jurídica |
| Cliente | Persona que recibe el servicio jurídico | Sus datos, documentos y procesos se administran en el sistema | No tiene cuenta ni acceso al sistema |

### Matriz preliminar de permisos

`Sí` significa confirmado; `No` significa restringido; `PC` significa pendiente
de confirmación.

| Función | Administrador | Secretaría | Alumno |
|---|:---:|:---:|:---:|
| Iniciar sesión | Sí | Sí | Sí |
| Ver clientes y procesos | Sí | Sí | Sí, solo casos asignados |
| Crear o modificar clientes | Sí | Sí | PC |
| Cargar papelería de clientes | Sí | Sí | PC |
| Abrir y actualizar procesos | Sí | Sí | PC |
| Registrar revisiones, memoriales y notificaciones | Sí | Sí | PC |
| Registrar alumnos y papelería | Sí | Sí | No/PC |
| Asignar casos a alumnos | Sí | Sí | No/PC |
| Registrar actividades de secretaría | Sí | Sí | No |
| Generar, imprimir y enviar reportes | Sí | Sí | No/PC |
| Crear y modificar usuarios internos | Sí | No | No |
| Eliminar usuarios internos | Sí | No | No |
| Consultar auditoría completa | Sí | PC | No/PC |
| Ejecutar depuración | PC, recomendado | No/PC | No |

## 4. Requerimientos funcionales

### RF-AUT — Acceso y sesión

#### RF-AUT-01. Inicio de sesión

El sistema debe permitir el ingreso únicamente a usuarios internos autorizados
mediante credenciales personales.

El identificador de inicio de sesión es el correo electrónico registrado; no se
solicita un nombre de usuario independiente.

**Criterios de aceptación**

- Las credenciales válidas permiten entrar al sistema.
- Las credenciales inválidas no permiten el acceso.
- La sesión queda asociada al usuario real para efectos de trazabilidad.
- Un cliente atendido no puede iniciar sesión.

#### RF-AUT-02. Control de permisos

El sistema debe habilitar o restringir cada acción según el rol del usuario.

**Criterios de aceptación**

- Una secretaría no puede eliminar usuarios.
- El administrador puede realizar todas las tareas.
- Una acción bloqueada no puede ejecutarse aunque se intente acceder directamente.

#### RF-AUT-03. Cierre de sesión

El sistema debe permitir cerrar la sesión activa y evitar que otra persona siga
operando con la identidad anterior.

### RF-USR — Usuarios internos

#### RF-USR-01. Registrar usuario interno

El sistema debe permitir registrar usuarios internos con, al menos, nombre, rol
y estado de acceso.

#### RF-USR-02. Perfil del usuario interno

El sistema debe permitir asociar fotografía, nombre, fecha de inicio y fecha de
fin del período como voluntario o colaborador.

#### RF-USR-03. Modificar usuario interno

Los usuarios autorizados deben poder actualizar la información y vigencia de un
usuario interno.

#### RF-USR-04. Eliminar o dar de baja un usuario

Solo el administrador general debe poder ejecutar la acción de eliminación o
baja de un usuario. Debe confirmarse si se requiere eliminación física o
desactivación con conservación del historial.

#### RF-USR-05. Identificar autoría

Cada registro o modificación realizada debe mostrar o permitir consultar qué
usuario interno la efectuó.

### RF-CLI — Clientes y papelería

#### RF-CLI-01. Registrar cliente

El sistema debe permitir crear el registro de una persona atendida con sus datos
generales, sin crearle acceso al sistema.

#### RF-CLI-02. Consultar y modificar cliente

Los usuarios internos autorizados deben poder consultar y actualizar la
información general del cliente.

#### RF-CLI-03. Cargar papelería

El sistema debe permitir adjuntar documentos del cliente en PDF o imagen.

**Criterios de aceptación**

- Cada documento se carga en una casilla con etiqueta reconocible, por ejemplo
  `DPI` o `Certificación de nacimiento`.
- El usuario puede distinguir qué requisito tiene documento y cuál está pendiente.
- El documento cargado puede volver a visualizarse desde el expediente.
- La carga registra fecha y usuario responsable.

#### RF-CLI-04. Escanear desde la aplicación

El sistema debería permitir iniciar la digitalización desde el escáner y asociar
el resultado directamente a la casilla seleccionada, sin exigir guardarlo
manualmente antes en la computadora.

**Estado:** requerido como posibilidad por el cliente y pendiente de prueba
técnica con los equipos reales. El prototipo debe representar la acción
`Escanear`, aunque su implementación final dependa de dicha validación.

#### RF-CLI-05. Ver expediente del cliente

El sistema debe presentar en un mismo contexto los datos del cliente, su
papelería y los procesos que se le hayan abierto.

#### RF-CLI-06. Completar ficha de recepción

El sistema debe permitir registrar los datos utilizados en la ficha actual de
control y recepción, incluyendo número de expediente, datos personales,
escolaridad, ocupación, salario, cantidad de hijos, asistencia solicitada y
datos de la persona de quien se reclama un derecho.

**Criterios de aceptación**

- La persona atendida se identifica como `cliente`, aunque el formulario fuente
  utilice la palabra `usuario`.
- La persona de quien se reclama un derecho se registra como contraparte y no
  recibe acceso al sistema.
- El lugar y fecha de recepción quedan registrados.
- Se puede adjuntar o conservar evidencia de firma o impresión digital.

#### RF-CLI-07. Registrar declaración jurada de ingresos

El sistema debe permitir registrar o adjuntar la declaración mediante la cual el
cliente manifiesta ser persona de escasos recursos y solicita los servicios del
Bufete Popular.

La declaración debe contemplar nombre, edad, estado civil, sexo, DPI, profesión
u oficio, nacionalidad, residencia, teléfonos, datos laborales, salario, lugar,
fecha y firma o impresión digital.

**Decisión para versión 1:** se implementan las tres acciones: captura
estructurada, generación del formato para firma y carga del formulario firmado.
La validación del prototipo podrá simplificar este flujo posteriormente.

### RF-TIP — Tipos de proceso y requisitos

#### RF-TIP-01. Mantener tipos de proceso

El sistema debe manejar aproximadamente 25 tipos de procesos judiciales, entre
ellos pensión alimenticia.

La evidencia disponible confirma por ahora: fijación de pensión alimenticia,
aumento o disminución de pensión, divorcio por causal determinada, paternidad y
filiación, guarda y custodia, cobro de pensiones atrasadas y cambio de nombre en
vía judicial.

#### RF-TIP-02. Definir requisitos por tipo de proceso

Cada tipo de proceso debe desplegar su propia lista de documentos requeridos.
El contenido debe provenir de las fuentes aprobadas por el cliente. Los
requisitos actualmente evidenciados se encuentran en
[`00_FUENTES_Y_HALLAZGOS.md`](00_FUENTES_Y_HALLAZGOS.md); el catálogo continúa
incompleto frente a los aproximadamente 25 tipos mencionados.

#### RF-TIP-03. Identificar cumplimiento documental

Al elegir un tipo de proceso, el sistema debe mostrar claramente los requisitos
cubiertos y los pendientes antes y durante el seguimiento del expediente.

#### RF-TIP-04. Manejar reglas de cada requisito

Cada requisito debe poder expresar, cuando aplique:

- si requiere archivo, dato o condición;
- si es obligatorio o condicional;
- si debe ser original, copia o fotocopia;
- vigencia máxima, como certificaciones no mayores de seis meses;
- persona a quien corresponde, por ejemplo solicitante, hijo, cónyuge o
  contraparte;
- observaciones operativas.

El `recibo de agua reciente` aparece tachado en varias fotografías y no debe
configurarse como obligatorio hasta que el cliente confirme si fue retirado.

### RF-PRO — Procesos y expediente digital

#### RF-PRO-01. Abrir proceso

Un usuario autorizado debe poder seleccionar un cliente, elegir el tipo de
proceso y abrir su expediente digital.

#### RF-PRO-02. Incorporar papelería al proceso

El expediente debe contener o mostrar toda la documentación exigida para el tipo
de proceso seleccionado.

#### RF-PRO-03. Consultar estado actual

El sistema debe mostrar en qué etapa o estado se encuentra el proceso.

#### RF-PRO-04. Registrar pasos cronológicos

El usuario debe poder agregar cada paso realizado dentro del proceso, con fecha,
descripción, usuario responsable y documentos adjuntos cuando corresponda.

#### RF-PRO-05. Registrar memorial y revisiones

El sistema debe permitir registrar el memorial presentado por el alumno y cada
ciclo de revisión o corrección realizado antes de su aprobación.

**Criterios de aceptación**

- Se conserva la fecha de cada revisión.
- Se pueden adjuntar las versiones o documentos revisados.
- Se puede distinguir una revisión pendiente de un memorial ya aprobado o listo
  para firma, sujeto a confirmar los nombres exactos de estados.
- Se identifica quién registró cada revisión.

#### RF-PRO-06. Registrar presentación del memorial

El sistema debe permitir registrar la fecha en la que el memorial fue presentado
al juzgado y adjuntar los documentos que fueron presentados.

#### RF-PRO-07. Registrar notificación del juzgado

El sistema debe permitir registrar una notificación o resolución recibida,
indicando su fecha y adjuntando el documento correspondiente.

#### RF-PRO-08. Mostrar línea de tiempo

El expediente debe desplegar revisiones, presentaciones, notificaciones y demás
pasos en orden cronológico.

#### RF-PRO-09. Mostrar último paso

El sistema debe identificar de manera visible el último procedimiento o acción
registrada en el caso.

#### RF-PRO-10. Registrar resultado o cierre

El sistema debe permitir identificar cuándo el proceso o participación asociada
ha concluido. Los estados y condiciones exactas de cierre deben validarse.

### RF-ALU — Alumnos

#### RF-ALU-01. Inscribir alumno

El sistema debe permitir registrar los datos generales de un alumno que realiza
su práctica o voluntariado en la clínica jurídica.

Debe contemplar como mínimo nombre, edad, carné, DPI, semestre, jornada de
estudio, datos laborales, dirección, teléfonos, correo y fecha de inscripción.

#### RF-ALU-02. Cargar requisitos del alumno

El sistema debe permitir cargar en casillas identificadas el formulario,
comprobante de pago y demás requisitos documentales del alumno.

La evidencia revisada incluye solicitud o memorial, copia de DPI, Curriculum
Vitae, tres fotografías recientes tamaño cédula a color, certificación original
de Derecho Procesal Civil y Mercantil I y II, boletas de inscripción y pagos
aplicables.

#### RF-ALU-03. Ver completitud de papelería

Desde el perfil debe poder verificarse si la papelería del alumno está completa
o qué requisitos están pendientes.

#### RF-ALU-04. Asignar caso

Un usuario autorizado debe poder asignar un proceso existente a un alumno.

#### RF-ALU-05. Múltiples casos

Un alumno puede tener dos, tres, cuatro o más casos asignados simultánea o
históricamente.

#### RF-ALU-06. Consultar perfil integral

El perfil del alumno debe mostrar sus datos, papelería, casos asignados, cliente
asociado a cada caso, estado y último paso de cada proceso.

#### RF-ALU-07. Dar seguimiento a actividad del alumno

El sistema debe permitir conocer qué casos lleva el alumno y las actividades o
pasos en los que ha participado.

#### RF-ALU-08. Registrar solicitud de inscripción

El sistema debe permitir recibir el memorial dirigido a la Dirección, asociar
los documentos presentados e iniciar el expediente de inscripción del alumno.

#### RF-ALU-09. Tramitar y resolver inscripción

Los usuarios autorizados deben poder registrar la admisión a trámite, revisión
documental, resolución y resultado de la solicitud.

#### RF-ALU-10. Registrar modalidad de práctica

El perfil debe identificar la modalidad elegida, por ejemplo procuración de
casos civiles/familia, pasantía externa o secretaría ad honorem, además de sede,
jornada, días, horario, fecha de inicio y fecha de fin.

#### RF-ALU-11. Registrar emisión de carné

Cuando la solicitud sea aprobada, el sistema debe permitir registrar la emisión
y entrega del carné del Bufete Popular.

**Pendiente:** confirmar número de carné, vigencia, reposición y si el sistema
debe generar el documento o solo registrar que fue emitido.

### RF-BUS — Búsqueda y consulta

#### RF-BUS-01. Búsqueda por cliente

La barra de búsqueda debe localizar clientes por nombre y mostrar todas las
coincidencias, no solamente la primera.

#### RF-BUS-02. Búsqueda por alumno

La misma búsqueda debe localizar alumnos por nombre y permitir abrir su perfil.

#### RF-BUS-03. Diferenciar resultados

Cada resultado debe indicar claramente si corresponde a un cliente o a un
alumno y ofrecer datos suficientes para seleccionar a la persona correcta.

#### RF-BUS-04. Navegar al proceso

Desde un resultado se debe poder llegar al proceso, consultar su estado y ver el
último paso registrado.

### RF-ACT — Actividades de secretaría

#### RF-ACT-01. Registrar actividad diaria

La secretaría debe poder registrar actividades ejecutadas, por ejemplo la
atención de un alumno que llega a revisión.

#### RF-ACT-02. Relacionar actividad

Cuando corresponda, la actividad debe poder quedar relacionada con la fecha, la
secretaría responsable, el alumno, el cliente o el proceso involucrado.

#### RF-ACT-03. Consultar registro

Los usuarios autorizados deben poder consultar y filtrar las actividades
registradas para preparar informes periódicos.

### RF-REP — Reportes

#### RF-REP-01. Generar reporte de actividades

El sistema debe generar un reporte de las actividades de secretaría, en
particular para el ciclo semanal utilizado actualmente.

#### RF-REP-02. Revisar antes del envío

El responsable debe poder revisar el contenido del reporte antes de enviarlo.

#### RF-REP-03. Imprimir reporte

El reporte debe presentarse en un formato apto para impresión y para servir de
base a los oficios internos mencionados en la reunión.

#### RF-REP-04. Enviar por correo

El usuario autorizado debe poder pulsar un botón para enviar el reporte a una o
varias direcciones configuradas, sin volver a redactarlo manualmente.

#### RF-REP-05. Confirmar resultado

El sistema debe informar si el envío fue exitoso o falló y dejar evidencia del
usuario que lo ordenó.

### RF-AUD — Trazabilidad

#### RF-AUD-01. Auditar acciones

El sistema debe llevar trazabilidad completa de las acciones realizadas.

Como mínimo, debe registrarse:

- usuario que ejecutó la acción;
- fecha y hora;
- tipo de acción;
- registro o expediente afectado;
- creación y modificación de información;
- carga de documentos;
- asignación de casos;
- revisiones y seguimiento procesal;
- generación, impresión o envío de reportes;
- eliminación, baja o depuración.

#### RF-AUD-02. Consultar responsables

Un usuario autorizado debe poder determinar quién ingresó una información y
quién le dio seguimiento posteriormente.

#### RF-AUD-03. Preservar responsabilidad histórica

La desactivación de una cuenta no debe hacer anónimas las acciones que realizó
durante su período activo.

### RF-DEP — Depuración

#### RF-DEP-01. Identificar expedientes candidatos

El sistema debe permitir identificar información que haya cumplido el período de
conservación, mencionado de forma preliminar como aproximadamente un año.

#### RF-DEP-02. Ejecutar depuración controlada

Debe existir una acción para depurar los expedientes elegibles, incluidos los
documentos y el historial que el cliente autorice eliminar.

#### RF-DEP-03. Confirmar alcance antes de eliminar

Antes de ejecutar la depuración, el sistema debe mostrar qué alumno, clientes,
casos, documentos e historial serían afectados y solicitar confirmación.

#### RF-DEP-04. Registrar la depuración

La ejecución debe dejar evidencia mínima del responsable, fecha, criterio y
alcance, si la política institucional permite conservar ese registro.

> **Bloqueo funcional:** no implementar la eliminación definitiva hasta que el
> cliente defina el evento inicial del año, qué significa “expediente del
> alumno”, qué información legal debe conservarse y si la acción puede revertirse.

## 5. Requerimientos transversales

Estos requisitos se derivan de la operación descrita y deben validarse durante
el prototipo:

### RNF-01. Uso interno

Toda la información debe estar disponible solo para usuarios internos
autorizados.

### RNF-02. Claridad documental

Las casillas y archivos deben mostrar etiquetas comprensibles para el personal,
sin depender de nombres técnicos de archivo.

### RNF-03. Facilidad de consulta

La búsqueda y el acceso al último paso deben ser suficientemente directos para
responder a un cliente o alumno durante una atención.

### RNF-04. Integridad del historial

Las actualizaciones no deben hacer imposible saber qué ocurrió, cuándo y quién
fue responsable.

### RNF-05. Soporte de documentos

La aplicación debe aceptar al menos PDF e imágenes para papelería, memoriales,
revisiones y notificaciones.

### RNF-06. Capacidad de crecimiento funcional

La lista de tipos de proceso y sus requisitos debe poder completarse o ajustarse
conforme el cliente entregue información durante el proyecto.

## 6. Reglas de negocio consolidadas

- RN-01: el cliente atendido no es un usuario con acceso.
- RN-02: solo el administrador puede eliminar usuarios internos.
- RN-03: las secretarías activas tienen acceso a todas las demás funciones,
  sujeto a precisar administración de permisos y auditoría.
- RN-04: un alumno puede tener múltiples casos asignados.
- RN-05: cada tipo de proceso tiene una lista propia de requisitos.
- RN-06: todo paso procesal se presenta cronológicamente.
- RN-07: cada revisión y presentación de memorial debe conservar su fecha y
  documentación.
- RN-08: cada notificación debe conservar fecha y documento adjunto.
- RN-09: toda acción debe identificar al usuario interno responsable.
- RN-10: las búsquedas por nombre deben mostrar todas las coincidencias.
- RN-11: el reporte semanal se revisa antes de enviarlo mediante una acción
  explícita, según lo descrito en la reunión.
- RN-12: la depuración se plantea alrededor de un año, pero su cómputo y alcance
  no están aprobados todavía.
- RN-13: una secretaría ad honorem puede ser también alumno; la modalidad
  académica y el rol de acceso deben administrarse como conceptos distintos.
- RN-14: la inscripción del alumno requiere expediente y resolución antes de la
  emisión del carné.
- RN-15: las certificaciones identificadas como recientes no deben superar seis
  meses, sujeto a la fecha de referencia que confirme el cliente.
- RN-16: debe distinguirse solicitante, cliente, alumno, contraparte y usuario
  interno responsable.

## 7. Dependencias de información del cliente

Para completar el alcance se necesita disponer de:

- listado oficial restante hasta completar los tipos de proceso;
- requisitos de los procesos no cubiertos por las fotografías y confirmación de
  los requisitos tachados;
- conciliación final de los requisitos del alumno que difieren entre ficha,
  minutas y fotografía;
- etapas y estados utilizados por el bufete;
- destinatarios y formato del reporte semanal;
- reglas de acceso del alumno;
- política de conservación y depuración.
