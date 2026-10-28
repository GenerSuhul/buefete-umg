# Plan de entrega final — Bufete Popular UMG

**Base:** lectura completa de las 12 páginas de «Lineamientos Proyecto Final Desarrollo Web.pdf», del Ing. Francisco Javier Zepeda Reyes, ciclo 2026.
**Organización:** cuatro integrantes producen toda la documentación y los materiales de entrega; los cinco participan en el foro y la defensa.
**Fecha del plan:** 12 de octubre de 2026.
**Estado:** planificación; no certifica que el sistema, el despliegue o la implementación institucional hayan aprobado las pruebas.

## 1. Acuerdo de trabajo

Se utilizarán los nombres P1, P2, P3 y P4 hasta conocer los nombres reales. P5 es el desarrollador del sistema: no redacta capítulos, manuales, diagramas, actas, diapositivas ni video; participa en el ensayo y en la exposición con demostración del sistema y defensa del código.

Los cuatro documentalistas también deben operar y comprender la aplicación. Su trabajo consiste en investigar, documentar, probar, capacitar, preparar evidencias y organizar la entrega; no en atribuirse desarrollo que no realizaron. El informe puede describir el proyecto como trabajo del equipo, con responsabilidades reales. No se deben inventar entrevistas, fechas, firmas, pruebas ni autorías.

El PDF exige commits de todos los integrantes y ramas (p. 6). P1–P4 harán contribuciones auténticas de documentación, diagramas, manuales y pruebas desde sus propias cuentas; P5 conserva su historial de desarrollo. Estos commits documentales no sustituyen desarrollo previo ni justifican alterar el historial. Si el docente interpreta la regla como programación de cada integrante, P1 debe aclarar ese alcance con él.

## 2. Tres decisiones antes de redactar

1. **Fijar la versión que se entregará.** Registrar rama/commit, URL, backend, base de datos, almacenamiento y módulos incluidos. El repositorio describe un sistema Next.js/React + API ASP.NET Core + PostgreSQL + S3/MinIO; también documenta una demo pública independiente con backend y persistencia diferentes. No dibujar la arquitectura .NET como si fuera la de la demo. P3 y P4 contrastan el sistema evaluable con los archivos y el entorno efectivos.
2. **Resolver la presentación.** La sección 12 pide PowerPoint o Genially, no menciona Gamma. P4 prepara las diapositivas en Gamma y entrega también una versión PPTX revisada y un PDF de respaldo. P1 confirma con el docente el uso de Gamma en el foro y el formato de entrega; si no acepta Gamma para presentar, se utiliza el PPTX preparado. No depender solo del enlace Gamma.
3. **Confirmar requisitos institucionales.** P1 obtiene fecha de entrega, duración del foro, modalidad de preguntas, nombres/carnés, contacto del bufete, aprobación de propuesta/stack/alcance y los lineamientos UMG de formato. El PDF exige APA 7 y lineamientos UMG, pero no especifica en sí todos los márgenes, tipografía y demás detalles. No inventarlos. Si falta autorización previa, registrar la situación y obtener la confirmación actual sin retrofechar documentos.

El dominio/subdominio propio aparece condicionado a «cuando sea posible» (p. 6); la URL pública y HTTPS sí son obligatorios. Una instalación local no cubre el requisito de Internet y una demo pública no acredita por sí sola implementación real en el bufete.

## 3. Reparto principal de los cuatro integrantes

| Persona | Área principal | Documentos y materiales de los que responde | Revisión cruzada |
|---|---|---|---|
| P1 | Contexto, metodología, coordinación institucional y edición | Preliminares; capítulo I; capítulo III, 3.1–3.4 y tabla económica; conclusiones/recomendaciones; referencias consolidadas; autorizaciones, instrumentos, minutas, aceptación; informe final integrado | P2 revisa claridad, coherencia y relación objetivos/resultados |
| P2 | Uso del sistema, interfaz y capacitación | Capítulo II, 2.1–2.3; capítulo IV, entorno e interfaz/componentes; manual de usuario completo; navegación/prototipos/capturas; materiales de capacitación; guion y grabación del video | P1 revisa lenguaje y P3 contrasta permisos/procesos |
| P3 | Dominio, backend, API, datos y arquitectura | Capítulo II, 2.4–2.7; capítulo III, 3.5; capítulo IV, backend/API/BD/autenticación/módulos/reportes/validaciones/errores/integración; núcleo del manual técnico; diagramas de arquitectura, datos y comportamiento; diccionario; documentación y colección de API | P4 verifica reproducibilidad y correspondencia con despliegue |
| P4 | QA, despliegue, operación y exposición | Capítulo II, 2.8; capítulo V; capítulo VI; sección operativa del manual técnico; diagrama de despliegue; matriz de pruebas/evidencias; copias de respaldo; paquete de entrega; Gamma/PPTX/PDF y coordinación del foro | P3 revisa exactitud técnica y P2 verifica recorridos/capturas |

**Distribución del trabajo compartido:** P1 redacta la evidencia institucional de capacitación/entrega y P4 la incorpora al capítulo V; P2 conduce la capacitación y obtiene evidencias; P4 edita el video que guioniza/graba P2; cada autor entrega sus referencias y pies de figura a P1. P3 integra el manual técnico y P4 le entrega instrucciones de producción, respaldo, restauración y soporte. P1 consolida el informe académico. P4 consolida la presentación y la carpeta de entrega.

Cada tarea tiene un responsable que la cierra. Quien revisa registra observaciones concretas, pero no se convierte en un segundo autor obligatorio de todo el contenido.

## 4. Índice completo del informe académico

Este índice reproduce los contenidos mínimos de la sección 11 (pp. 8–11). Se pueden añadir subapartados sin omitir los siguientes.

### Preliminares — P1

- Portada institucional: universidad, centro, curso, docente, título, entidad, integrantes, carnés y fecha.
- Índice general, índice de figuras e índice de tablas, generados desde el documento editable.
- Introducción: necesidad, propósito, solución, entidad beneficiada y organización del informe.

### Capítulo I. Marco conceptual — P1

- **1.1 Antecedentes:** historia, ubicación, actividades, población atendida, organización y situación tecnológica del bufete, con fuentes comprobables.
- **1.2 Planteamiento del problema:** proceso anterior, fallas, afectados, consecuencias y necesidad de solución. Documentar el flujo previo; no asumirlo.
- **1.3 Justificación:** necesidad, beneficios, impacto social y mejoras esperadas.
- **1.4 Objetivos:** general y específicos, luego vinculados con pruebas y conclusiones.
- **1.5 Alcances:** módulos, actores, procesos, reportes y funciones de la versión entregada.
- **1.6 Limitaciones:** tiempo, presupuesto, infraestructura, conectividad, disponibilidad y restricciones técnicas reales.

### Capítulo II. Marco teórico — P2, P3 y P4

- **2.1 Aplicaciones web modernas — P2:** frontend, backend, cliente-servidor, diseño responsivo y comunicación.
- **2.2 Interfaz seleccionada — P2:** tecnología efectiva, componentes/vistas, navegación, estado y consumo de servicios.
- **2.3 Diseño — P2:** framework/librería o estrategia CSS realmente empleada, componentes, responsividad y personalización. No atribuir Tailwind/Bootstrap si no se usan.
- **2.4 Backend — P3:** arquitectura, rutas, controladores, servicios, middleware, validaciones y errores.
- **2.5 Base de datos — P3:** gestor, modelo, normalización, relaciones, persistencia, respaldo y recuperación.
- **2.6 REST — P3:** concepto, verbos, estados HTTP, JSON, documentación y pruebas.
- **2.7 Seguridad — P3:** autenticación, autorización, JWT o mecanismo efectivo, roles, contraseñas y SSL.
- **2.8 Nube — P4:** proveedor efectivo, servicios, variables, dominio/subdominio y SSL.

Cada apartado explica el concepto con citas y lo relaciona con el proyecto. Las fuentes técnicas se consultan en documentación oficial; las del contexto institucional se obtienen del bufete. No se rellenan referencias inexistentes.

### Capítulo III. Marco metodológico — P1 y P3

- **3.1 Investigación — P1:** tipo y justificación; entrevistas, observación, encuestas cuando se hayan usado, revisión documental y recolección de requisitos. Anexar instrumentos/evidencias.
- **3.2 Desarrollo — P1:** metodología realmente seguida y sustentada con historial, tareas e incrementos. No presentar retrospectivamente sprints que no ocurrieron.
- **3.3 Requerimientos — P1:** funcionales, no funcionales, reglas, roles, historias/casos de uso y criterios de aceptación, contrastados por P3.
- **3.4 Factibilidad — P1:** económica, operativa y tecnológica, con apoyo de P4 sobre infraestructura.
- **3.4.1 Tabla económica — P1:** concepto, descripción, costo mensual en Q y costo total en Q; dominio, frontend, backend, BD, SSL, capacitación, otros y total. Añadir período del cálculo, fuente/fecha, renovaciones, cuotas gratuitas y sostenibilidad; incluir almacenamiento/correo si aplican. Registrar pendiente lo no cotizado.
- **3.5 Diseño — P3:** arquitectura, diagramas, modelo y diccionario de datos; incorpora prototipos/navegación de P2 y despliegue de P4.

### Capítulo IV. Desarrollo del sistema — P2 y P3

- Entorno de desarrollo y estructura frontend — P2.
- Componentes, vistas o plantillas — P2.
- Backend y API RESTful — P3.
- Implementación de BD y migraciones — P3.
- Autenticación y autorización — P3.
- Módulos, reportes y validaciones — P3 con capturas de P2.
- Errores e integración entre componentes — P3.

**Todos los apartados deben llevar descripción, capturas pertinentes, fragmentos relevantes de código y explicación de funcionamiento**, como exige la p. 10. Los fragmentos se identifican por archivo/versión, se explican y omiten secretos; no se pega el repositorio completo.

### Capítulo V. Pruebas e implementación — P4

- Plan de pruebas y matriz de casos.
- Pruebas con usuarios, resultados y ajustes comprobados.
- Configuración inicial, usuarios/roles y carga autorizada de datos.
- Capacitación: programa, materiales, asistentes, evidencias y evaluación práctica.
- Implementación y aceptación institucional: pruebas del contacto responsable, observaciones, acta y carta.

### Capítulo VI. Despliegue — P4

- Plataforma; publicación de interfaz y backend; configuración/publicación de BD.
- Variables de entorno y CORS; dominio/subdominio; SSL; comunicación entre servicios.
- Pruebas finales en producción.
- Evidencias de URL, acceso, login, operaciones, reportes, móviles, seguridad y certificado.

### Cierre y anexos — P1 integra

- Conclusiones ligadas a objetivos, problema, resultados e impacto comprobado.
- Recomendaciones: mantenimiento, respaldos, seguridad, mejoras y continuidad.
- Bibliografía APA 7.
- Anexos: autorización, instrumentos, fotografías de reuniones, diagramas, manuales, enlaces, credenciales de prueba mediante mecanismo controlado, capacitación, acta de entrega y carta de aceptación/satisfacción.

Los datos de evaluación deben ser restringidos y revocables. Las credenciales administrativas de la entidad se transfieren por canal privado, fuera del repositorio, Gamma, video y documentos públicos.

## 5. Manuales completos

### Manual de usuario — P2

Entregar PDF y fuente editable, identificado con versión, fecha y URL del sistema. Estructura:

1. Objetivo, audiencia, requisitos de acceso y dispositivos compatibles.
2. Login, cierre de sesión y recuperación/cambio de contraseña cuando exista.
3. Roles y permisos: administrador, secretaría, alumno y otros que estén activos en la versión entregada. El cliente atendido no es una cuenta de acceso.
4. Navegación, búsquedas, filtros, paginación y mensajes.
5. Usuarios: registro, consulta, modificación, roles, activación/inactivación.
6. Clientes: recepción, ficha, datos derivados, declaración de ingresos y edición.
7. Alumnos: inscripción, documentos, resolución, modalidad y asignación de casos, según alcance efectivo.
8. Expedientes: apertura, proceso, requisitos, personas, asignaciones, estados y seguimiento.
9. Documentos: cargar/adquirir, revisar, aceptar, asociar, consultar, previsualizar, descargar y recuperar; versiones/histórico cuando existan. Escáner separado de importación y probado con equipo físico si se incluye.
10. Memoriales, revisiones, presentación y notificaciones, según versión.
11. Actividades y reportes: criterios/fechas, PDF, Excel y uso de resultados.
12. Histórico, bajas lógicas, restauración y restricciones de retención.
13. Errores recuperables, estados vacíos, ayuda, privacidad y soporte.
14. Recorrido completo: cliente → expediente → documentos → alumno → seguimiento → reporte.

Cada procedimiento incluye actor, permiso, punto de entrada, datos, pasos numerados, captura real legible, resultado, siguiente paso y qué hacer ante error. Verificar guardar → refrescar → reabrir; no describir botones que no funcionan. P2 adapta el índice si un módulo no pertenece al alcance aprobado y registra la limitación.

### Manual técnico — P3 integra; P4 redacta operación

1. Arquitectura y stack efectivos; versiones verificadas; mapa del repositorio.
2. Prerrequisitos e instalación desde una copia limpia.
3. Variables de entorno: nombre, finalidad, obligatoriedad, entorno y ejemplo sin secretos.
4. BD: creación/migraciones, relaciones, diccionario, constraints/índices, datos de evaluación y verificación.
5. API: recursos, método/ruta, autenticación, permiso, DTO/JSON de solicitud/respuesta, estados HTTP, validación, errores y paginación/filtros.
6. Frontend: rutas, estado, cliente API, formularios y compilación.
7. Archivos: storage privado, metadata, asociaciones, límites, recuperación; agente de escáner si aplica.
8. Identidad, contraseñas, sesiones/tokens, autorización y auditoría.
9. Build, pruebas, herramientas y comandos efectivos del repositorio.
10. Publicación: infraestructura, pasos, CORS, TLS, dominios, configuración y health checks.
11. Copias de BD + documentos + proyecto; restauración conjunta en ambiente aislado y validación de referencias/archivos.
12. Logs, diagnóstico, incidentes, renovación, actualizaciones, rollback, mantenimiento y continuidad.
13. Limitaciones reales, contacto de soporte y transferencia administrativa privada.

P4 sigue los pasos sin conocimiento implícito del autor y registra los ajustes necesarios. Un manual técnico no se acepta porque los comandos parezcan correctos.

## 6. Diagramas y recursos de diseño

El PDF pide arquitectura, diagramas, modelo de datos, diccionario, prototipos y navegación; no enumera todos los tipos UML. Los siguientes son la selección del equipo para cubrir esa exigencia y los diagramas que solicitó el desarrollador.

| Artefacto | Responsable | Contenido verificable |
|---|---|---|
| Contexto y arquitectura de componentes/capas | P3 | Actores, navegador, frontend, API, capas, BD, almacenamiento, correo y escáner si aplican; responsabilidades y direcciones de comunicación |
| Despliegue efectivo | P4 | Proveedores/nodos, dominio, HTTPS, frontend, backend, BD, storage, red y respaldo; distinguir local, demo y producción |
| Entidad-relación | P3 | Tablas reales, PK/FK, cardinalidades, usuarios/roles, clientes, alumnos, expedientes, documentos, actuaciones y auditoría según esquema final |
| Casos de uso | P3 | Actores, permisos y principales operaciones del alcance |
| Actividades/proceso | P3 | Flujo completo de atención y expediente, decisiones, requisitos pendientes y errores |
| Secuencia | P3 | Flujo UI → API → autorización → servicio → persistencia/storage → respuesta; al menos registro y ciclo documental |
| Estados | P3 | Transiciones reales de expediente/memorial/inscripción cuando estén implementadas |
| Mapa de navegación y prototipos | P2 | Pantallas/rutas por rol; captura de versión real; distinguir prototipo histórico de pantalla final |
| Diccionario de datos | P3 | Tabla/campo, tipo, nulabilidad, PK/FK, valor por defecto, restricción, descripción y sensibilidad |

Entregar archivos editables y exportaciones legibles con título, leyenda, versión y referencia en el informe. No reutilizar el ERD retirado que los requerimientos del repositorio excluyen. No representar arquitectura de alta disponibilidad objetivo como infraestructura actualmente instalada.

## 7. Matriz de cobertura de los lineamientos

Esta tabla cubre las secciones 1–15 del PDF; el inventario de 17 entregables está en la sección siguiente. Cada punto se desglosa en filas de prueba cuando se ejecute.

| Fuente PDF | Requisito/evidencia | Responsable | Condición de cierre |
|---|---|---|---|
| §§1–4, p. 2 | Entidad real y distinta del otro grupo; necesidad, contacto, autorización, aprobación docente, levantamiento, validación e impacto | P1 | Identidad/contacto confirmados; autorizaciones y evidencia reales; objetivos vinculados a resultados |
| §5, pp. 3–4 | Stack compatible y autorizado; sin Angular; modalidad separada/integrada documentada; interfaz moderna, adaptable y navegadores modernos | P3/P2 | Stack de la versión entregada contrastado con código/despliegue; autorización y pruebas de interfaz |
| §6.1, p. 5 | Login/logout, contraseñas seguras, JWT/sesiones, rutas/endpoints protegidos, roles/permisos, acceso por usuario, secretos | P3 documenta; P4 prueba | Evidencias positivas y negativas; controles de backend verificados, sin secretos distribuidos |
| §6.2, p. 5 | Registro/consulta/edición/activación/inactivación de usuarios y roles | P2 documenta; P4 prueba | CRUD y cambios de acceso comprobados tras refresh |
| §6.3, p. 5 | CRUD, baja, búsqueda/paginación, validación frontend/backend, confirmaciones/advertencias/errores y excepciones | P2/P3 documentan; P4 prueba | Persistencia, errores recuperables y permisos comprobados |
| §6.4, p. 5 | PDF, Excel, reporte por fecha/criterio y utilidad operativa | P4 | Archivos generados, abiertos y cotejados con filtro y datos; utilidad explicada |
| §6.5, p. 5 | Computadora/tableta/teléfono; identidad, navegación, formularios, reutilización, mensajes y accesibilidad básica | P2 | Capturas y pruebas de teclado/foco/etiquetas y tamaños; errores registrados |
| §6.6, p. 5 | Esquema, PK/FK/relaciones, constraints/validaciones/datos, creación/migraciones, diccionario y backup | P3/P4 | Modelo real documentado; migración y restauración verificadas |
| §7, p. 6 | Endpoints organizados/documentados, GET/POST/PUT o PATCH/DELETE según corresponda, JSON, estados, validación, errores centralizados, protección y pruebas API | P3 | OpenAPI o inventario completo + colección/herramienta equivalente + evidencia de ejecución |
| §8, p. 6 | Web/API/BD en Internet, integración, variables, HTTPS, dominio/subdominio cuando posible, dispositivos y repo actualizado | P4 | Acceso externo y recorrido real en versión final; no solo localhost |
| §9, p. 6 | Git remoto: frontend/backend, DB, .gitignore, README, variables sin secretos, commits de todos y ramas | P3 revisa; cada integrante aporta | Historial auténtico y repositorio reproducible; no commit único de fin de curso |
| §10, p. 7 | Configuración, usuarios/roles, carga inicial, datos autorizados, capacitación, manuales, enlaces/acceso admin, validación y acta | P1 coordina; P2 capacita; P4 evidencia | Entidad opera y acepta; entrega privada de acceso admin |
| §11, pp. 8–11 | Informe PDF completo, formal, paginado, tablas/figuras/citas, APA 7 + UMG, seis capítulos y anexos | P1 integra; P2–P4 aportan | Índices correctos, contenido/evidencias completos y revisión visual |
| §12, p. 11 | Los 17 entregables | P4 | Checklist nominal y paquete final abierto/verificado |
| §13, p. 11 | Entidad/problema, requisitos/arquitectura/tecnologías, demo real, roles/reportes/Internet/SSL, implementación/capacitación/impacto, preguntas y todos participan | P1–P5 | Ensayo completo; cinco intervenciones y defensa compartida |
| §14, pp. 11–12 | Sin Angular/entidad ficticia/plantilla sin lógica/reutilización completa de otro curso/sistema descargado inexplicable/DB simulada/enlace local/sistema no implementado/secretos/datos no autorizados | P1–P4 revisan | Procedencia, funcionamiento, implementación y privacidad sustentados |
| §15 y nota final, p. 12 | Autorización, datos ficticios/anonimizados en público, roles, backups explicados, privacidad, costos sostenibles, utilidad/continuidad, cambios significativos autorizados | P1/P4 | Demostración segura; transferencia y sostenibilidad reales; aprobaciones verificadas |

**Matriz funcional complementaria a mantener por P3 y P4:**

`REQUISITO → MÓDULO → PANTALLA → ACCIÓN → ENDPOINT → SERVICE → REPOSITORY/PERSISTENCIA → TABLAS → PERMISOS → PRUEBA`

Añadir archivo de evidencia, versión/entorno, responsable, resultado y pendiente. Las rutas/servicios/tablas se llenan desde la implementación efectiva; no se inventan para completar casillas. Las matrices existentes son insumos, no prueba automática de la versión final.

## 8. Los 17 entregables finales, sin omisiones

La numeración coincide con la sección 12 del PDF.

| Nº | Entregable | Responsable de recoger/documentar/verificar | Evidencia/archivo de entrega |
|---|---|---|---|
| 1 | Sistema web desarrollado y funcional | P4 verifica la versión existente | Versión fija + recorrido de aceptación; defectos abiertos registrados |
| 2 | Frontend desplegado | P4 | URL y evidencia desde Internet |
| 3 | Backend/API desplegado | P4 | Identificación del servicio + prueba autenticada real |
| 4 | BD implementada y respaldada | P3 esquema; P4 respaldo | Migraciones/esquema + backup + prueba de restauración |
| 5 | SSL activo y enlace público | P4 | URL HTTPS y evidencia de certificado/conexión válida |
| 6 | Repositorio de fuente | P3 | Enlace/acceso del evaluador y commit de entrega |
| 7 | Scripts/migraciones BD | P3 | Directorio y pasos de aplicación comprobados |
| 8 | Documentación completa PDF | P1 | Informe final PDF + fuente editable |
| 9 | Manual técnico y de usuario | P3 y P2 | Dos PDFs + fuentes editables |
| 10 | Presentación PowerPoint o Genially | P4 | Gamma para preparación/foro autorizado + PPTX revisado + PDF de respaldo |
| 11 | Video demostrativo | P2 guion/grabación; P4 edición | MP4 probado; duración propuesta 5–7 min, no impuesta por el PDF |
| 12 | Carta de autorización | P1 | Documento auténtico firmado por contraparte competente |
| 13 | Reuniones y requerimientos | P1 | Minutas/instrumentos/fotos autorizadas/matriz de fuentes |
| 14 | Capacitación | P2 produce; P1 formaliza | Agenda, asistencia, material y evidencia autorizada |
| 15 | Acta de entrega y carta de aceptación | P1 | Ambos documentos firmados; versión, fecha y observaciones |
| 16 | Credenciales de evaluación | P4 | Cuentas limitadas y datos de prueba; entrega controlada; expiración prevista |
| 17 | Respaldo del proyecto y BD | P4 | Copia del código/configuración segura, BD y documentos; inventario y restauración |

P5 no tiene tareas documentales en esta tabla. La programación ya realizada no elimina la obligación de probar los entregables. Si surge una brecha funcional, P4 la registra con pasos/evidencia y el equipo gestiona su resolución como tarea separada: no la oculta con texto, capturas o un video.

## 9. Pruebas y evidencias que los cuatro deben producir

P4 administra la matriz: número, requisito, módulo, caso, actor/permiso, precondición, datos, pasos, resultado esperado, obtenido, estado, fecha, entorno/versión, evidencia y defecto asociado. Conservar las columnas mínimas del ejemplo del PDF.

### Recorridos mínimos

- Login válido/inválido; logout; cuenta inactiva; ruta/API sin autorización; alumno intentando ver caso ajeno.
- Usuario: crear → asignar rol → modificar → inactivar → verificar acceso; restauración/activación si aplica.
- Cliente: crear → buscar → consultar → editar → guardar → refrescar → reabrir → utilizar en expediente.
- Expediente: abrir con tipo de proceso → requisitos → asignar alumno → actuación/memorial/notificación → histórico → consulta por actor autorizado.
- Documentos: cargar → revisar → aceptar → asociar → consultar → previsualizar/descargar → refrescar → recuperar; archivo inválido/excesivo y permiso incorrecto. Si se promete escaneo, probar adquisición física; importar un PDF no lo acredita.
- Alumnos: inscripción/papelería/asignación → perfil → casos → seguimiento, conforme al alcance efectivo.
- Baja lógica → desaparición de listados → restauración autorizada, cuando exista.
- Reportes: filtro → resultado → PDF → Excel → abrir ambos → cotejar datos/fechas. La presencia de un menú no prueba exportación Excel.
- PC/tableta/móvil; estados loading/vacío/error/éxito; navegación y accesibilidad básica.
- API con herramienta equivalente a Postman/Insomnia: métodos del alcance, JSON, estados HTTP, validaciones y errores.
- Producción: URL/HTTPS → login → acción → persistencia → siguiente proceso; consola, red y logs revisados.
- Backup → restaurar en entorno separado → login → registro de ejemplo → recuperar documento; no probar sobre la BD operativa.

P2 ejecuta los recorridos de usuario/interfaz; P3 los contratos/BD/permisos; P4 los de producción y regresión. P1 coordina pruebas con personal real y registra aceptación/impacto. Los datos ficticios de evaluación deben persistirse realmente; no equivalen a simular la BD.

**Estados permitidos:** Pendiente, En ejecución, Aprobado con evidencia, Fallido, Bloqueado con dependencia. No marcar «Aprobado» por lectura de código, HTTP 200 o pruebas antiguas. Dependencias físicas/externas no disponibles quedan expresamente pendientes.

### Evidencia institucional y de impacto

P1 reúne autorización, contacto, levantamiento, reuniones, prueba con usuarios, asistencia a capacitación, entrega y aceptación. Debe haber evidencia de utilización en el bufete, no solo del foro. Registrar participantes/fecha/versión y consentimiento para fotos. Si no existen evidencias históricas, obtener validación actual y describir su fecha real.

Comparar, si es posible, tiempo de localizar un expediente, consulta de documentos pendientes, preparación de reporte y percepción de usuarios antes/después. Registrar método y muestra; no inventar porcentajes de mejora. Sin medición, reportar resultados observados y límites.

## 10. Cronograma propuesto de 15 jornadas de trabajo

El PDF no establece fecha ni duración. Esta es una propuesta relativa; se convierte a fechas después de conocer la entrega. Las pruebas institucionales y firmas dependen de disponibilidad real y deben agendarse desde el primer día.

| Jornadas | P1 | P2 | P3 | P4 | Hito que permite avanzar |
|---|---|---|---|---|---|
| 1–2 | Confirmar entidad/contacto/aprobaciones/formato/plazo; agenda institucional; inventario de evidencias | Recorrer sistema e inventariar procedimientos/capturas | Fijar stack/contratos/modelo; inventario técnico | Identificar entorno evaluable; checklist y riesgos; agendar QA | Alcance, versión y responsables establecidos; brechas visibles |
| 3–5 | Cap. I y III 3.1–3.4; instrumentos y factibilidad | II 2.1–2.3; IV interfaz; manual usuario inicial | II 2.4–2.7; III 3.5; IV técnico; ERD/arquitectura/API | II 2.8; VI; despliegue; pruebas iniciales y brechas | Borradores completos y diagramas concordantes con versión |
| 6–8 | Validación de requisitos con contraparte; evidencias y formato | Completar manual; pruebas UX; capacitación preparada; guion video | Completar manual/diccionario/colección; probar contratos y revisar manual usuario | Ejecutar E2E/producción/reportes/roles/restauración; capítulo V | Evidencias trazables; fallos/pendientes registrados y asignados |
| 9–10 | Documentar aceptación/observaciones reales; actas/cartas; consolidar informe | Capacitación y pruebas con usuarios; grabar recorrido con datos ficticios | Ajustar documentación tras pruebas; verificar reproducibilidad | Respaldos; anexos técnicos; editar video y preparar Gamma/PPTX | Implementación institucional y entrega documentadas, o dependencia explícita |
| 11–12 | Integrar PDF/índices/citas/conclusiones; revisión editorial | Revisar claridad/capturas; probar manual desde cuenta de usuario | Revisar informe/diagramas; validar paquete técnico | Integrar carpeta; revisar PPTX/PDF/MP4 y enlaces | Paquete completo sin incoherencias ni secretos |
| 13–14 | Ensayo y preguntas de contexto | Ensayo de flujo/capacitación | Ensayo de arquitectura/código/API | Ensayo de despliegue/pruebas; contingencias del foro | Participan los cinco, incluido P5; demo cronometrada |
| 15 | Verificación de firmas/versión final | Verificación manual/video | Verificación repo/migraciones/manual | Checklist final, acceso externo, backups y entrega | Los 17 entregables comprobados; pendientes declarados |

Si la fecha es más cercana, se reduce el tiempo de redacción y se divide por módulos, pero no se omiten capacitación, aceptación, pruebas reales ni respaldo. No prometer firmas o disponibilidad del bufete sin confirmación.

## 11. Presentación Gamma y foro con cinco expositores

**Propuesta:** 20 minutos de exposición/demo más preguntas; ajustar al tiempo que autorice el docente. Todos responden sobre su bloque y conocen el recorrido completo. P5 no queda como único capaz de explicar el sistema.

| Expositor | Tiempo orientativo | Diapositivas/bloque | Qué explica |
|---|---|---|---|
| P1 | 3 min | 1–3 | Equipo y entidad, proceso anterior/problema, objetivos, impacto esperado y alcance |
| P2 | 3 min | 4–5 | Actores/permisos, flujo de atención, facilidad de uso, manual/capacitación |
| P3 | 4 min | 6–8 | Arquitectura efectiva, tecnologías, BD/documentos, API y seguridad; fragmento de código preparado |
| P4 | 4 min | 9–11 | Despliegue/Internet/HTTPS, pruebas/reportes/respaldos, implementación y evidencia de aceptación/impacto |
| P5, desarrollador | 6 min | 12–14 y demo | Recorrido funcional en vivo, decisiones de implementación/código, resultado y continuidad de la solución |

En modo foro, usar las cinco intervenciones como bloques y permitir preguntas entre ellos si lo pide el docente. P4 controla la presentación; P5 opera la demo; otro integrante observa tiempo y red.

### Recorrido de demostración

1. Abrir URL pública y mostrar conexión HTTPS válida.
2. Ingresar con cuenta autorizada y explicar el rol.
3. Localizar/crear cliente ficticio; abrir expediente y seleccionar proceso.
4. Incorporar documento y consultarlo desde su contexto.
5. Asignar alumno y registrar seguimiento; mostrar histórico.
6. Editar/guardar/refrescar para evidenciar persistencia.
7. Generar reporte filtrado, PDF y Excel; abrir archivos.
8. Mostrar límites de acceso con otro rol y cerrar sesión.

Preparar datos y cuentas previamente, sin convertir la demo en una secuencia de capturas. Si el tiempo no permite crear todo desde cero, usar un expediente preparado y realizar operaciones reales sobre él. El video sirve de contingencia por falla de red; debe identificarse como grabación, no como ejecución en vivo.

### Reglas para Gamma

- P4 recibe textos breves de P1–P3; P2 aporta capturas y P3/P4 diagramas verificables.
- Mantener identidad visual del bufete/UMG, una idea principal por diapositiva y diagramas legibles.
- No introducir expedientes reales, DPI, correos personales, documentos judiciales ni contraseñas en Gamma o el video.
- No aceptar cifras, bibliografía ni arquitectura inventadas por generación automática. Contrastar cada diapositiva con el informe final.
- Revisar el PPTX exportado: fuentes, saltos, tablas, imágenes, enlaces y diagramas. Preparar PDF, MP4 y archivos de demo disponibles sin conexión.

### Preguntas que todos deben ensayar

¿Qué necesidad real resuelve? ¿Quién puede ver cada expediente? ¿Cómo se verifica el permiso en API? ¿Dónde se guarda el archivo y su metadata? ¿Qué pasa si falla storage/Internet? ¿Cómo se respalda y restaura? ¿Qué endpoint y tabla intervienen en una operación? ¿Cómo se calcula el reporte? ¿Qué evidencia acredita capacitación/aceptación? ¿Cuánto cuesta mantenerlo y quién continúa? ¿Qué aportó cada integrante?

## 12. Organización de archivos y control diario

P4 prepara esta estructura de entrega; P1–P3 entregan sus materiales dentro de ella. Es una propuesta, no una carpeta ya generada por este plan.

```text
ENTREGA_BUFETE_UMG/
  00_LEEME_ENTREGA.pdf
  01_INFORME/Informe_Final.pdf + fuente editable
  02_MANUALES/Manual_Usuario.pdf + Manual_Tecnico.pdf + editables
  03_DIAGRAMAS/editables + exportaciones
  04_API/documentacion + coleccion + ejemplos sin secretos
  05_PRUEBAS/matriz + evidencias + resultados
  06_ENTIDAD/autorizacion + reuniones + capacitacion + acta + aceptacion
  07_PRESENTACION/presentacion.pptx + presentacion.pdf + enlace Gamma
  08_VIDEO/demostracion.mp4
  09_CODIGO/enlace_repositorio + copia_fuente + migraciones
  10_RESPALDOS/inventario + proyecto + BD + documentos + restauracion
  11_ACCESOS/instrucciones de entrega privada de cuentas de evaluacion
```

Los respaldos con datos reales requieren acceso restringido y tratamiento separado del paquete público; no se suben al repositorio ni al foro. El LEEME indica versión, enlaces, inventario, secuencia de evaluación, responsable de continuidad y pendientes.

Tablero diario: tarea, responsable, dependencia, fecha, archivo, revisor, estado y evidencia de aceptación. Reunión breve de seguimiento para resolver bloqueos. Cada cierre de fase informa: **Encontrado, causa raíz si aplica, cambios/materiales, pruebas realizadas, resultado y pendiente**.

## 13. Revisión final y aceptación del paquete

- [ ] Propuesta, stack y alcance autorizados; entidad/contacto reales confirmados.
- [ ] Versión final identificada; arquitectura/BD/API/manuales corresponden a esa versión.
- [ ] Informe con todos los apartados, APA 7 y formato UMG confirmado; índices/paginación/citas correctos.
- [ ] Manual usuario probado mediante guardar/refrescar/reabrir y continuidad de procesos.
- [ ] Manual técnico seguido en entorno limpio; migraciones, configuración y operación verificadas.
- [ ] Diagramas editables/exportados, legibles y vinculados al informe; diccionario completo.
- [ ] Funciones mínimas de §§6–7 probadas: seguridad, usuarios, CRUD, búsqueda, validación, PDF, Excel, filtros, interfaz y BD.
- [ ] API, persistencia, documentos, permisos, errores, consola/red/logs y regresiones con evidencia real.
- [ ] Frontend/backend/BD comunicándose por Internet; HTTPS y móviles comprobados.
- [ ] Implementación real, capacitación, validación, acta y carta de aceptación auténticas.
- [ ] Repositorio actualizado, ramas y aportes auténticos de los cinco; README/configuración sin secretos.
- [ ] Respaldos de proyecto/BD/documentos y recuperación conjunta comprobados.
- [ ] Cuentas de evaluación operativas entregadas de forma controlada; acceso admin entregado privadamente a entidad.
- [ ] Gamma autorizado o PPTX utilizado; PPTX/PDF/MP4 abiertos y verificados.
- [ ] Ensayo con cinco participantes; preguntas, tiempo y contingencia cubiertos.
- [ ] Los 17 entregables presentes; sin datos sensibles expuestos; pendientes declarados.

**Regla de entrega:** documentos terminados no compensan una función, implementación institucional o firma pendiente. Si una dependencia impide cerrar un requisito, se registra con evidencia y responsable; no se presenta como aprobado.

## 14. Fuentes del repositorio para comenzar

Lecturas iniciales utilizadas para contextualizar este plan: `README.md`, `frontend/package.json`, `docs/requerimientos/01_REQUERIMIENTOS_DEL_SISTEMA.md`, `05_MATRIZ_DE_TRAZABILIDAD.md`, `06_CONTEXTO_REUNION.md`, `docs/arquitectura/00_MEMORIA_TECNICA.md`, `01_MODELO_DOMINIO_BACKEND.md`, `02_API_BACKEND_V1.md`, `03_BASE_DATOS_Y_OPERACION_LOCAL.md`, `09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md` y `docs/demo/OPERACION.md`.

Para desarrollar los entregables, los responsables deben ampliar la lectura a flujos/casos de uso, almacenamiento, escáner, trazabilidad y auditorías relevantes. Los documentos de arquitectura antiguos contienen decisiones iniciales: contrastar con código y versión final. La documentación de demo señala limitaciones de correo, escáner y retención; verificar cuáles corresponden a la versión elegida. Este plan no ejecutó builds, pruebas API/UI, despliegues, validaciones institucionales ni restauraciones.
