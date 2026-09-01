# Auditoría integral de código, datos y operación — 1 de septiembre de 2026

## Dictamen

**APTO PARA INTEGRACIÓN, CON PUERTAS OPERATIVAS PREVIAS A PRODUCCIÓN.**

El árbol actual mantiene separación por capas, contratos versionados, pruebas
reproducibles, migraciones consistentes y persistencia real en PostgreSQL y
MinIO. No se declara alta disponibilidad sólo por superar el build: el entorno
local continúa siendo de un nodo y las pruebas de failover, restauración,
capacidad y proveedores institucionales deben ejecutarse en la plataforma de
producción.

## Alcance comprobado

- React 19, TypeScript estricto, estado de sesión, consumo de API, formularios,
  navegación, feedback y build segmentado;
- ASP.NET Core 10, autorización, errores, concurrencia, auditoría, límites,
  almacenamiento y health checks;
- PostgreSQL 18, modelo EF Core, migraciones, constraints, índices y pool de
  conexiones;
- MinIO/S3, documentos y digitalización multipágina;
- configuración, CI, dependencias, secretos, archivos ignorados y repositorio.

## Hallazgos corregidos en este corte

### Sesión de navegador corrupta

- **Encontrado:** `JSON.parse` se ejecutaba directamente desde el contexto de
  autenticación y el cliente HTTP. Un valor incompleto o corrupto podía impedir
  que la aplicación iniciara.
- **Causa raíz:** lectura duplicada sin validar el contrato ni contemplar que el
  almacenamiento del navegador puede estar bloqueado.
- **Cambio:** `authSession.ts` centraliza validación, limpieza, actualización y
  respaldo en memoria. Tres pruebas cubren corrupción, contrato incompleto y
  actualización del perfil sin perder tokens.

### Colisiones de integridad convertidas en HTTP 500

- **Encontrado:** una carrera entre validación e inserción podía producir una
  violación PostgreSQL de clase `23` y caer en el error interno genérico.
- **Causa raíz:** el manejador distinguía concurrencia optimista, pero no
  constraints de integridad del proveedor.
- **Cambio:** las violaciones de integridad se convierten en `409 Conflict` sin
  exponer nombres de tablas, índices ni constraints. Existe prueba del contrato.

### Caché de información sensible

- **Encontrado:** las respuestas `/api` no declaraban una política explícita de
  caché.
- **Cambio:** todas las respuestas API incorporan `Cache-Control: no-store`,
  `Pragma: no-cache` y `X-Permitted-Cross-Domain-Policies: none`. La prueba de
  integración verifica las cabeceras.

### Producción degradable por configuración insegura

- **Encontrado:** los defaults permiten desarrollo local, pero podían llegar a
  producción con `AllowedHosts=*`, sin proxy conocido o con archivos locales.
- **Cambio:** el arranque productivo falla de forma temprana si no existen hosts
  explícitos, proxy autorizado y almacenamiento S3 compatible. El comando
  exclusivo de migración permanece independiente de la configuración HTTP.

### Pool de conexiones sin margen para varias réplicas

- **Encontrado:** el ejemplo asignaba 50 conexiones por instancia; dos réplicas
  podían agotar las 100 conexiones del PostgreSQL local.
- **Cambio:** el valor inicial es 30 por réplica, mínimo 2, poda y keepalive. La
  documentación obliga a calcular el pool con el límite real del clúster.

### Recorrido E2E incompatible con la validación de CUI

- **Encontrado:** el sistema validaba correctamente 13 dígitos, pero el guion
  E2E seguía enviando identificadores alfanuméricos.
- **Cambio:** el recorrido genera CUI numéricos únicos y vuelve a cubrir éxito,
  rollback transaccional y aislamiento.

### Higiene del repositorio

- **Encontrado:** estados locales de NuGet, Azure CLI, Docker, .NET y espacios
  temporales aparecían como archivos no rastreados.
- **Cambio:** se excluyen explícitamente sin eliminar los datos locales. El
  perfil de ejecución del agente de escáner utiliza el puerto contractual
  `127.0.0.1:17654` y no abre una ventana del navegador.

## Evidencia ejecutada

```text
quality-gate.ps1
  Docker Compose válido
  formato .NET válido
  build .NET: 0 advertencias, 0 errores
  pruebas .NET previas al endurecimiento: 15 unitarias + 17 integración
  modelo EF: sin cambios pendientes
  NuGet: 0 vulnerabilidades conocidas
  npm audit: 0 vulnerabilidades conocidas
  TypeScript y knip: correctos
  React: 39/39 antes de las 3 regresiones nuevas
  build Vite: 2928 módulos, correcto

validación posterior a las correcciones
  integración .NET: 21/21
  sesión frontend: 3/3
  backend-e2e.ps1: todos los módulos OK
  health/live: 200
  health/ready: 200 con PostgreSQL y almacenamiento
```

PostgreSQL local comprobado:

- 31 tablas de negocio y 11 migraciones aplicadas;
- 0 índices inválidos;
- 0 constraints sin validar;
- 0 claves foráneas sin índice de soporte;
- 9 conexiones de 100 durante la medición;
- base y almacenamiento saludables.

El E2E creó una base aislada, aplicó migraciones, ejecutó cliente, declaración,
alumno, inscripción, autenticación, aislamiento, escaneo multipágina, MinIO,
expediente, asignación, documentos, memoriales, presentación, notificación,
actividades, reportes, búsqueda, auditoría, retención, tokens, borrado lógico y
restauración; finalmente eliminó la base temporal.

## Puertas obligatorias antes de producción

1. Ejecutar aceptación autenticada en navegador para administrador, secretaría
   y alumno con cuentas de prueba autorizadas.
2. Migrar el refresh token a cookie `HttpOnly`, `Secure` y `SameSite` junto con
   una estrategia CSRF antes de exponer el sistema fuera de la red controlada.
3. Implementar rate limiting compartido en proxy/gateway; el limitador de la API
   es por instancia.
4. Probar SMTP institucional y el escáner físico objetivo.
5. Ejecutar carga concurrente, failover de API/PostgreSQL, pérdida temporal de
   S3 y rollback de aplicación.
6. Automatizar backup PostgreSQL/objetos y demostrar restauración conjunta con
   RPO y RTO aprobados.
7. Desplegar dos o más réplicas de API, PostgreSQL administrado o replicado,
   bucket versionado/replicado, TLS y observabilidad centralizada.

Estas puertas no se resuelven con más código local ni deben marcarse como
aprobadas sin evidencia del entorno definitivo.
