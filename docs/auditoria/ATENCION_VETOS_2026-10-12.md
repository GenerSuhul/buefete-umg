# Atención, apertura y veto global por DPI — 12 octubre 2026

## Requisito y aceptación

Actores: superusuario y administrador de sede pueden emitir un veto permanente con motivo y repetición del DPI. Secretaría sólo consulta el bloqueo al atender. El identificador es el CUI de 13 dígitos, no el nombre. El control abarca las sedes registradas en esta plataforma; sistemas independientes requieren integración y quedan fuera del alcance.

El historial se conserva. Se impiden alta de cliente vetado, cambio de identidad para eludir el bloqueo, reactivación, nuevos expedientes, asignaciones y continuación/documentación de atención. Se permite consulta histórica, descarga y cierre del caso. No se implementa revocación ni vencimiento. Los administradores de sede sólo consultan motivos de vetos emitidos por su sede; el superusuario consulta todos.

Flujo esperado: registrar/buscar usuario por DPI → abrir proceso → consultar checklist sin dar documentos por recibidos → adjuntar/escanear/revisar requisitos → asignar alumno habilitado → seguimiento. Creación no equivale a expediente completo.

## Evidencia inicial y causa raíz

`scripts/case-flow-ux-probe.cjs`: ancho de lista 1010 px, contenido 1033 px; badge 34 px para texto de 75 px; scroll anidado. El selector `.requirement-preview__item > span` afectaba tanto icono como badge. La búsqueda de relaciones necesitaba dos controles separados. No había registro global de veto ni regla transversal en servicios.

## Matriz de trazabilidad (evidencia de aceptación abajo)

| Requisito | Módulo/pantalla/acción | API | Servicio/persistencia | Tablas | Permisos | Prueba prevista |
|---|---|---|---|---|---|---|
| Emitir veto | Vetos de atención / ficha usuario / confirmar | POST client-restrictions | ClientRestrictionService / central TenantRegistry | central client_restrictions + audit_logs | Administrador local activo / superusuario validado | repetición, motivo, duplicado, secretaría 403, refresh |
| Consultar propios/globales | Vetos / buscar DPI / paginar | GET client-restrictions | mismo / filtro SourceTenantCode | central client_restrictions | administrador propia sede; root todas | aislamiento motivo entre dos sedes |
| Verificar identidad | Registro usuario / continuar | POST client-restrictions/check | mismo / DPI canónico | central client_restrictions | clients.write | separadores, sin identidad, bloqueo |
| Bloquear atención | Alta/edición/reactivación/declaración | clients, attention, income-declarations | ClientService + restricciones | tenant clients / income_declarations + central | permisos existentes | DPI vetado, cambio de DPI, nombre repetido |
| Bloquear casos | Abrir/asignar/modificar/seguimiento/reabrir | cases y subrutas | CaseService + restricciones | legal_cases y dependencias + central | permisos existentes | API directa, UI, cierre permitido |
| Bloquear documentos | Adjuntar/escanear/asociar | documents, scan-sessions | DocumentService + restricciones | documents / scan_sessions + central | contexto autorizado primero | MinIO, persistencia, lectura permitida |
| Exponer bloqueo | Ficha cliente/detalle expediente | GET clients/{id}/profile, cases/{id} | contratos Restriction | central + tenant | permisos de lectura existentes | refresh e información mínima |
| UX sin desbordamiento | Abrir expediente / requisitos | catálogo existente | sin contrato nuevo | process_types / requirement_definitions | cases.write | navegador 1366/900/360, scroll único |
| Búsqueda única y continuidad | Abrir expediente / seleccionar / asignación | clients, cases | RelationLookup + servicios existentes | clients / legal_cases / assignments | clients.read / cases.write / cases.assign | teclado, vacío, error, conservar assignStudentId |

## Decisiones técnicas

- La identidad central almacena sólo 13 dígitos ASCII; acepta espacios/guiones de presentación. Índice único y CHECK PostgreSQL.
- La base de cada sede permanece aislada. La consulta de veto siempre usa la conexión central, nunca la conexión de la sede.
- Bloqueo transaccional consultivo PostgreSQL por DPI durante escrituras para serializar emisión de veto y operaciones concurrentes de atención. Fallo del registro central impide continuar, no permite atención por defecto.
- Auditoría central automática con actor, fecha y motivo. El listado de auditoría local excluye estos registros globales para no filtrar motivos de otras sedes.
- El módulo no se muestra en la demo independiente: no se simula un control global sin persistencia central real.

## Validación

Comprobado hasta esta fase:

- Backend: compilación sin errores; 39 pruebas unitarias y 21 de integración aprobadas. La migración generada se ajustó al namespace exigido por `.editorconfig`.
- Frontend: TypeScript y build Next.js de producción aprobados; 9 pruebas dirigidas de búsqueda/teclado/error/confirmación del veto.
- Respaldo central previo: `.artifacts/backups/before-client-restrictions.dump` (948287 bytes). Migración aplicada a PostgreSQL real durante el arranque.
- `scripts/client-restrictions-e2e.cjs`: aprobado, evidencia `.artifacts/case-flow/qa-veto-1791839630112/result.json`. Dos bases de sede aisladas. Secretaría 403; administrador local emite veto; otra sede queda bloqueada; motivos no visibles desde otra sede; superusuario consulta global; 409 por duplicado y emisión concurrente; índice único/CHECK/auditoría consultados en PostgreSQL.
- Navegador: búsqueda por DPI; abrir expediente y asignar alumno con inscripción aprobada mediante PDF reales en MinIO; timeline y asignación tras refresh; emitir veto; ficha/listado tras refresh; alta/cambio DPI/atención/caso/escaneo denegados por API; mismo nombre con otro DPI permitido; cierre e historial permitidos; PDF histórico descargable. Sin excepciones JavaScript en el recorrido aprobado.
- Checklist: 1366 px → ancho/contenido 1010/1010; 900 → 810/810; 360 → 322/322. Badge 97/97; sin scroll interno. Capturas inspeccionadas visualmente.
- Regresión documental: `scripts/scan-workspace-ui-e2e.cjs` aprobado; evidencia `.artifacts/scanner/qa-scan-1791839849128`. Página PDF, rotación, quitar, ordenar, borrador/reapertura, confirmar, asociación, refresh y descarga desde MinIO.
- Datos históricos: se encontraron 15 DPI inválidos. No se reescriben. Se probó consulta de una ficha heredada con aviso de identidad pendiente. La corrección de la identidad preserva la firma ya asociada; no permite cambiar un DPI vetado.

Los primeros intentos de QA no aprobados quedan registrados en sus carpetas. Hubo un error del script de prueba (variable que ocultaba `process`), selección durante carga y timeouts bajo presión de memoria durante builds concurrentes. Los intentos fallidos no se cuentan como aceptación. Logs registraron cancelación de una solicitud en ese contexto; no se asume limpieza histórica de todos los logs.

La pasada `qa-veto-1791840651114` confirmó recuperación de DPI con firma preservada, pero detectó otra carrera de UX: el `requestAnimationFrame` del autofocus inicial del modal enfocaba el botón de cierre aunque el usuario ya hubiera enfocado el buscador. Se corrigió el componente compartido para respetar el enfoque dentro del diálogo y cancelar el frame al desmontar. Dos pruebas específicas aprobadas en `ModalFocus.test.tsx`. El botón «Continuar» ya deshabilita la transición mientras se consulta la ficha. Una reconstrucción Docker devolvió `frontend grpc server closed unexpectedly`; el reintento secuencial funcionó sin borrar volúmenes ni datos.

## Aceptación final del alcance

- Último recorrido aprobado: `.artifacts/case-flow/qa-veto-1791841279511/result.json`, en las imágenes finales. Incluye recuperación de identidad preservando firma, bloqueo visible desde el formulario de registro sin perder el nombre escrito y ausencia del botón de asignación en el expediente vetado. Consola: `errors: []`; red: `networkErrors: []` (sin respuestas 500).
- Regresión documental repetida después del último cambio del modal: `.artifacts/scanner/qa-scan-1791841374194/result.json`, aprobada con `errors: []` y `badResponses: []`. Fixtures retirados al finalizar.
- Checklist medido e inspeccionado a 1366/900/360 px, sin desbordamiento ni scroll anidado. Datos de usuario/caso/asignación/veto sobreviven refresh y se reutilizan en el siguiente proceso.
- Pruebas dirigidas finales: 39 unitarias + 21 de integración backend; 21 frontend en cuatro archivos (Shared, ClientRestrictionDialog, ModalFocus, FormControls). No se presenta esto como una ejecución de la suite completa de todas las pantallas.
- Docker frontend: `sha256:98a33f9dd238c83e3d439e9aeeeaf0e3b6538631aa7b27552b558438c423b909`; API: `sha256:62d17fd9fc48f1897b47b943323777a4d9cf3d170e01f08b3eda9bd2a63f63b2`. Builds de producción y servicios saludables. El reintento del error del builder fue secuencial, sin reinicio de Docker ni eliminación de volúmenes.
- Acceso local: `http://127.0.0.1:5180/acceso`; módulo para administradores: `/vetos`. No se emite ningún veto a personas reales para probar. Se eliminan únicamente registros, bases y objetos de fixtures con prefijos validados.

Límites y pendientes: los 15 DPI históricos necesitan verificación/corrección humana; nunca se inventa su valor. Escáner físico y sistemas externos independientes no se prueban ni se declaran cubiertos. Los guards de declaraciones de ingresos y todos los subflujos de memoriales se revisaron transversalmente, pero no se ejecutó cada combinación individual de esos subflujos bajo veto. El bloqueo global funciona en esta plataforma nativa; la demo independiente requiere integración del control central y no simula la protección. No se publican estos cambios a GitHub/Vercel en esta fase, ni se declara alta disponibilidad o 100% del sistema.
