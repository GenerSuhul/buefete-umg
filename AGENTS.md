# Protocolo de ingeniería del repositorio

Estas instrucciones aplican a todo el repositorio. El sistema debe tratarse como un producto completo, no como una colección de pantallas React, endpoints .NET o tablas aisladas.

## Criterio rector

Todo trabajo funcional debe seguir esta cadena:

`REQUISITO -> MODELO DE DOMINIO -> FLUJO FUNCIONAL -> BASE DE DATOS -> BACKEND -> CONTRATO API -> FRONTEND -> UX -> PRUEBA REAL -> REVISIÓN -> ACEPTACIÓN`

No se permite desarrollo por parche, por pantalla ni por botón. Compilar, levantar el servidor, abrir un modal o recibir HTTP 200 no significa que una funcionalidad esté terminada.

## Antes de modificar una funcionalidad

1. Leer la documentación vigente del repositorio, incluidos `README`, archivos Markdown, `docs/`, requisitos, arquitectura, modelo de datos, historias, criterios de aceptación y notas de implementación relevantes.
2. Comprender y documentar:
   - problema de negocio;
   - actor y permisos;
   - punto de inicio y resultado esperado;
   - datos requeridos, producidos y persistidos;
   - entidades y módulos afectados;
   - reglas, errores y casos borde;
   - lugar donde la información se reutiliza posteriormente;
   - siguiente paso del flujo después de completar la acción.
3. Buscar implementaciones equivalentes antes de crear componentes, endpoints, DTO, servicios, repositorios, helpers, hooks, queries, modales, selectores o catálogos.
4. Reproducir el comportamiento actual y determinar la causa raíz antes de editar.
5. Preservar la identidad visual existente salvo que exista un problema objetivo de UX.

## Matriz de trazabilidad obligatoria

Mantener durante el trabajo una matriz verificable con esta cadena:

`REQUISITO -> MÓDULO -> PANTALLA -> ACCIÓN -> ENDPOINT -> SERVICE -> REPOSITORY/PERSISTENCIA -> TABLAS -> PERMISOS -> PRUEBA`

Si un requisito no puede recorrerse de extremo a extremo, está incompleto. Cada endpoint debe tener consumidor o justificación; cada archivo, propietario lógico; cada registro, trazabilidad; cada botón, un proceso completo.

## Pasadas especializadas

Las auditorías y cambios amplios deben revisarse en pasadas separadas, usando agentes cuando estén autorizados y disponibles, o realizándolas secuencialmente:

1. Producto y requisitos.
2. Backend y contratos.
3. Base de datos, relaciones, constraints, índices y migraciones.
4. Frontend, navegación, formularios, estado y UX.
5. Ciclo documental: carga, escáner, almacenamiento, metadata, asociación, vista previa y descarga.
6. QA con escenarios reales y casos borde.
7. Arquitectura y responsabilidades entre capas.
8. Rendimiento: N+1, requests duplicados, cargas excesivas y rerenders.
9. Seguridad: autenticación, autorización, archivos, validaciones y datos sensibles.

Una sola lectura superficial no sustituye estas revisiones.

## Contrato de extremo a extremo

Comprobar siempre la cadena completa:

`DB <-> Entity <-> Repository/Persistence <-> Service <-> DTO <-> Controller <-> API Client <-> Hook/State <-> Component <-> Usuario`

Cuando cambie una propiedad o regla, revisar toda la cadena. No adaptar únicamente el frontend para ocultar un contrato incorrecto.

## Ciclos de vida completos

No se permiten islas funcionales. Por ejemplo, escanear no termina al obtener un archivo temporal. El ciclo documental debe incluir, cuando aplique:

`adquirir -> revisar páginas -> aceptar -> almacenar -> asociar a propietario y requisito -> registrar metadata e histórico -> mostrar -> previsualizar/descargar -> recuperar posteriormente`

El mismo principio aplica a clientes, alumnos, expedientes, procesos, requisitos, memoriales, notificaciones, actividades, reportes, eliminación lógica, restauración y retención.

## Formularios y UX

- Clasificar cada dato como texto, número, fecha, booleano, enum, catálogo, relación, búsqueda/autocomplete, cálculo o solo lectura.
- IDs y valores derivados no se introducen manualmente.
- Nacionalidad, estado civil, sexo, proceso, etapa y otros valores de dominio deben usar la fuente correcta; no inventar catálogos.
- La edad y demás valores calculables se derivan, no se duplican arbitrariamente.
- Creación y edición son flujos distintos. Un wizard puede servir para crear; la edición debe permitir acceso directo y razonable a las secciones.
- Botones sin proceso, pestañas vacías, datos no editables, documentos no visibles, cambios sólo locales, errores sólo en consola y selects incorrectos son defectos.
- Revisar loading, vacío, éxito, validación, error, confirmación y accesibilidad.
- Cada cambio persistente debe sobrevivir `guardar -> refrescar -> volver a abrir -> verificar`.

## Datos reales y persistencia

No usar mocks permanentes, arrays inventados, respuestas hardcodeadas, IDs estáticos, delays artificiales ni `localStorage` como sustituto de persistencia. Los mocks sólo pueden existir en pruebas claramente aisladas. Si falta una capa real del flujo, debe construirse correctamente.

## Proceso obligatorio de corrección

Para cada funcionalidad:

1. Comprender el requisito.
2. Inspeccionar la implementación existente.
3. Reproducir el comportamiento actual.
4. Identificar la causa raíz.
5. Diseñar la solución y su impacto transversal.
6. Implementar sin eliminar funcionalidad para esconder el defecto.
7. Compilar backend y frontend.
8. Ejecutar la aplicación.
9. Probar la API.
10. Probar la persistencia real en PostgreSQL y el almacenamiento real cuando aplique.
11. Probar el flujo desde el navegador como usuario real.
12. Refrescar y verificar persistencia y continuidad del flujo.
13. Revisar consola, logs y requests de red.
14. Intentar casos borde, permisos incorrectos y errores recuperables.
15. Ejecutar regresiones sobre módulos relacionados.

## Recorrido de usuario obligatorio

No basta con comprobar un `POST`. Cuando aplique, probar:

`abrir módulo -> localizar registro -> entrar al detalle -> editar -> guardar -> refrescar -> verificar persistencia -> utilizar la información en el siguiente proceso -> verificar histórico -> visualizar/descargar el documento`

Un dato guardado que no puede utilizarse posteriormente sigue siendo un flujo roto.

## Regresiones prioritarias

Revisar especialmente:

- Cliente <-> Expediente.
- Expediente <-> Proceso.
- Expediente <-> Requisitos.
- Expediente <-> Documentos.
- Expediente <-> Personas.
- Expediente <-> Alumnos.
- Expediente <-> Histórico.
- Expediente <-> Memoriales y notificaciones.

Un defecto reportado es indicador de una familia de problemas: un select incorrecto obliga a revisar selects relacionados; un datepicker roto, los demás campos de fecha; un CRUD incompleto, los CRUD del mismo dominio; un documento huérfano, el ciclo documental completo.

## Definition of Done

Una tarea sólo está terminada cuando se comprueba, según corresponda:

- [ ] requisito y criterio de aceptación comprendidos;
- [ ] trazabilidad completa entre capas;
- [ ] implementación funcional completa;
- [ ] backend compila sin errores relevantes;
- [ ] frontend compila y construye producción;
- [ ] base de datos, constraints y migraciones funcionan;
- [ ] API probada con contratos reales;
- [ ] UI probada en navegador;
- [ ] persistencia y refresh comprobados;
- [ ] errores, loading y estados vacíos comprobados;
- [ ] permisos y aislamiento de datos revisados;
- [ ] consola del navegador limpia;
- [ ] logs del backend revisados;
- [ ] requests de red revisados;
- [ ] flujo E2E real aprobado;
- [ ] casos borde y regresiones revisados.

No declarar solucionado algo que no haya sido probado. Las dependencias externas o físicas no disponibles deben reportarse expresamente como pendientes, nunca asumirse aprobadas.

## Reporte de avance

Al cerrar cada fase, informar concretamente:

- **Encontrado:** evidencia y alcance.
- **Causa raíz:** explicación técnica/funcional demostrada.
- **Cambios:** archivos, capas y contratos modificados.
- **Pruebas realizadas:** comandos y recorridos reales.
- **Resultado:** qué quedó comprobado.
- **Pendiente:** riesgos o verificaciones aún no ejecutadas.

No entregar comentarios genéricos ni optimizar para terminar rápido. El criterio de éxito es que el proceso completo del usuario funcione, persista, sea trazable y permita continuar al siguiente proceso sin romper otros módulos.
