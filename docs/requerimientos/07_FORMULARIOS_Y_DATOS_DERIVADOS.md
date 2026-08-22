# Formularios, fases y datos derivados

Este documento fija qué se captura, qué se calcula y qué se selecciona del sistema. Evita volver a introducir datos existentes o agregar campos inventados.

## Principios

- Una operación de negocio extensa se divide en pasos cortos dentro del mismo flujo.
- Cambiar de paso no crea registros parciales de cliente, alumno o expediente.
- Los campos provenientes del contexto se muestran como sólo lectura.
- Catálogos y relaciones se seleccionan; no se escriben como texto libre.
- El botón final resume los datos y explica los registros/documentos que se crearán.
- La fecha de nacimiento es la fuente preferida; la edad se calcula para la fecha de recepción o inscripción.
- Todos los cambios conservan usuario, fecha y trazabilidad.

## Registrar cliente

| Fase | Datos |
|---|---|
| 1. Identificación | nombre completo, fecha y lugar de nacimiento, edad calculada, nacionalidad, sexo, estado civil, DPI, escolaridad, profesión u oficio |
| 2. Contacto y economía | residencia, teléfono, celular, lugar/dirección/teléfono de trabajo, salario y frecuencia, cantidad de hijos |
| 3. Recepción | asistencia solicitada desde tipos de proceso activos, persona contra quien reclama, dirección de esa persona, lugar y fecha de recepción |
| 4. Papelería | DPI y firma/huella opcionales, declaración jurada opcional con datos ya capturados |
| 5. Revisión | resumen y confirmación única |

No se solicita un expediente al registrar al cliente. El cliente puede existir antes de abrir un proceso.

## Inscribir alumno

| Fase | Datos |
|---|---|
| 1. Identidad y academia | nombre, fecha de nacimiento, edad calculada, carné, DPI, correo institucional, semestre, jornada |
| 2. Contacto y trabajo | residencia, celular, teléfono residencial, lugar/teléfono de trabajo, jefe inmediato y puesto |
| 3. Práctica | modalidad, estado inicial, sede/dirección, jornada, días, horario, inicio/fin del período |
| 4. Papelería | los nueve requisitos consolidados del catálogo institucional |
| 5. Acceso y revisión | correo como identidad de acceso, contraseña inicial temporal, período y confirmación |

Alumno, inscripción y cuenta con rol `Alumno` se crean en una transacción. No deben quedar alumnos huérfanos sin acceso. El alumno sólo consulta sus casos y administra nombre, correo, fotografía y contraseña propios.

## Abrir expediente

| Fase | Datos |
|---|---|
| 1. Cliente y proceso | cliente seleccionado y tipo real de proceso activo |
| 2. Requisitos | vista previa del checklist que se generará desde el catálogo |
| 3. Contraparte | nombre, DPI, residencia, dirección laboral, teléfono y observaciones; se precarga la persona reclamada de la recepción cuando existe |
| 4. Confirmación | cliente, proceso, etapa inicial derivada y cantidad de requisitos |

Cuando se abre desde el perfil del cliente, el cliente está bloqueado. La etapa inicial es `Recolección documental` y la determina el backend. No se permite inventar procesos ni requisitos desde este formulario.

## Digitalizar y asociar documentos

- Desde un perfil, tipo e identificador del registro son de sólo lectura.
- La etiqueta y la versión se deciden una vez por sesión.
- Las páginas pueden proceder de escáner, imagen o PDF y se administran individualmente.
- La vista previa final es obligatoria antes de crear el documento versionado.

## Datos que nunca deben pedirse dos veces

- cliente cuando el flujo nace desde su perfil;
- alumno cuando la papelería nace desde su inscripción;
- expediente cuando una evidencia nace desde su línea de tiempo o requisito;
- datos económicos ya capturados al generar la declaración jurada;
- persona reclamada al abrir el primer expediente, si ya existe en la ficha de recepción;
- usuario separado para el alumno: el correo institucional es la identidad de acceso.
