# Auditoría funcional de formularios, CRUD y flujos operativos

Fecha de corte: 29 de agosto de 2026

## Alcance

- formularios de alumnos, expedientes, usuarios y reportes;
- selectores, fechas, horas, rangos, estados y mensajes de validación;
- coherencia entre candidatos mostrados por la interfaz y reglas del backend;
- comportamiento dentro de modales y en pantallas pequeñas.
- paridad entre contratos de creación y edición de clientes, alumnos y expedientes;
- transiciones de inscripción y trazabilidad de cambios operativos.

## Hallazgos confirmados

| Hallazgo | Causa | Corrección |
| --- | --- | --- |
| El selector de responsabilidad usaba una tipografía mayor que los demás campos | Los botones del popover heredaban el tamaño base del navegador y no el token del formulario | Disparador y opciones usan la misma escala, altura, peso y espaciado que los inputs |
| El horario abría el selector nativo de Chromium y se desbordaba sobre el modal | Uso directo de `input[type=time]` | Control propio con entrada `HH:MM`, selector de hora/minutos, portal y límites de viewport |
| Los períodos requerían dos calendarios independientes | Dos campos de fecha sin relación visual ni selección conjunta | Selector único `DateRangePickerField` con modo rango y un calendario |
| El formulario de asignación ofrecía alumnos que el backend rechazaba y truncaba candidatos sin declararlo | La interfaz consultaba el listado general de alumnos; luego el endpoint específico aplicaba un límite fijo de 100 | Contrato paginado de candidatos elegibles, búsqueda remota y exclusión de alumnos ya asignados al expediente |
| El alta permitía elegir `Presentada` sin explicar que aún no habilita asignaciones | Etiqueta de estado sin contexto operativo | Texto funcional que distingue borrador, revisión y aprobación previa a la asignación |
| La interfaz ofrecía `Presentada → Aprobada`, pero el dominio la rechazaba antes de revisar requisitos | El catálogo visual y `EnrollmentRules` tenían transiciones diferentes; el flujo detallado de estados continúa pendiente de confirmación institucional | Se permite resolución directa desde Presentada o Admitida, conservando la condición de que todo requisito obligatorio esté aceptado |
| La aprobación fallaba sin identificar qué estaba pendiente | `StudentRequirementDto` no informaba si el requisito era obligatorio | El contrato expone `isRequired`; la interfaz enumera los requisitos pendientes y deshabilita el guardado hasta resolverlos |
| El perfil del cliente no permitía editar su ficha completa | Existía `PUT /clients/{id}`, pero la ficha no ofrecía edición | Editor en cuatro fases con la misma cobertura del contrato de alta y revisión final |
| No existía actualización general del expediente | Solo podían modificarse elementos internos (requisitos, contraparte, asignaciones y cronología) | `PUT /cases/{id}` actualiza estado operativo y etapa; cliente y tipo de proceso permanecen inmutables para no invalidar el checklist documental |
| El calendario anual utilizaba un `select` nativo que se desbordaba | `captionLayout="dropdown"` delegaba mes y año al navegador | Cabecera propia con selectores visuales consistentes, navegación mensual, portal y límites de viewport |
| Los controles de paginación no cambiaban de página | El componente dibujaba anterior/siguiente sin `onClick` ni contrato de cambio | `Pagination` exige `onPageChange`; todos los listados operativos conservan página, recargan y tienen prueba de interacción |
| Formularios relacionales sólo mostraban los primeros registros | Se precargaban páginas fijas de 50/100 elementos | `RelationLookup` realiza búsqueda remota con debounce, conserva la selección y expone nombre accesible al `combobox` |
| Reemplazo e historial documental se limitaban a los primeros 100 registros | La UI reutilizaba una página fija del contexto completo | El reemplazo busca documentos vigentes de forma remota; el historial filtra por etiqueta y recorre todas las páginas |
| El historial de reportes se detenía en 100 y el envío sugería un correo no confirmado | Backend aplicaba `Take(100)` y el formulario incluía un destinatario inventado | Historial paginado de extremo a extremo y destinatario vacío, obligatorio antes del envío |

## Criterios normalizados

- Inputs, selectores y controles compuestos comparten altura, tipografía y estados de foco.
- Los popovers se renderizan fuera del contenedor desplazable y se reposicionan dentro del viewport.
- Un candidato inválido no se ofrece como opción; la validación del backend se conserva como defensa final.
- Los rangos se capturan en un solo control y se validan antes de enviarse.
- Las reglas operativas se expresan como instrucciones breves, no como mensajes técnicos.

## Cobertura aplicada

- Alta de alumnos: horarios, período de práctica y explicación del flujo de inscripción.
- Expedientes: candidatos válidos para asignación.
- Reportes: período semanal en un selector único.
- Usuarios: vigencia de participación en un selector único.
- Componentes compartidos: `Select`, `TimePickerField` y `DateRangePickerField`.
- Clientes: ficha completa de edición, validación por etapa y confirmación antes del `PUT`.
- Expedientes: edición controlada de estado y etapa con evento de cronología.
- Inscripciones: opciones calculadas según el estado actual y lista explícita de requisitos obligatorios pendientes.

## Matriz CRUD verificada

| Recurso | Crear | Consultar | Editar | Eliminar | Auditoría |
| --- | --- | --- | --- | --- | --- |
| Cliente | `POST /api/v1/clients` | listado, ficha y perfil | `PUT /api/v1/clients/{id}` con toda la ficha | eliminación lógica | interceptor de auditoría y papelera |
| Alumno | registro transaccional de perfil, inscripción y acceso | listado y perfil | `PUT /api/v1/students/{id}`, requisitos y estados | eliminación lógica y desactivación de acceso | interceptor, usuario resolutor y papelera |
| Expediente | `POST /api/v1/cases` con checklist inicial | listado y detalle | `PUT /api/v1/cases/{id}` más operaciones específicas | eliminación lógica | evento cronológico, interceptor y papelera |

En expedientes no se permite sustituir cliente o tipo de proceso después de abrirlo. Esos vínculos determinan titularidad, requisitos y trazabilidad; si fueran incorrectos debe corregirse el registro antes de operar o abrirse el expediente correspondiente.

## Evidencia de verificación

- compilación backend: 0 advertencias, 0 errores;
- pruebas backend: 15 unitarias y 17 de integración aprobadas;
- pruebas frontend: 23 aprobadas;
- construcción de producción frontend: aprobada;
- salud local: PostgreSQL y almacenamiento de objetos disponibles;
- prueba pública de navegador: acceso estructurado, controles con nombres accesibles, sin desbordamiento horizontal a 390 px y consola sin errores;
- E2E API/DB: edición completa de cliente y expediente, aprobación condicionada, asignación sólo de candidatos elegibles y persistencia posterior;
- pendiente de aceptación: repetir en navegador autenticado los recorridos guardar → refrescar → reabrir → usar en el siguiente proceso para administrador, secretaria y alumno.

## Referencias de diseño utilizadas

- W3C ARIA Authoring Practices, Date Picker Dialog Example: calendario en diálogo, navegación por teclado y gestión de foco.
- GOV.UK Design System, Check answers: revisión final y retorno por secciones en transacciones extensas.
- GOV.UK Design System, Validation: conservar valores y mostrar errores junto al campo y en contexto.
- Microsoft Azure Architecture Center, Web API design: semántica consistente de `GET`, `POST`, `PUT`, `PATCH` y `DELETE`.

## Regla de negocio preservada

Un alumno puede recibir casos únicamente cuando está activo y tiene al menos una inscripción aprobada. La aprobación sigue requiriendo que los requisitos obligatorios estén aceptados; esta protección no se relajó para ocultar errores de interfaz.
