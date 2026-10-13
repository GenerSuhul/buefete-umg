# Digitalización: visualización y edición de páginas

## Requisito y alcance

Secretaría/administración con `scanner.use` y permiso de escritura sobre el destino debe poder adquirir o importar páginas, revisarlas inmediatamente, girar/ordenar/quitar, guardar y recuperar un borrador, revisar el PDF final, confirmar, recuperar y descargar el documento asociado. No se modifican escaneos existentes para probar.

## Encontrado y causa raíz

El cliente nativo solicitaba cuatro rutas inexistentes con `/screens/`: contenido individual, orden, rotación y eliminación. El controlador usa `/pages/`. La generación final usaba correctamente `/preview`, por eso se veía el PDF combinado aunque la página individual fallaba. Reproducción con sesión/página reales en sede QA: `/pages/{id}/content` = 200 PDF; `/screens/{id}/content` = 404.

El error de lectura se mezclaba con el error de adquisición. El lienzo no tenía loading/recuperación; el efecto dependía de objetos completos y volvía a descargar al guardar. Las tarjetas PDF eran indicadores de página, no miniaturas rasterizadas. El PDF final sólo aparecía en una pequeña vista lateral.

## Trazabilidad

| Requisito / acción | Pantalla / consumidor | Endpoint | Servicio / persistencia | Tablas / almacenamiento | Permisos / prueba |
|---|---|---|---|---|---|
| Capturar/importar | DocumentAcquisition → ScanWorkspace → dataSource | POST scan-sessions; POST {id}/pages | ScanSessionService.Create/AddPages | scan_sessions, scan_pages; originales privados MinIO | scanner.use + destino escribible + propietario; PDF multipágina QA |
| Ver página | ScanWorkspace; scanPagePreview | GET {id}/pages/{pageId}/content | OpenPageAsync → IFileStorage | scan_pages → OriginalStorageKey | sesión propia; ruta real y visor Chrome |
| Girar/ordenar/quitar | ScanWorkspace → dataSource | PUT pages/{id}/rotation; PUT pages/order; DELETE pages/{id} | RotatePage/ReorderPages/RemovePage | scan_pages; invalidación de preview | UI/contrato real + guardar/reabrir |
| Recuperar | ScanWorkspace | GET scan-sessions; POST {id}/draft | GetDrafts/SaveDraft | scan_sessions, scan_pages | sólo borradores propios; refresco y reapertura |
| Revisar/confirmar | Visor central, Confirmar PDF | GET {id}/preview; POST {id}/complete | OpenPreview/Complete → DocumentService | documents + requisito de inscripción + MinIO + auditoría | PDF final de 2 páginas, orden y asociación |
| Recuperar evidencia | Perfil alumno → DocumentLink | GET students/{id}/profile; GET documents/{id}/content | StudentService/DocumentService | student_requirements, documents, MinIO | refresh/descarga; token de otra sede rechazado |

## Cambios

- `frontend/src/data/dataSource.ts`: corregidas las cuatro rutas sin cambiar el contrato del backend.
- `frontend/src/components/documents/ScanWorkspace.tsx`: carga/errores independientes, reintento explícito, descarte de respuestas tardías, dependencias estables, evita descargas inútiles de PDF para tarjetas textuales. PDF final en el visor principal, alternando con las páginas.
- `frontend/src/utils/scanPagePreview.ts`: derivado local de una página PDF seleccionada y su rotación, con pdf-lib ya instalado. El original no se modifica; el backend sigue construyendo y validando el PDF final.
- Sin migración ni cambio de permisos, políticas de retención o almacenamiento.

## Verificación reproducible

- `npm run typecheck`.
- `npm test`: contrato nativo, selección de página/rotación sin alterar original, página inexistente, error recuperable del visor y regresiones frontend.
- `dotnet test --no-restore --verbosity quiet`: 30 unitarias + 21 integración aprobadas.
- Docker Compose: build producción de `web`; API/PG/MinIO conservados.
- `node scripts/scan-workspace-ui-e2e.cjs <directorio-modulos-playwright> --probe`: reproduce 200/404 sobre la misma página persistida.
- Mismo script sin `--probe`: Chrome real, sede/base QA aislada, PDF multipágina, reapertura, giro/quitar UI, orden API, vista final central, confirmación, refresh, asociación al requisito, descarga MinIO, estado Completed SQL y rechazo de token cruzado. Evidencia en `.artifacts/scanner/qa-scan-*/result.json` y `pdf-final.png`.

El script limpia únicamente su sede/base/prefijo de archivos QA identificado y validado; no elimina archivos ni borradores del usuario.

## Límites

No se dispara remotamente el dispositivo físico compartido sin controlar sus hojas. El usuario ya aportó evidencia de adquisición física exitosa; la regresión usa PDF real importado por el mismo endpoint, no simula PostgreSQL/MinIO ni el backend. La siguiente captura física con el Epson y sus opciones WIA/alimentador requiere validación en la oficina. Las tarjetas PDF identifican páginas; no son miniaturas rasterizadas. Se inspecciona el contenido en el visor central.

## Resultado comprobado

- Build de producción aprobado y web actualizada en `http://127.0.0.1:5180`; web/API/PostgreSQL/MinIO saludables.
- E2E aprobado: `.artifacts/scanner/qa-scan-1791835222536/result.json`; captura visual inspeccionada `pdf-final.png`. Sin errores JavaScript ni respuestas HTTP fallidas en las operaciones del escáner. PDF descargado: 2 páginas, anchos 340/320 en el orden solicitado; sesión Completed comprobada directamente en SQL; acceso cruzado rechazado con 401.
- Regresión documental frontend aprobada: 4 archivos, 6 pruebas (contrato API, extracción/rotación PDF, página inexistente, recuperación de error del visor y adquisición temporal previa al registro). Backend: 51/51.
- La suite general frontend no se considera aprobada: una ejecución sufrió timeout en una prueba ajena al cambio durante compilación y otra se interrumpió tras varios minutos sin resultados. La regresión focalizada del módulo documental sí terminó y pasó. No se presenta como una aprobación integral del sistema.
