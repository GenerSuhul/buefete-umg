# Comparación de productos y diferenciador del Bufete Popular UMG

Consulta de fuentes oficiales: 3 de octubre de 2026. Las capacidades externas
son descripciones de sus proveedores, no una evaluación independiente.

| Producto | Enfoque publicado | Aprendizaje aplicable |
|---|---|---|
| [Clio Manage](https://www.clio.com/features/case-management/) | Expedientes, documentos, calendarios, actividad y datos del cliente en un mismo asunto. | Evitar pantallas aisladas: cada dato debe poder reutilizarse en el expediente. |
| [LegalServer](https://www.legalserver.org/civil-legal-aid/) | Asistencia legal, intake configurable, carga de casos, resultados y auditoría. | Medir continuidad y resultados de la atención, no sólo volumen de registros. |
| [Lawcus](https://lawcus.com/) | Flujos repetibles, tareas, portal y seguimiento de asuntos. | Hacer explícito el siguiente paso y el responsable de cada acción. |

## Diferenciador de producto

Un **semáforo de preparación del expediente** une la operación jurídica con la
práctica supervisada: usando el expediente ya persistido, muestra faltantes
documentales, responsable académico, existencia de seguimiento y acción operativa
recomendable. El objetivo es impedir que un caso parezca «listo» sólo por haber
sido creado. No decide admisibilidad legal ni sustituye la revisión humana.

### Contrato funcional propuesto

`Caso existente -> requisitos y documentos -> asignaciones activas -> último
paso -> resumen de bloqueos -> navegación a la acción permitida`.

- El cálculo debe basarse en datos reales del perfil del caso, sin duplicar estado
  en otra tabla ni inventar requisitos.
- Un requisito condicional `No aplica` cuenta como satisfecho; uno obligatorio
  sin archivo nunca se marca satisfecho por una etiqueta local.
- Sólo una asignación **activa** puede cubrir la responsabilidad principal.
- Los casos cerrados/archivados se presentan como no operativos, no como
  pendientes de nuevas cargas.
- El semáforo es informativo y no bloquea acciones adicionales por sí solo;
  la API conserva la autoridad sobre reglas y permisos.
- Cualquier vínculo de acción respeta `cases.write`, `cases.assign` o
  `documents.write` según corresponda.

### Criterio de aceptación

Para un caso con documentos faltantes y sin responsable, el usuario ve ambos
bloqueos; tras cargar/aceptar la evidencia y asignar un alumno autorizado,
`guardar -> refrescar -> abrir de nuevo` muestra el estado actualizado. El
histórico y las decisiones de revisión siguen en los módulos existentes.

## Prioridades posteriores, no incluidas en esta fase

Calendario de vencimientos verificables, carga de trabajo supervisada y métricas
de resultado/impacto del servicio. Requieren definiciones institucionales sobre
plazos, supervisores y resultados antes de automatizar decisiones.
