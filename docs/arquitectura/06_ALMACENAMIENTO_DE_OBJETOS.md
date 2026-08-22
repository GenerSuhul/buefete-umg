# Almacenamiento de objetos

## Decisión vigente

El sistema usa un contrato de almacenamiento **S3-compatible e independiente del proveedor**. La selección concreta es:

- **Desarrollo local:** MinIO de un nodo en Docker, únicamente como emulador privado de S3.
- **Producción recomendada:** almacenamiento de objetos administrado S3-compatible, con redundancia, copias y SLA provistos por el proveedor.
- **Producción autogestionada:** MinIO distribuido solamente si existen al menos cuatro hosts homogéneos, operación 24/7, monitoreo y pruebas de recuperación. El contenedor local de un nodo no ofrece alta disponibilidad.
- **Proveedor `Local`:** sólo para pruebas aisladas; nunca es la configuración de producción.

Esta decisión permite cambiar AWS S3, un servicio compatible o MinIO distribuido sin modificar el dominio ni las filas de PostgreSQL.

## Modelo de datos y acceso

PostgreSQL conserva metadatos y una clave neutral, por ejemplo `2026/08/identificador.pdf`. El bucket privado conserva el binario. Para cada documento se registra:

- nombre original y etiqueta;
- MIME, tamaño y SHA-256;
- contexto (cliente, alumno o expediente);
- versión, origen y auditoría;
- clave del objeto, nunca una URL permanente.

El bucket nunca es público. Antes de mostrar una imagen o PDF, la API autoriza el documento y entrega una URL firmada de lectura con expiración corta mediante `GET /api/v1/documents/{id}/access`. El navegador presenta directamente esa URL; así se evita retransmitir archivos grandes por la API y se conservan autorización, velocidad y escalabilidad. `GET /content` continúa disponible como descarga compatible.

## Desarrollo local

```env
Storage__Provider=S3
Storage__S3__ServiceUrl=http://127.0.0.1:59000
Storage__S3__BucketName=bufete-documentos
Storage__S3__ForcePathStyle=true
Storage__S3__KeyPrefix=bufete
Storage__MaxFileSizeBytes=26214400
Storage__DownloadUrlMinutes=2
```

`docker compose up -d postgres minio minio-init` levanta PostgreSQL, MinIO y crea el bucket privado. La consola local está en `http://127.0.0.1:59001`; el API S3 está en `http://127.0.0.1:59000`. Las credenciales sólo viven en `.env`.

Las cargas siguen pasando por la API porque ésta valida firma binaria, MIME, tamaño, contexto y SHA-256 antes de registrar el documento. En una etapa de volumen alto puede incorporarse carga multipart directa con una sesión prefirmada de confirmación, sin omitir esas validaciones.

## Producción

Variables mínimas:

```env
Storage__Provider=S3
Storage__S3__BucketName=BUCKET_PRIVADO
Storage__S3__Region=REGION_DEL_PROVEEDOR
Storage__S3__KeyPrefix=bufete
Storage__DownloadUrlMinutes=2
```

Para AWS S3, `ServiceUrl` queda vacío. Para otro proveedor se configura su endpoint HTTPS. Si existe identidad de instancia o workload identity se usa en lugar de secretos estáticos.

Controles obligatorios:

- TLS, cifrado en reposo y bloqueo de acceso público;
- identidad de mínimo privilegio limitada al bucket/prefijo;
- versionado y política de retención conforme la aprobación institucional;
- respaldos coherentes de PostgreSQL y objetos, con restauración ensayada;
- alertas de capacidad, errores y latencia;
- lifecycle sólo para temporales identificados, nunca para expedientes activos;
- URLs firmadas y credenciales excluidas de logs.

La alta disponibilidad completa requiere además múltiples instancias stateless de la API, PostgreSQL administrado o replicado, balanceador y monitoreo. Un bucket por sí solo no vuelve altamente disponible a todo el sistema.

## Migración local a producción

1. Crear el bucket privado definitivo y sus controles.
2. Detener temporalmente nuevas cargas.
3. Replicar objetos conservando las claves bajo `bufete/`.
4. Comparar cantidad, tamaño y SHA-256 con `documents`.
5. cambiar únicamente la configuración del proveedor.
6. verificar readiness, imagen, PDF, escaneo, reemplazo y fotografía de usuario.
7. conservar la copia origen hasta completar una restauración validada.
