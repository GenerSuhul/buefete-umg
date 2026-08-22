# Sistema de diseño — Bufete Jurídico UMG

## 1. Principio visual

La interfaz traslada la composición premium de la referencia aprobada al flujo
real de la clínica jurídica: superficie de trabajo clara, sidebar persistente y
tarjetas de radios amplios. El shell aprovecha todo el viewport para una mejor
densidad operativa y utiliza el archivo institucional `public/umg.png`.

## 2. Paleta institucional

La escala está centralizada en `src/styles/tokens.css`.

| Token | Valor | Uso |
|---|---:|---|
| `--umg-900` | `#01274F` | fondos institucionales y énfasis máximo |
| `--umg-700` | `#194775` | acciones, gráficas e iconos |
| `--umg-200` | `#CFE2FF` | fondos informativos y datos secundarios |
| `--umg-50` | `#F1F6FC` | estados suaves y selección |
| `--surface-page` | `#DEDEE3` | lienzo exterior |
| `--surface-app` | `#F3F4F4` | superficie de la aplicación |
| `--surface-card` | `#FFFFFF` | tarjetas y navegación |

Los estados funcionales usan verde, ámbar y rojo solo para semántica de éxito,
pendiente o riesgo; nunca compiten con el azul institucional.

## 3. Tipografía

- Familia: Manrope, con respaldo en Inter, Segoe UI y system-ui.
- Títulos de página: peso 500, espaciado negativo, 29–45 px.
- Títulos de tarjeta: 15 px, peso 700.
- Texto operativo: 9–13 px según densidad.
- Etiquetas de sección: mayúsculas, 10 px y tracking amplio.

## 4. Forma, espacio y elevación

- radios: 12, 18, 24 y 30 px;
- cápsulas: `border-radius: 999px`;
- espacio base: 4 px, con separaciones principales de 14, 18, 22 y 24 px;
- sombras muy suaves en tarjetas; sombras profundas solo en modales;
- controles principales de al menos 44 px de altura.

## 5. Componentes

- `AppShell`: sidebar jerárquica, barra contextual y búsqueda global;
- `PageHeader`: contexto, título, descripción y acciones;
- `Card` / `SectionHeading`: estructura modular de contenido;
- `Badge`: estado con color y punto semántico;
- `Button` / `IconButton`: jerarquía primaria, secundaria, fantasma y riesgo;
- `Modal` / `Field`: formularios y tareas concentradas;
- `DetailTabs`: navegación local de perfiles y expedientes;
- `LoadingState`, `ErrorState`, `EmptyState`: estados de la interfaz.

Los iconos provienen de Lucide y mantienen trazo profesional consistente. Las
gráficas son SVG/CSS accesibles y usan únicamente la escala institucional.

## 6. Arquitectura de navegación

- existe una sola navegación primaria: la sidebar;
- la barra superior contiene orientación, búsqueda, notificaciones y perfil;
- los módulos se agrupan por el modelo mental del trabajo: gestión jurídica,
  práctica académica, operación interna y administración;
- la jerarquía usa un solo nivel desplegable y etiquetas visibles;
- las opciones administrativas se muestran únicamente a roles autorizados;
- en tableta y móvil la misma sidebar se convierte en drawer temporal, sin
  duplicar destinos.

## 7. Adaptabilidad

- escritorio: dashboard de tres columnas y sidebar permanente;
- tableta: dashboard de dos columnas y drawer bajo menú;
- móvil: una columna, barra superior compacta, tablas convertidas a filas y
  acciones fluidas.

Los puntos de quiebre principales son 1180, 1000/900, 760/720 y 560 px.

## 8. Datos y backend

`src/data/dataSource.ts` define un contrato único. `VITE_DATA_SOURCE=mock`
utiliza el repositorio local; `api` consume `/api/v1`. Así, una pantalla no sabe
si su información proviene del mock o de ASP.NET Core.

La carga de documentos usa `multipart/form-data`. La experiencia de escáner
representa las tres fases del backend: crear sesión, recibir y previsualizar la
captura, y confirmar el documento.

## 9. Accesibilidad

- foco visible en controles interactivos;
- navegación semántica y etiquetas ARIA en botones de icono;
- contraste alto en textos y acciones;
- modales con `role=dialog` y cierre por fondo/Escape;
- estados expresados con texto además del color;
- diseño compatible con teclado y superficies táctiles.
