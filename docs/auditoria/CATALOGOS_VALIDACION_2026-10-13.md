# Catálogos: contrato de requisitos y errores comprensibles

## Requisito

El administrador debe crear/editar requisitos del proceso seleccionado, conservar los datos ante un error y recibir una explicación en español que indique qué revisar. Guardar debe sobrevivir refresco y permitir reutilizar la definición en el catálogo.

## Encontrado y causa raíz

Reproducción real en una sede QA: POST /api/v1/catalogs/requirements con scope=LegalProcess devuelve 400, título One or more validation errors occurred y errors[$.scope]. El enum nativo admite Process, StudentEnrollment y ClientGeneral. El formulario enviaba LegalProcess al crear y ofrecía CertifiedCopy, valor inexistente en DocumentNature. El cliente HTTP leía sólo detail/title y descartaba errors; así llegaba el mensaje técnico tanto al modal como a la notificación.

Evidencia de reproducción: .artifacts/catalogs/qa-catalog-1791949905672/causa-raiz.json. No se probaron operaciones contra los catálogos de personas reales.

## Cambios

- Tipos, formulario, catálogo de referencia y adaptador publicado usan Process como valor canónico. La edición de un requisito del proceso seleccionado también utiliza ese ámbito.
- Naturaleza representa sólo los valores del contrato existente. Tipo incluye Condition, que ya pertenece al dominio real.
- Validación previa de código/etiqueta, explicación de condición, días de vigencia y orden, con mensajes de acción en español. No se borra el formulario al fallar.
- apiProblemMessage recupera errores por campo, traduce nombres conocidos y evita exponer detalles JSON/serialización. Aplica al cliente HTTP compartido para JSON y archivos.
- humanizeOperationError traduce el título genérico y conserva las explicaciones de duplicados redactadas en español en vez de sustituirlas por un aviso ambiguo.
- Errores del formulario con role=alert. Se conservan permisos, API, servicios, constraints y persistencia; no hay migraciones ni mocks de producción.

## Trazabilidad

| Requisito | Módulo/pantalla/acción | Endpoint | Servicio/persistencia | Tablas | Permisos | Prueba |
|---|---|---|---|---|---|---|
| Crear/editar requisito | CatalogsPage en AdminPages → guardar | POST/PUT catalogs/requirements | CatalogService/EF Core, enums del dominio | requirement_definitions + process_types | catalogs.manage | Crear, editar y recuperar tras refresh |
| Mensaje específico | Formulario/Feedback → error | ValidationProblemDetails errors o detalle de negocio | ApiClient → apiProblemMessage → Feedback | Sin escritura en validación fallida | Autorización existente | Contrato inválido, condición incompleta y código duplicado |
| Consultar definición persistida | Catálogo → proceso seleccionado | GET catalogs/process-types/{id} | CatalogService/EF Core | mismas tablas | catalogs.read | Scope Process, condición e identificación después de guardar |

## Pruebas y resultado

- TypeScript aprobado.
- 17 pruebas iniciales aprobadas en cuatro archivos (problemas HTTP, contrato de catálogo, dominio publicado y feedback). Tras el ajuste de mensajes de duplicados, 11 pruebas dirigidas volvieron a pasar.
- scripts/catalog-validation-e2e.cjs aprobado contra API .NET y PostgreSQL real, con navegador en 5173: .artifacts/catalogs/qa-catalog-1791950186470/result.json. Cubre bloqueo de guardar sin datos obligatorios, condición incompleta, creación, edición, refresh, vigencia null y duplicado que conserva los datos. Sin excepciones JavaScript registradas.
- Captura mensaje-claro.png inspeccionada: explicación del código duplicado en español tanto en el modal como en la notificación. Sede/base QA eliminadas al finalizar mediante prefijo y nombre de base validados.
- Build Docker de frontend aprobado. Vercel build y promoción del despliegue dpl_6bTTgXgV71rqCCqTPxwLXqfiKfyB aprobados; PostgreSQL del adaptador publicado Healthy antes de promover.
- Recorrido final repetido sobre la imagen de producción actualizada en 5180: .artifacts/catalogs/qa-catalog-1791950496834/result.json, aprobado. Incluye creación/edición/refresh y mensaje específico del duplicado; errors=[] y badResponses=[]. Todos los servicios locales saludables y getPlatformHealth publicado Healthy.
- Las primeras ejecuciones del script de QA fallaron por una variable que ocultaba process y por selectores de prueba que no correspondían a los controles reales. Se corrigieron; las pasadas fallidas no se contabilizan como aceptación.

## Límites

No se modificó el backend: sus enums y validaciones vigentes eran la fuente correcta. El título estándar del protocolo de validación puede seguir en inglés en la respuesta HTTP; ya no se usa como explicación al usuario. El adaptador Vercel y la API .NET siguen siendo entornos distintos. Esta comprobación no acredita todos los formularios, navegadores o combinaciones de reglas del sistema.
