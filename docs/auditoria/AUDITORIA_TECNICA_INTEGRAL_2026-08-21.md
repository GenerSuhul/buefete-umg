# Auditoría técnica integral — 21 de agosto de 2026

## Resultado ejecutivo

Se revisaron frontend, API, capas de aplicación/dominio/infraestructura,
PostgreSQL, almacenamiento de objetos, automatización y estructura del
repositorio. Las correcciones de bajo riesgo quedaron incorporadas y se
validaron mediante compilación, pruebas y análisis estático.

La solución queda preparada como una base corporativa reproducible, pero no se
declara todavía altamente disponible: esa condición requiere infraestructura
redundante y ensayos operativos descritos en
`docs/arquitectura/09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md`.

## Correcciones incorporadas

### Frontend

- Carga diferida por ruta y separación del adaptador mock del bundle API.
- Límite de errores visual para evitar pantallas en blanco.
- TypeScript estricto respecto de símbolos y parámetros sin uso.
- Detección automatizada de archivos y exportaciones huérfanas con Knip.
- Pruebas estables en Windows y un único comando `npm run check`.
- Eliminación de componentes, imports y utilidades realmente no utilizados.

### Backend

- Versiones NuGet centralizadas y restauración bloqueable mediante lock files.
- Validación temprana de JWT, almacenamiento, escáner y SMTP.
- Compresión HTTP, encabezados defensivos y rate limit por dirección IP para
  autenticación.
- Confianza de proxy limitada a direcciones configuradas explícitamente.
- Migraciones y siembra separadas del arranque normal mediante `--migrate`.
- Pruebas de integración para encabezados y límite de autenticación.

### PostgreSQL y documentos

- Confirmación de que toda clave foránea posee un índice utilizable.
- Índices compuestos para auditoría por usuario/fecha y retención por
  estado/fecha, aplicados mediante migración EF Core.
- Pool de conexiones acotado y timeouts explícitos en la configuración local.
- MinIO privado y persistente; los binarios permanecen fuera de PostgreSQL.

### Operación y organización

- Docker Compose validable, puertos enlazados solo a `127.0.0.1`, health checks,
  límites de logs y períodos de apagado limpio.
- Scripts comunes para cargar configuración sin imprimir secretos.
- Control integral `scripts/quality-gate.ps1` y CI con auditoría de dependencias.
- Dependabot para NuGet, npm y GitHub Actions.
- Artefactos retirados del MVP movidos a `docs/archive/` y fuentes vigentes
  consolidadas bajo `docs/requerimientos/`.

## Evidencia de validación

- Compilación .NET con advertencias tratadas como errores.
- 24 pruebas automatizadas .NET (13 unitarias y 11 de integración) y 17 pruebas
  React.
- Modelo EF Core sin cambios pendientes y migraciones aplicadas localmente.
- Auditorías NuGet y npm sin vulnerabilidades conocidas al momento de ejecutar.
- Typecheck, detección de código sin uso, pruebas y build de producción React.
- Validación de Docker Compose y salud de PostgreSQL/MinIO.
- Recorrido backend E2E completo sobre una base temporal: identidad, clientes,
  alumnos, documentos, escaneo, expedientes, memoriales, juzgado, reportes,
  auditoría, retención y tokens.

Durante el recorrido E2E se detectó y corrigió la recepción de fechas con zona
horaria de Guatemala: la API ahora normaliza `DateTimeOffset` a UTC antes de
persistirlo en PostgreSQL y cuenta con una prueba de regresión.

## Riesgos residuales y controles siguientes

1. La cobertura automatizada todavía no recorre todas las ramas de negocio. Los
   flujos E2E existentes reducen el riesgo, pero cada cambio funcional debe
   ampliar pruebas antes de refactorizar servicios o pantallas extensas.
2. Algunos módulos frontend y servicios de aplicación son grandes. Se recomienda
   extraerlos por caso de uso de forma incremental; dividirlos masivamente sin
   cobertura adicional elevaría el riesgo de regresión.
3. El entorno local es de una sola instancia. Réplicas, failover, PITR,
   replicación de objetos y observabilidad deben implementarse en producción.
4. Deben aprobarse RPO, RTO, retención, depuración y manejo de datos personales
   antes de la salida institucional.
5. Se requiere una prueba de restauración conjunta de PostgreSQL y documentos;
   una copia no verificada no es una garantía de recuperación.

## Regla de mantenimiento

Todo cambio debe conservar la trazabilidad hacia `docs/requerimientos/`, incluir
su prueba proporcional al riesgo y superar `scripts/quality-gate.ps1`. Los
archivos generados (`bin`, `obj`, `dist`, cobertura y artefactos temporales) no
se versionan.
