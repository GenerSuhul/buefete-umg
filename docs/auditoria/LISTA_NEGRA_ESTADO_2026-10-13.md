# Estado efectivo de atención y lista negra

## Requisito y aceptación

Una persona bloqueada por DPI no debe mostrarse con atención vigente aunque su ficha conserve IsActive=true. Usar Lista negra en el módulo, navegación, acciones, confirmación y avisos. Administrador emite el bloqueo; secretaría consulta el estado; se conserva el historial. No se cambia la permanencia ni se emiten bloqueos a personas reales para probar.

## Encontrado y causa raíz

El perfil ya devolvía Restriction desde el registro central y bloqueaba acciones, pero el badge sólo evaluaba Client.IsActive. El listado ni siquiera recibía Restriction en ClientDto. IsActive es el estado de finalización de la atención en la sede; el bloqueo por DPI es una regla global independiente. Reescribir IsActive en una sede no reflejaría la restricción en las demás.

## Cambios

- ClientDto añade Restriction opcional; el contrato anterior permanece compatible.
- IClientRestrictionService/GetStatusesAsync consulta en lote los DPI de una página contra PostgreSQL central. Sólo devuelve estado, referencia y validez de identidad, sin motivos ni datos de otras sedes. No introduce N+1 ni migraciones.
- ClientService incorpora el estado en listado y consulta individual. El perfil conserva el contrato existente.
- clientAttention aplica prioridad: lista negra > identidad pendiente > atención vigente/finalizada. Ficha y listado consumen la misma regla.
- Menús, encabezados, modal, botones y mensajes usan Lista negra. Rutas /vetos y /client-restrictions se conservan para no romper navegación o API.
- El filtro del listado describe finalización de atención, sin llamar vigente a todas las fichas almacenadas como activas. El badge siempre presenta el estado efectivo.
- Tests de prioridad del estado, confirmación y navegación ajustados; E2E incorpora badge tras refresh y Restriction del listado.

## Trazabilidad

| Requisito | Módulo/pantalla/acción | Endpoint | Servicio/persistencia | Tablas | Permisos | Prueba |
|---|---|---|---|---|---|---|
| Estado real de ficha | ClientDetailPage → consultar/refrescar | GET clients/{id}/profile | ClientService/GetStatusAsync → TenantRegistry central | clients + client_restrictions | clients.read, alcance existente | Badge Lista negra y ausencia de Atención vigente tras refresh |
| Estado real de listado | ClientsPage → buscar DPI | GET clients | ClientService/GetStatusesAsync, consulta central por lote | clients + client_restrictions | clients.read; no exposición de motivos | restriction.isRestricted=true; listado y captura real |
| Agregar a lista negra | ClientRestrictionDialog → confirmar | POST client-restrictions | ClientRestrictionService, bloqueo transaccional y auditoría existentes | client_restrictions + audit_logs | administrador autorizado | DPI repetido, motivo, secretaría 403, duplicado 409 |
| Continuidad restringida | Casos/documentos/escaneo/atención | endpoints existentes | guards existentes de restricciones | casos/documentos y central | permisos existentes + control DPI | Alta/reactivación/asignación/escaneo bloqueados; cierre/historial permitidos |

## Pruebas realizadas y resultado

- TypeScript aprobado; backend Release compilado con 0 errores y 0 advertencias.
- Backend: 39 unitarias y 21 integración aprobadas.
- Frontend focalizado: 11 pruebas aprobadas (estado, modal y navegación). La primera pasada detectó un selector de prueba con el nombre anterior; se actualizó y la segunda pasó.
- Docker: build de producción de API/frontend aprobado; servicios renovados en 5104/5180, PostgreSQL y MinIO conservados.
- scripts/client-restrictions-e2e.cjs aprobado: .artifacts/case-flow/qa-veto-1791949248388/result.json. Pruebas reales con dos sedes temporales, API, navegador, PostgreSQL y documentos MinIO. Incluye persistencia, badge de ficha tras refresh, listado con estado correcto, permisos, aislamiento, auditoría, concurrencia y continuidad del bloqueo.
- Capturas lista-negra-listado.png y vetos.png inspeccionadas visualmente. Los fixtures se retiran al terminar; la persona de la captura del usuario no se modifica.
- Vercel: frontend construido y promovido, despliegue dpl_ALtzWzLLdwoYhyWvvcoAMoRYU5zo. La salud del adaptador publicado informó PostgreSQL Healthy antes de promover.

## Pendiente y límites

El control global central de lista negra pertenece al backend .NET nativo de la aplicación local. El adaptador independiente de Vercel sigue sin integrarlo y el módulo continúa deshabilitado allí; publicar el frontend no publica la API .NET ni traslada sus bases de datos. No se presenta el despliegue de interfaz como prueba de bloqueo global en Vercel. No se han modificado políticas de revocación, retención ni decisiones institucionales.
