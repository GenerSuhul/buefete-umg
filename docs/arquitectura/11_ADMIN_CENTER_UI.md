# Admin Center: ajuste visual acotado

## Alcance y aceptación

Se conserva la paleta institucional, las rutas, las acciones, su orden y su
ubicación funcional. No se modifican APIs, autenticación, reglas de negocio ni
persistencia. El ajuste se activa únicamente para el superusuario de la plataforma
nativa; no reemplaza el diseño de las sedes ni el de la demo publicada.

El texto de referencia describe un ERP genérico. Suscripciones, CPU/RAM, respaldos,
rollback e instancias ERP no son módulos existentes de este producto. No se crean
pantallas sin contratos ni métricas inventadas. Tampoco se trasladan las acciones
a menús contextuales ni se mueve el formulario de creación: prevalece la petición
expresa de conservar posiciones y colores.

## Evidencia y causa

Las capturas iniciales están en `.artifacts/admin-center/before`. El CSS compartido
definía títulos de hasta 45 px, topbar de 78 px, radios de tarjeta de 24 px y campos
con alineación elástica. El Admin Center heredaba densidad de pantallas operativas
en lugar de una escala administrativa. El KPI estrecho podía recortar su badge.

## Trazabilidad

| Requisito | Módulo / pantalla | Acción / contrato preservado | Persistencia / permisos | Prueba |
| --- | --- | --- | --- | --- |
| Densidad y jerarquía | AppShell, resumen, usuarios, clientes, sedes | Navegación y formularios existentes | Sin cambios; clase visual condicionada a `isPlatformAdmin` | Comparación de capturas y medidas en cuatro viewports |
| Posición y paleta | Sedes | Crear, guardar nombre, suspender, entrar; `/api/v1/platform/tenants` | `TenantRegistry`, registro central y PostgreSQL independiente por sede; sólo superusuario | E2E nativo y orden DOM de acciones |
| Sin regresión funcional | Sede y personal | Crear sede → entrar → crear secretaria → refrescar | Base propia, permisos de administrador local, aislamiento de sedes | `scripts/native-tenancy-ui-e2e.cjs` |
| Accesibilidad | Navegación y controles del Admin Center | Teclado y foco existentes, motion reducido | No aplica | Foco visible y comprobación `prefers-reduced-motion` |

## Cambios

- `frontend/src/styles/admin-center.css`: tokens no cromáticos, Segoe UI/system,
  títulos 28 px, secciones 18 px, cuerpo 14 px, metadatos 12–13 px; alturas,
  espaciado, radios, campos sin estiramiento y KPI sin badge recortado.
- `frontend/src/components/layout/AppShell.tsx`: clase de alcance visual únicamente
  para el superusuario nativo, iconos Fluent Regular de 20 px, sidebar de 260 px
  y modo colapsado de 68 px con nombres accesibles y tooltips. Se conservan el
  orden de enlaces, el logo institucional y las comprobaciones de permisos.
- `frontend/src/app/layout.tsx`: importación del CSS después del sistema existente.
- `scripts/admin-center-visual-check.cjs`: login real sin imprimir secretos,
  capturas y aserciones de overflow, tamaños, paleta, orden de acciones,
  colapso/expansión por teclado y movimiento reducido.
- `frontend/package.json` y lockfile: `@fluentui/react-icons`, con importaciones
  atómicas para evitar cargar el catálogo completo de iconos.

## Referencias de diseño

Se toman criterios de jerarquía, densidad y accesibilidad, no marcas ni paleta:
[Fluent 2 Typography](https://fluent2.microsoft.design/typography),
[Layout](https://fluent2.microsoft.design/layout) y
[Accessibility](https://fluent2.microsoft.design/accessibility).
Los iconos siguen la [documentación oficial de Fluent System Icons](https://github.com/microsoft/fluentui-system-icons/blob/main/packages/react-icons/README.md).

## Verificación

- `npm run typecheck`: aprobado después de completar la instalación de Fluent.
- `npm run check:unused`: aprobado.
- `npm test`: 16 archivos, 71 pruebas aprobadas con la nueva dependencia.
- `git diff --check`: sin errores de whitespace; advertencia preexistente de CRLF
  en el snapshot de migraciones ajeno a este ajuste.
- Primer build Docker interrumpido por `ECONNRESET` en la descarga npm; el
  reintento descargó correctamente las dependencias. No se modificó el Dockerfile
  ni se sustituyó el contenedor activo durante el fallo de descarga.
- El reintento completó compilación, TypeScript, generación de las 18 páginas y
  optimización de Next.js. La construcción se detuvo al copiar el runtime: C:
  llegó a cero bytes libres y Docker comenzó a responder HTTP 500.
- Se restauró el script de validación, cuya escritura había sido interrumpida
  por falta de espacio, y se retiró exclusivamente la copia temporal de 30 MB
  del tarball público de Fluent creada para esta tarea. No se borraron imágenes,
  volúmenes, bases ni archivos de negocio. La construcción propia se detuvo para
  evitar más escrituras. Quedaron aproximadamente 285 MB libres, insuficientes
  para continuar con seguridad.
- **Pendiente / no aprobado:** exportación de imagen, actualización del contenedor,
  comparación visual posterior, colapso por teclado y E2E nativo sobre esta nueva
  versión. Sólo existen las 16 capturas iniciales y sus mediciones; no deben
  presentarse como capturas del resultado.
- Docker sigue respondiendo HTTP 500 y `/acceso` en el puerto 5180 agotó el timeout
  de 10 segundos. No se reinició Docker ni se hicieron limpiezas globales. Se
  requiere liberar espacio del host antes de recuperar servicios y cerrar QA.

### Reanudación — 12 de octubre de 2026

Se comprobaron aproximadamente 16 GB libres en C:. Docker todavía respondía
HTTP 500. El reinicio normal expiró; la detención forzada de Docker Desktop y
el reinicio limitado de la distribución `docker-desktop` no eliminaron el bloqueo.
Los logs previos del kernel registraban el dispositivo `sdd` fuera de servicio
tras los errores de escritura de la falta de espacio.

Un nuevo arranque mostró además un endpoint AF_UNIX inaccesible:
`Docker/run/dockerInference`. Con Docker detenido se inspeccionó `Docker/run`:
contenía únicamente dos sockets de cero bytes, sin bases ni documentos. Se
renombró de forma recuperable como `run.stale-20261012-073656`; Docker regeneró
el endpoint de inferencia sin ese error. No se borraron imágenes ni volúmenes.

WSL todavía no consigue arrancar la distribución de Docker; incluso `uname -a`
en esa distribución queda esperando. Las distribuciones `Ubuntu` y
`Ubuntu-22.04` permanecen activas, por lo que se solicitó autorización explícita
para reiniciar WSL completo antes de interrumpirlas. La exportación de imagen,
actualización y QA visual final siguen pendientes; no se declara aceptación
de la nueva interfaz en ejecución.

### Recuperación autorizada — 12 de octubre de 2026

Con autorización explícita del usuario se detuvo Docker Desktop, se ejecutó
`wsl --shutdown` y se inició de nuevo Docker Desktop. El motor 28.3.2 volvió a
responder y los cuatro contenedores existentes arrancaron con sus mismos
volúmenes. No se ejecutaron factory reset, unregister, prune ni borrado de datos.
PostgreSQL completó la recuperación WAL y aceptó conexiones; MinIO quedó listo.
`/health/ready` confirmó PostgreSQL y almacenamiento `Healthy`.

Se generó el respaldo lógico `.data/bufete-recovery-20261012.dump` (908.019 bytes)
y se comprobó su catálogo con `pg_restore --list` (204 entradas). No se afirma
una restauración ensayada de ese respaldo. `pg_amcheck` no pudo verificar
relaciones porque la extensión `amcheck` no está instalada; no se modificó el
esquema para ese diagnóstico. La comprobación de recuperación no equivale a una
certificación completa de integridad física o de alta disponibilidad.

La lectura autenticada de los 35 documentos actuales de Petén desde la API
comprobó HTTP satisfactorio, tamaño y SHA-256 contra su metadata; cero fallos.
Evidencia: `.artifacts/admin-center/recovery-storage.json`. No se alteraron los
documentos. Esta comprobación no incluye versiones históricas no listadas ni
documentos de otras sedes.

La primera exportación de imagen finalizó correctamente. El recorrido nativo
de navegador volvió a aprobar creación de sede/administrador, edición y refresh,
cambio de contexto, creación de secretaría y persistencia, y rechazo del módulo
global al administrador local. Evidencia:
`.artifacts/tenancy-ui/qa-ui-1791815246080/result.json`. Se retiró únicamente la
sede/base desechable creada por esa prueba.

La inspección de capturas detectó recorte del contador de actividades a 1366 px:
la fila heredada tenía altura fija de 100 px. Se cambió exclusivamente la fila
del Admin Center a `minmax(100px, auto)`, manteniendo orden, paleta y acciones.
El script añade una aserción de contenido KPI dentro de su tarjeta y espera los
datos de sedes antes de capturar la navegación colapsada. También se corrigió
el propio test de movimiento reducido para volver a `/sedes` antes de evaluar
su botón; el timeout previo correspondía a un selector en otra pantalla.

### Aceptación de esta fase

- Build de producción final y exportación Docker aprobados: imagen web
  `sha256:e62272193681e8f1d2b4ea0f64d807cff33ca4f6e0789111fe1d4a295bb929f8`.
  Sólo se recreó el contenedor web; API, PostgreSQL y MinIO conservaron sus
  contenedores/volúmenes existentes.
- `scripts/admin-center-visual-check.cjs ... after`: 16 combinaciones de pantalla
  y viewport aprobadas (1920, 1440, 1366 y 1024 px), sin errores de consola ni
  excepciones JavaScript. Comprueba fuente, títulos, topbar, campos, iconos de
  20 px, sidebar de 260/68 px, foco/colapso por teclado, movimiento reducido,
  ausencia de desbordamiento horizontal, contenido KPI visible, paleta y orden
  de acciones. Evidencia: `.artifacts/admin-center/after/results.json` y PNG.
- Se inspeccionaron visualmente capturas de sedes en escritorio/tablet, sidebar
  colapsado y dashboard a 1366 px; el contador ya no queda recortado.
- E2E nativo repetido sobre la última imagen: aprobado, sin errores de consola.
  Evidencia: `.artifacts/tenancy-ui/qa-ui-1791815674298/result.json`.
- Cuatro contenedores `healthy`; `/health/ready` volvió a confirmar dependencias
  saludables. Logs web/MinIO finales sin nuevos errores. En los logs de API
  durante navegación automatizada constan solicitudes canceladas en autenticación
  y health checks; no se presentan esos logs como totalmente libres de errores.
  Las comprobaciones posteriores y las descargas completas finalizaron bien.
- `git diff --check`: sin errores; persiste la advertencia previa de CRLF del
  snapshot de migraciones. Quedaron aproximadamente 19 GB libres en C:.

Resultado: recuperación local y ajuste acotado del Admin Center comprobados.
Acceso: `http://127.0.0.1:5180/acceso`. No se publicó la demo Vercel ni se realizó
push a GitHub en esta fase. Permanecen fuera de aceptación: alta disponibilidad
productiva, integridad física completa, restauración ensayada del nuevo respaldo
y operación con escáner físico.
