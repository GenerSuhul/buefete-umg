# Trazabilidad de cambios solicitados el 27 de octubre de 2026

## Regla de trabajo

El alcance funcional se deriva del pedido del responsable del sistema. Las decisiones funcionales principales fueron respondidas por el usuario. Cada fila se valida con guardar, refrescar, reabrir y verificar el siguiente uso del dato. La aceptación actual se concentra en el sistema principal .NET/PostgreSQL/MinIO. La adaptación y publicación en Vercel quedan aplazadas por instrucción del usuario.

| ID | Requisito | Módulo / pantalla / acción | Endpoint y persistencia a verificar | Permisos y prueba de aceptación | Responsable |
|---|---|---|---|---|---|
| C01 | Rehabilitar cliente en lista negra | Lista negra y ficha de usuario atendido | Restricción global, API y auditoría | Admin permitido; bloqueo se retira también tras refrescar y entre sedes | clientes_ux |
| A01 | Amonestación escrita con PDF y alerta | Alumno, sanciones | Documento privado, metadata y evento disciplinario | Consulta y descarga autorizadas; enlace WhatsApp con mensaje preparado y confirmación humana | raíz |
| A02 | Suspensión seis meses global con inicio/fin | Alumno, acceso, inscripción, asignación | Registro central global y validación en cada sede | Acceso/operaciones denegados en todas las sedes dentro del período; recuperación al concluir | raíz |
| A03 | Suspensión definitiva global | Alumno, acceso, inscripción, asignación | Registro central global | Denegación en todas las sedes | raíz |
| A04 | Retiro manual de amonestación | Alumno, sanciones | Evento reversible con auditoría | Sólo admin sede o superusuario, según origen/alcance por confirmar | raíz |
| A05 | WhatsApp al número | Cliente/alumno, contacto | Enlace de mensaje al número validado | Abre destinatario correcto sin exposición de datos ajenos | clientes_ux/alumnos |
| A06 | Correo de alumno opcional | Alta/edición/contrato/DB | Guardado nulo y unicidad de correos existentes | Sin correo se permite alumno sin acceso | alumnos |
| A07 | No inscribir sin papelería completa | Inscripción alumno | Estado de requisitos y regla backend | Falta de documento impide inscripción aun por API | alumnos |
| A08 | Quitar semestre, Registro inicial | Alta y ficha alumno | DTO y persistencia revisados | UI sin campos retirados, registro válido | alumnos |
| A09 | Jornada entre semana/sábado/domingo | Alumno | Enum o catálogo según modelo | Guarda y reaparece al refrescar | alumnos |
| A10 | Dirección práctica sólo ad honorem/externa; casos civiles sólo fecha inscripción | Alumno, modalidad | Validación backend y UI condicional | Cambiar modalidad limpia/ignora dato inaplicable | alumnos |
| A11 | Aviso previo al fin de pasantía | Campanita | Consulta de período, lectura persistida | Aviso 15 días antes; sólo vencimientos, número de nuevos y sonido una vez por aviso | raíz |
| A12 | Crear usuario opcional para alumno | Inscripción y cuenta | Alta sin cuenta, alta posterior opcional | Sin credenciales no puede iniciar sesión; inscripción sí persiste | alumnos |
| I01 | Restablecer contraseña propia del superadministrador con 2FA | Seguridad de cuenta | Segundo factor por correo institucional y revocación de sesiones | Recuperación segura con correo SMTP real | raíz |
| N01 | Campanita con cantidad y sonido | AppShell y avisos | Endpoint/lectura persistida | Sólo avisos del usuario/sede; sin duplicar sonido en refresh | raíz |
| K01 | Actualizar/eliminar requisito del catálogo | Catálogos | API, referencias de expedientes y auditoría | No romper requisitos ya asociados | expedientes |
| K02 | Quitar vigencia, condicional, condición, instrucciones de UI | Catálogos | Contrato conserva valores seguros si necesarios | Alta/edición funcionan tras refrescar | expedientes |
| K03 | Selector de proceso escribible | Apertura expediente | Consulta catálogo | Filtrado por texto y selección accesible | expedientes |
| K04 | Quitar activo/inactivo en alta tipo proceso | Catálogos | Estado inicial derivado por servidor | Nuevo proceso activo sin entrada manual | expedientes |
| E01 | Baja, activo y finalizado de expediente | Expediente | Transiciones, auditoría y recuperación | Estado correcto al refrescar, no confundir baja con finalización | expedientes |
| E02 | Memoriales antes de línea de tiempo | Expediente | Sólo navegación/presentación | Secciones mantienen funcionalidad | expedientes |
| U01 | Quitar Archivo digital para alumno del sidebar | Navegación | Filtrado de UI; API conserva permisos adecuados | Alumno no ve menú | clientes_ux |
| U02 | Editar ficha de usuario sin wizard de recepción | Usuario atendido | Update DTO, vista y persistencia | Edición directa por secciones, datos reaparecen | clientes_ux |
| U03 | Quitar Papelería del usuario | Usuario atendido | Navegación de ficha | Documentos relevantes siguen recuperables donde corresponda | clientes_ux |
| J01 | Estudio jurídico junto a casos con revisiones, fechas, PDF e historial | Alumno | Entidad/archivos/contrato/API | Primera revisión, segunda revisión y escrito como tipos; admin o secretaría registran entrega final | raíz |
| J02 | Entrega de estudio jurídico cierra práctica | Alumno, casos, acceso | Estado de cierre, asignaciones e identidad | Sin nuevos casos/acceso; ficha, procesos, documentos e historial siguen visibles | raíz |
| J03 | Cierre de práctica bajo Alumnos | Navegación y lista | Consulta de cerrados | Lista correcta tras refrescar | raíz |
| R01 | Eliminados permanentes liberan espacio | Retención | Purga DB/objetos con registro de autorización | Superadmin, confirmación previa, ausencia definitiva y prueba de espacio | raíz |

## Pasadas de aceptación

1. Producto: aclarar semántica de sanciones, cierre, purga, avisos y 2FA.
2. Dominio y contratos: estados, permisos, DTO y transiciones coherentes.
3. Base de datos: migraciones, unicidad, relaciones y auditoría; revisar aislamiento por sede.
4. API: acciones protegidas, errores comprensibles y persistencia.
5. Frontend: formularios, navegación, alertas, loading/error/vacío y accesibilidad.
6. Documentos: upload, metadata, relación, descarga y privacidad.
7. QA: navegador real, API directa, DB, MinIO, refresco, casos borde y regresión.
8. Producción: validar el entorno objetivo específico; no inferir paridad con Vercel.

## Estado de implementación y verificación

- C01, A05-A09, A12, K01-K04, E01-E02 y U01-U03 pasaron recorridos de API y navegador sobre la instalación principal en entornos QA aislados. La inscripción exige los ocho documentos antes de aprobarse; el enlace de WhatsApp abre un mensaje preparado y la persona confirma el envío. A10 requiere todavía un caso de cambio de modalidad con dato inaplicable para aceptación completa.
- J01-J03 tienen implementación integral en el sistema principal: revisiones firmadas, historial, entrega final, cierre de asignaciones y acceso, ficha preservada, listado de cierres. La aceptación local de API cubrió 50 comprobaciones en PostgreSQL y almacenamiento QA aislados (`.artifacts/changes-qa/legal-study/result.json`); el navegador comprobó guardar → refrescar → ver PDF → entregar → refrescar → listado, sin errores de consola ni requests (`.artifacts/changes-qa/legal-study/ui-result.json`).
- R01 tiene implementación nativa de vista previa, confirmación exacta, permiso de superadministrador, eliminación de metadatos y objetos con cola de reintento. QA aislada validó cliente con expediente y dos PDF, y alumno con revisión, cierre y documentos propios: 71 comprobaciones, base y almacenamiento sin registros u objetos restantes y cola vacía. Falta la regresión general final.
- A01-A04 pasaron pruebas API con PostgreSQL y PDF real, además del recorrido de navegador de suspensión, alerta, retiro, descarga y WhatsApp. Queda verificar explícitamente la descarga y los bloqueos desde otra sede. A11 y N01 pasaron consulta, contador, sonido, lectura persistida y refresco en navegador. I01 pasó inicio/completado de recuperación, código erróneo y reutilizado rechazados, revocación y nueva contraseña con SMTP de prueba; falta configurar y probar el correo institucional real.
- La migración `20261028010401_OptionalStudentEmailIndex` se aplicó en PostgreSQL QA y en la instalación local Docker para admitir correos vacíos de distintos alumnos.
- La migración conjunta `20261028012622_StudentDisciplineAndLegalStudy` se aplicó sobre PostgreSQL QA y en la instalación local Docker. La compilación de producción del frontend, el typecheck y la solución .NET Release pasaron; las 21 pruebas de integración y 39 unitarias de .NET pasaron. La suite general de frontend en paralelo tuvo un fallo intermitente de temporización en App.test; el mismo archivo pasó 4/4 aisladamente. Las imágenes Docker API/web se reconstruyeron y los servicios locales 5104/5180 quedaron saludables con HTTP 200; Vercel está aplazado.
- El usuario pidió aplazar Vercel el 27 de octubre; la aceptación actual se limita al sistema principal local. No afirmar conformidad del conjunto mientras cualquiera de las filas anteriores permanezca sin implementar y probar de extremo a extremo.
