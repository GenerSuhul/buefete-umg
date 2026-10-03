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

El frontend Next.js actual se ejecuta como servicio Node.js `standalone` detrás
de proxy HTTPS; sus recursos estáticos pueden servirse desde CDN. Si se despliegan
varias réplicas de Next.js, deben utilizar el mismo build y coordinar cualquier
caché/revalidación compartida antes de prometer consistencia. Las réplicas de la
API no conservan archivos ni sesiones locales: JWT, PostgreSQL y el bucket
privado permiten distribuir solicitudes entre instancias.

## Base de datos

- Usar PostgreSQL administrado o un clúster con failover probado.
- Mantener pool de conexiones acotado por réplica de API; la suma de todos los
  pools debe quedar por debajo del límite del servidor.
- La configuración inicial limita cada réplica a 30 conexiones y mantiene dos
  conexiones calientes. Antes de escalar, calcular el límite como
  `réplicas × pool máximo + margen operativo < max_connections`; no copiar el
  valor local sin contrastarlo con el servicio PostgreSQL definitivo.
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
- Configurar `AllowedHosts` con los dominios públicos exactos y
  `ReverseProxy__KnownProxies` con las direcciones del balanceador. La API
  rechaza el arranque productivo con comodín, proxy indefinido o almacenamiento
  local para evitar una degradación silenciosa de seguridad y disponibilidad.
- Secretos gestionados fuera de imágenes, repositorio y archivos distribuidos.
- Compartir el anillo de claves de ASP.NET Core Data Protection entre réplicas,
  persistirlo fuera del contenedor y cifrarlo en reposo. El volumen de
  `compose.app.yaml` sólo conserva claves para la demostración local; no es un
  almacén de claves productivo.
- Despliegue gradual con rollback; no migrar automáticamente al arrancar cada
  réplica.
- Logs estructurados, métricas y trazas sin documentos, contraseñas ni DPI.

## Objetivos y pruebas obligatorias

Los RPO, RTO y el período de retención deben aprobarse con la universidad. Antes
de declarar alta disponibilidad se debe demostrar: pérdida de una réplica de
API, failover de PostgreSQL, indisponibilidad temporal del proveedor de objetos,
restauración conjunta de base y archivos, renovación de certificados y rollback
de aplicación.
