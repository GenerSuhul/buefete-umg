# Arquitectura de producción y alta disponibilidad

## Alcance

El entorno Docker Compose incluido es reproducible y apropiado para desarrollo,
pero una sola VPS no constituye alta disponibilidad. Producción debe separar el
tráfico, la aplicación, PostgreSQL y los documentos para evitar un único punto
de falla.

## Topología objetivo

```text
Internet
  -> proxy/balanceador HTTPS (2 instancias o servicio administrado)
     -> API ASP.NET Core (2 o más réplicas sin estado)
        -> PostgreSQL primario + réplica con failover y copias PITR
        -> almacenamiento S3 compatible replicado y versionado
        -> SMTP institucional
     -> observabilidad centralizada y alertas
```

El frontend se publica como contenido estático detrás de CDN. Las réplicas de la
API no conservan archivos ni sesiones locales: JWT, PostgreSQL y el bucket
privado permiten distribuir solicitudes entre instancias.

## Base de datos

- Usar PostgreSQL administrado o un clúster con failover probado.
- Mantener pool de conexiones acotado por réplica de API; la suma de todos los
  pools debe quedar por debajo del límite del servidor.
- Ejecutar migraciones una sola vez como etapa previa al despliegue mediante
  `dotnet run --no-launch-profile --project src/BufeteJuridico.Api -- --migrate`.
- Desplegar primero migraciones compatibles hacia atrás y luego las réplicas.
- Habilitar copias completas, WAL/PITR, cifrado y pruebas periódicas de
  restauración.
- Vigilar conexiones, bloqueos, consultas lentas, crecimiento, autovacuum y
  utilización de índices.

## Documentos

- Bucket privado, cifrado, versionado y replicación a una segunda ubicación.
- URLs de acceso temporales; nunca publicar el bucket.
- Respaldar PostgreSQL y objetos con una política coordinada, porque los
  metadatos y el binario forman una sola unidad lógica.
- Aplicar retención, antivirus y recuperación probada antes de habilitar una
  depuración irreversible.

## Aplicación y red

- Dos o más réplicas de API con health checks `/health/live` y `/health/ready`.
- Terminación TLS, límites de tamaño y frecuencia, timeouts y encabezados en el
  proxy. Solo proxies explícitos pueden aportar encabezados reenviados.
- Secretos gestionados fuera de imágenes, repositorio y archivos distribuidos.
- Despliegue gradual con rollback; no migrar automáticamente al arrancar cada
  réplica.
- Logs estructurados, métricas y trazas sin documentos, contraseñas ni DPI.

## Objetivos y pruebas obligatorias

Los RPO, RTO y el período de retención deben aprobarse con la universidad. Antes
de declarar alta disponibilidad se debe demostrar: pérdida de una réplica de
API, failover de PostgreSQL, indisponibilidad temporal del proveedor de objetos,
restauración conjunta de base y archivos, renovación de certificados y rollback
de aplicación.
