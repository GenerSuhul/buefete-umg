# Expedientes, catálogos y purga: trazabilidad

## Problema y decisiones de dominio

- Los requisitos de un tipo de proceso se pueden actualizar y retirar del catálogo. Retirar significa `IsActive=false`: las copias de requisitos ya creadas en expedientes permanecen para conservar el historial.
- El expediente puede estar activo, finalizado o dado de baja. Finalizar usa el cierre existente y su historial; dar de baja usa eliminación lógica y permite restaurar. Memoriales se muestra antes de Línea de tiempo.
- Los registros dados de baja pueden purgarse sólo con un JWT de superadministrador de plataforma de la sede actual. La plataforma emite esa sesión con `POST /platform/tenants/{code}/session`. La vista previa enumera documentos/tamaño y bloquea si hay dependencias protegidas. La confirmación exige escribir la referencia exacta.
- La transacción de purga elimina metadatos y agrega claves a `pending_storage_purges`; después se borran los objetos de almacenamiento. Si el proveedor falla, la cola persiste y se puede reintentar sin restaurar registros eliminados.

## Matriz de trazabilidad

| Requisito | Módulo / pantalla / acción | Endpoint / servicio | Persistencia | Permiso | Prueba |
|---|---|---|---|---|---|
| Editar y retirar requisito | Catálogos / editar, Quitar requisito | `PUT /catalogs/requirements/{id}` / CatalogService | `requirement_definitions.IsActive`; `case_requirements` histórico | `catalogs.write` | `scripts/catalog-validation-e2e.cjs` (requiere UI QA actual) |
| Buscar tipo al abrir expediente | Expedientes / Nuevo / escribir nombre o código | `GET /catalogs/process-types`, `POST /cases` / CaseService | `process_types`, `legal_cases` | `cases.write` | Typecheck y QA UI pendiente |
| Finalizar, activar, dar de baja | Expediente / detalle | `POST /cases/{id}/close`, `POST /cases/{id}/reopen`, `DELETE /cases/{id}` | `legal_cases`, asignaciones, línea de tiempo | `cases.write`, `records.delete` | QA UI pendiente |
| Purga irreversible | Eliminados / vista previa, escribir referencia, eliminar | `GET /deleted-records/{type}/{id}/purge-preview`, `DELETE .../purge` / DeletedRecordService | cliente/alumno/expediente y dependencias propias; `pending_storage_purges` | `records.deleted.read` y `platform_admin=true` | `scripts/deleted-record-purge-e2e.cjs` |
| Reintentar archivos | Eliminados / Reintentar limpieza | `POST /deleted-records/storage-cleanup` | objetos S3/local y cola persistente | `records.deleted.read` y `platform_admin=true` | QA API + MinIO |

## QA ejecutado en base aislada

`scripts/start-changes-qa.ps1 -Port 5105` creó `bufete_changes_qa_b0d9620a7f2d` y prefijo MinIO `bufete-changes-qa/b0d9620a7f2d`. `node scripts/deleted-record-purge-e2e.cjs .artifacts/changes-qa/b0d9620a7f2d/environment.json` verificó: admin de sede recibe 403; referencia incorrecta, 400; preview contabilizó cliente con expediente hijo y dos documentos (1740 bytes); superadministrador con sesión de sede purgó, 200; preview posterior, 404; cliente, expediente y ambos documentos ausentes en PostgreSQL; cola vacía. `mc ls` no encontró objetos en el prefijo de ese tenant después de la purga. La primera ejecución de la prueba dejó un tenant QA con un documento porque detectó correctamente que el JWT central no puede usarse directamente en otra sede; la siguiente usó el switch de sede. Todo está dentro de la base/prefijo aislado.

`node scripts/student-purge-e2e.cjs .artifacts/changes-qa/b0d9620a7f2d/environment.json` pasó 71 comprobaciones: inscripción aprobada, revisión firmada, entrega del estudio jurídico, cuenta desactivada, purga previa del expediente relacionado, baja y purga del alumno. La vista previa contó 10 documentos/5750 bytes sin bloqueo. Ficha, cuenta, revisión, cierre y documentos quedaron ausentes en PostgreSQL; la cola de archivos terminó vacía.

`node scripts/expedientes-catalogos-purge-ui-e2e.cjs <módulos Playwright> .artifacts/changes-qa/b9489d240353/environment.json` comprobó en navegador la vista previa, la referencia obligatoria, purga, refresh, campos retirados de Catálogos y consola/red sin errores. `node scripts/catalog-validation-e2e.cjs <módulos Playwright> .artifacts/changes-qa/b9489d240353/environment.json` comprobó creación, edición y baja lógica de requisito persistentes tras refrescar, duplicado con mensaje comprensible y limpieza de la sede QA temporal. Backend Release compiló sin errores ni advertencias; `npm run typecheck` pasó.

`node scripts/expediente-selector-estados-ui-e2e.cjs <módulos Playwright> .artifacts/changes-qa/b9489d240353/environment.json` abrió un expediente desde el wizard mediante búsqueda escrita por código de proceso. Verificó `processTypeId` por API; Memoriales precede a Línea de tiempo; Finalizar proceso persistió `Closed` tras refrescar; Marcar activo persistió `Active` tras refrescar; ambos eventos aparecen en la línea de tiempo; Dar de baja movió el expediente a Eliminados. Consola y respuestas de red sin errores. Los datos de este recorrido son ficticios y permanecen únicamente en la base QA aislada.

## Pendiente de comprobación

- Memoriales, sesiones de escaneo y amonestaciones globales en purga: guardias implementadas, falta ejercitarlas con datos QA. Cliente con expediente hijo y alumno con cierre/revisiones sí se probaron.
- Ejercitar reintento de almacenamiento tras una falla real inducida; la transacción y la cola se han comprobado en camino de éxito.
- Vercel queda aplazado por instrucción del usuario; la purga permanente está disponible en la API principal.
