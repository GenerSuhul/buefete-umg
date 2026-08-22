# Fuentes revisadas y hallazgos funcionales

## 1. Propósito
 
Este documento registra la evidencia utilizada para definir los requerimientos.
Su objetivo es que el equipo pueda distinguir entre:

- lo expresado verbalmente en la reunión;
- lo confirmado por formularios y minutas de operación;
- lo observado en fotografías de requisitos;
- interpretaciones que todavía requieren aprobación del cliente.

El ERD anterior no forma parte de estas fuentes.

## 2. Cobertura de revisión

Se revisaron **todos los archivos** ubicados en
`C:\Users\itagr\Downloads\ARCHIVOS DE REQUERIMIENTOS`:

- 4 documentos Word;
- 7 imágenes JPEG;
- 147 párrafos con texto extraíble;
- 2 imágenes incrustadas en Word, ambas copias idénticas del logotipo de la UMG;
- formularios, campos, instrucciones, memoriales modelo y listas fotografiadas.

También se inspeccionó la captura de pantalla compartida en la conversación,
`codex-clipboard-106e057a-ed59-4421-818a-5c36a23b33a0.png`. Esta permitió
confirmar visualmente el nombre de la carpeta y sus once archivos, pero no añadió
requerimientos distintos a los archivos originales.

Los Word no contienen comentarios ni control de cambios. LibreOffice no estaba
disponible y la exportación mediante Word quedó bloqueada por una instancia de
usuario existente; por ello se realizó lectura estructural completa del paquete
DOCX, incluidos cuerpo, texto en XML, secciones, propiedades e imágenes. Las
propiedades internas reportan 1, 3, 2 y 2 páginas respectivamente.

## 3. Catálogo de fuentes

| ID | Archivo | Contenido funcional principal |
|---|---|---|
| SRC-CAP-01 | Captura de la carpeta `ARCHIVOS DE REQUERIMIENTOS` | Evidencia de inventario; sin requisito funcional adicional |
| SRC-REU-01 | Transcripción de la reunión | Visión general, actores, seguimiento, búsqueda, reportes, trazabilidad y depuración |
| SRC-DOC-01 | `FICHA CONTROL DE ESTUDIANTES.docx` | Requisitos, datos generales y datos de práctica del alumno |
| SRC-DOC-02 | `FICHAS DE CONTROL.docx` | Declaración jurada de ingresos y ficha de recepción del cliente |
| SRC-DOC-03 | `mimuta del bufete para Ser SECRETARIA.docx` | Solicitud para modalidad de secretaria/o ad honorem |
| SRC-DOC-04 | `Minuta Dirigido a la Directora Monica, para inscripción al bufete.docx` | Solicitud de inscripción para práctica civil |
| SRC-IMG-01 | `WhatsApp Image 2026-07-29 at 10.33.18 (1).jpeg` | Requisitos de fijación de pensión y guarda y custodia |
| SRC-IMG-02 | `WhatsApp Image 2026-07-29 at 10.33.18.jpeg` | Requisitos de aumento/disminución de pensión y paternidad/filiación |
| SRC-IMG-03 | `WhatsApp Image 2026-07-29 at 10.33.19.jpeg` | Segunda evidencia de aumento/disminución de pensión |
| SRC-IMG-04 | `WhatsApp Image 2026-07-29 at 10.33.30.jpeg` | Requisitos de cobro de pensiones atrasadas |
| SRC-IMG-05 | `WhatsApp Image 2026-07-29 at 10.34.56.jpeg` | Lista parcial de casos atendidos |
| SRC-IMG-06 | `WhatsApp Image 2026-07-29 at 10.35.44.jpeg` | Requisitos de divorcio por causal determinada |
| SRC-IMG-07 | `WhatsApp Image 2026-07-29 at 10.41.55.jpeg` | Requisitos para inscripción del alumno |

## 4. Hallazgos sobre clientes

### 4.1 Ficha de recepción

La ficha actual utiliza el término `usuario` para la persona atendida. En el
sistema se utilizará el término **cliente** para evitar confusión con quienes
inician sesión.

Datos observados en SRC-DOC-02:

- número de expediente;
- nombre completo;
- edad;
- lugar de nacimiento;
- nacionalidad;
- sexo;
- DPI;
- dirección de residencia;
- escolaridad;
- profesión u oficio;
- lugar y dirección de trabajo;
- teléfono del trabajo;
- salario;
- cantidad de hijos;
- tipo de asistencia solicitada;
- nombre de la persona de quien reclama un derecho;
- dirección de esa persona;
- lugar y fecha de recepción;
- firma o impresión digital del cliente.

### 4.2 Declaración jurada de ingresos

SRC-DOC-02 contiene una declaración separada para justificar que la persona es
de escasos recursos económicos y solicita el servicio del Bufete Popular.

Campos observados:

- nombre completo;
- edad y estado civil;
- sexo;
- DPI;
- profesión u oficio;
- nacionalidad;
- dirección de residencia;
- teléfono y celular;
- dirección de trabajo;
- empresa donde trabaja;
- salario mensual o quincenal;
- lugar, fecha y firma o impresión digital.

**Implicación funcional:** el alta del cliente no es únicamente un registro de
contacto. Debe contemplar recepción, evaluación socioeconómica/declaración y la
firma o impresión digital del formato, ya sea como datos estructurados, documento
digitalizado o ambos, según se valide en el prototipo.

## 5. Hallazgos sobre alumnos y modalidades de práctica

### 5.1 Datos del alumno

SRC-DOC-01 requiere:

- nombre completo;
- edad;
- carné;
- DPI;
- semestre;
- jornada de estudio;
- lugar y teléfono de trabajo;
- jefe inmediato;
- puesto desempeñado;
- dirección de residencia;
- teléfono celular y residencial;
- correo electrónico;
- fecha de inscripción al Bufete Popular;
- tipo de práctica;
- lugar asignado;
- dirección del lugar de práctica;
- día y hora de práctica;
- observaciones;
- lugar, fecha y firma del alumno.

### 5.2 Papelería del alumno

Los documentos convergen en los siguientes requisitos:

- solicitud o memorial dirigido a la Dirección del Bufete Popular;
- copia de DPI;
- Curriculum Vitae;
- tres fotografías recientes tamaño cédula a color;
- certificación original de cursos que acredite Derecho Procesal Civil y
  Mercantil I y II;
- boleta o constancia de inscripción correspondiente;
- constancia de pago de inscripción al Bufete Popular;
- constancia o fotocopia del pago anual a la UMG;
- inscripción anual para estudiantes que cerraron pensum, según aplique.

SRC-DOC-01 menciona específicamente la boleta de inscripción del décimo ciclo.
SRC-IMG-07 habla de boleta de inscripción al Bufete y fotocopia de la boleta de
pago de inscripción en la UMG. Debe confirmarse si son documentos diferentes o
formas distintas de nombrar el mismo requisito.

### 5.3 Modalidades y flujo de aprobación

SRC-DOC-03 y SRC-DOC-04 demuestran que la inscripción es un trámite formal:

1. el alumno presenta memorial y documentos;
2. la Dirección admite la solicitud para trámite;
3. se forma el expediente;
4. se tienen por presentados los medios de prueba;
5. se resuelve la solicitud;
6. si es favorable, se extiende carné.

Modalidades evidenciadas:

- procuración de casos civiles y/o de familia hasta sentencia firme o
  ejecutoriada, bajo supervisión del Director General, Asesor de Área o Asesor
  de Sede;
- pasantía en una entidad del Sector Justicia o institución gubernamental con
  convenio;
- secretaria/o ad honorem en centro universitario.

Para la modalidad de secretaria/o ad honorem se indica:

- período de diez meses, de febrero a noviembre;
- jornada matutina de 08:00 a 12:00 o vespertina de 14:00 a 18:00;
- oportunidad para dos estudiantes, uno por jornada, según la minuta modelo.

**Implicación funcional crítica:** una persona puede ser simultáneamente
`alumno` y desempeñar la modalidad de `secretaría ad honorem`. El sistema debe
distinguir la condición académica/modalidad de práctica del **rol de acceso** que
le permite operar funciones de secretaría.

## 6. Catálogo parcial de procesos observado

SRC-IMG-05 confirma siete denominaciones:

1. juicio oral de fijación de pensión alimenticia;
2. juicio oral de aumento o disminución de pensión alimenticia;
3. juicio oral de divorcio por causal determinada;
4. juicio oral de paternidad y filiación;
5. juicio oral de guarda y custodia;
6. juicio ejecutivo de cobro de pensiones alimenticias atrasadas;
7. cambio de nombre en vía judicial.

La reunión menciona aproximadamente 25 tipos. Por tanto, la evidencia disponible
es un **catálogo parcial de 7**, no el listado completo.

## 7. Requisitos documentales por proceso

### 7.1 Fijación de pensión alimenticia

Fuente: SRC-IMG-01.

- certificación original y reciente de matrimonio, no mayor de seis meses;
- certificación de nacimiento de los hijos menores de edad, no mayor de seis
  meses;
- copia del DPI del solicitante;
- nombre completo y dirección del lugar donde vive o trabaja la persona demandada.

### 7.2 Guarda y custodia

Fuente: SRC-IMG-01.

- certificación original y reciente de matrimonio, no mayor de seis meses;
- certificación de nacimiento de los hijos menores cuya guarda y custodia se
  solicita, no mayor de seis meses;
- copia del DPI del solicitante;
- número de DPI de la persona demandada;
- nombre completo y dirección del lugar donde vive o trabaja la persona demandada.

### 7.3 Aumento o disminución de pensión alimenticia

Fuentes: SRC-IMG-02 y SRC-IMG-03.

- certificación original y reciente de matrimonio, no mayor de seis meses;
- certificación de nacimiento de los hijos menores de edad, no mayor de seis
  meses;
- número de DPI de la persona demandada;
- copia del DPI del solicitante;
- nombre completo y dirección del lugar donde vive o trabaja la persona demandada;
- certificación original de la sentencia o convenio donde se fijó la pensión.

### 7.4 Paternidad y filiación

Fuente: SRC-IMG-02.

- certificación original y reciente de matrimonio, no mayor de seis meses;
- certificación de nacimiento de los hijos menores cuyo reconocimiento se
  pretende, no mayor de seis meses;
- copia del DPI del solicitante;
- nombre completo y dirección del lugar donde vive o trabaja la persona demandada;
- capacidad económica para pagar la prueba de ADN en INACIF en el momento
  procesal oportuno.

### 7.5 Cobro de pensiones alimenticias atrasadas

Fuente: SRC-IMG-04.

- certificación original y reciente de matrimonio, no mayor de seis meses;
- certificación de nacimiento de los hijos menores de edad, no mayor de seis
  meses;
- copia del DPI del solicitante;
- número de DPI de la persona demandada;
- nombre completo y dirección del lugar donde vive o trabaja la persona demandada;
- certificación original de la sentencia o convenio donde se fijó la pensión;
- estado de cuenta desde la fecha en que se fijó la pensión hasta el día en que
  se presenta la solicitud.

### 7.6 Divorcio por causal determinada

Fuente: SRC-IMG-06.

- certificación original y reciente de matrimonio, no mayor de seis meses;
- certificación de los hijos en común; para hijos mayores de edad se indica copia;
- copia del DPI del solicitante;
- número de DPI de la persona demandada;
- nombre completo y dirección del lugar donde vive o trabaja la persona demandada;
- carencia de bienes extendida por Finanzas Públicas, original y reciente;
- certificación de nacimiento de ambos cónyuges;
- constancia de ingresos, indicada en la fuente como aplicable únicamente al
  cónyuge varón;
- fecha aproximada de separación.

La regla diferenciada por sexo debe ser confirmada por el cliente antes de
convertirse en validación automática.

### 7.7 Cambio de nombre en vía judicial

La fuente confirma que el caso se atiende, pero no incluye sus requisitos.

### 7.8 Documento tachado en las fotografías

En SRC-IMG-01, SRC-IMG-02 y SRC-IMG-04 aparece `recibo de agua reciente`
tachado manualmente. Se interpreta como **requisito retirado o no vigente**, pero
debe confirmarse antes de configurar las listas definitivas. No se debe marcar
como obligatorio en el prototipo.

## 8. Reglas funcionales derivadas de las fuentes

- Las certificaciones sujetas a vigencia deben registrar fecha de emisión y
  permitir identificar si superan seis meses.
- Debe distinguirse entre original, copia simple y fotocopia.
- El expediente necesita datos de la contraparte, aunque esta no sea cliente ni
  usuario del sistema.
- Algunos requisitos son datos o condiciones, no archivos: fecha de separación,
  dirección de la contraparte, capacidad de pago de ADN y cantidad de hijos.
- Un requisito puede ser condicional, por ejemplo constancia de ingresos o
  inscripción anual por pensum cerrado.
- La formación del expediente del alumno tiene estados previos a su aprobación y
  emisión de carné.
- La asignación de práctica incluye modalidad, sede, jornada, horario y período.
- Los términos `usuario`, `solicitante`, `alumno`, `secretaria ad honorem` y
  `persona demandada` representan sujetos diferentes y no deben mezclarse.

## 9. Inconsistencias o puntos que requieren validación

- En la minuta de secretaría se mezclan `jornada matutina` y `jornada vespertina`
  dentro del mismo modelo; el sistema no debe inferir la jornada sin selección
  expresa.
- La enumeración de la minuta salta del numeral II al IV; es un defecto del
  modelo documental, no una etapa del flujo.
- Las fuentes usan `salario mensual o quinquenal`; probablemente se refiere a
  quincenal, pero no debe corregirse sin confirmación.
- Se utilizan Guatemala y Santa Elena/Flores como lugar de firma en distintos
  formularios; el lugar debe ser capturable, no estar fijado rígidamente.
- Los requisitos de inscripción del alumno varían ligeramente entre ficha,
  fotografía y minutas.
- Solo se aportaron requisitos de seis de los siete procesos fotografiados.
- No se aportaron los restantes tipos hasta completar los aproximadamente 25.
