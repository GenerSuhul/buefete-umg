<div align="center">
  <img src="frontend/public/umg.png" alt="Universidad Mariano Gálvez de Guatemala" width="112" />

  # Bufete Popular UMG

  **Plataforma interna para la gestión jurídica y académica de la Clínica Jurídica UMG**

  [![Backend](https://img.shields.io/badge/Backend-ASP.NET_Core_10-512BD4?logo=dotnet)](src/BufeteJuridico.Api)
  [![Frontend](https://img.shields.io/badge/Frontend-React_19-149ECA?logo=react)](frontend)
  [![Database](https://img.shields.io/badge/Database-PostgreSQL_18-4169E1?logo=postgresql)](compose.yaml)
  [![Storage](https://img.shields.io/badge/Storage-S3%2FMinIO-C72E49?logo=minio)](docs/arquitectura/06_ALMACENAMIENTO_DE_OBJETOS.md)
  [![CI](https://github.com/GenerSuhul/buefete-umg/actions/workflows/ci.yml/badge.svg)](https://github.com/GenerSuhul/buefete-umg/actions/workflows/ci.yml)
</div>

> [!IMPORTANT]
> Sistema de uso exclusivamente interno. Los clientes del bufete no acceden a
> la plataforma. La información jurídica y personal debe tratarse conforme a
> las políticas institucionales de acceso, conservación y confidencialidad.

## Propósito

Centralizar la recepción de clientes, expedientes judiciales, práctica de
alumnos, documentos digitalizados, actividad de secretaría, reportes y
trazabilidad. El sistema mantiene autoría e historial de las operaciones
relevantes y almacena los archivos en un bucket privado.

## Capacidades principales

- identidad, roles y permisos para administración, secretaría y alumnos;
- recepción y expediente digital de clientes;
- inscripción, papelería y asignación de múltiples casos a alumnos;
- tipos de proceso y requisitos documentales configurables;
- cronología procesal, memoriales, revisiones, presentaciones y notificaciones;
- carga, versionado, visualización y digitalización multipágina;
- búsqueda global, actividades, reportes semanales y auditoría;
- cierre, reapertura y vista previa segura de retención.

## Arquitectura

```text
Next.js (App Router) + React + TypeScript
        │ HTTPS / API v1
        ▼
ASP.NET Core 10
  ├── Application ── casos de uso y contratos
  ├── Domain ─────── reglas y entidades
  └── Infrastructure
       ├── PostgreSQL 18 / EF Core 10
       ├── MinIO o S3 compatible
       ├── SMTP
       └── agente local de escáner WIA
```

Las dependencias apuntan hacia el dominio:

```text
Api -> Application + Infrastructure
Infrastructure -> Application + Domain
Application -> Domain
Domain -> ninguna capa del sistema
```

## Estructura del repositorio

| Ruta | Responsabilidad |
|---|---|
| `src/` | API, aplicación, dominio e infraestructura |
| `frontend/` | Next.js App Router, pantallas React y contratos de consumo de API |
| `tools/` | agente local de adquisición WIA |
| `tests/` | pruebas unitarias y de integración |
| `scripts/` | preparación, migraciones, calidad y pruebas E2E |
| `docs/requerimientos/` | fuente funcional vigente |
| `docs/arquitectura/` | decisiones técnicas y operación |
| `docs/auditoria/` | evidencia de validaciones integrales |

## Preparación local

Requisitos: .NET SDK 10, Node.js, Docker Desktop y PowerShell 7.

```powershell
Copy-Item .env.example .env
.\scripts\bootstrap-local.ps1
docker compose up -d postgres minio minio-init
.\scripts\database-update.ps1
.\scripts\run-local.ps1
```

En otra terminal:

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:5103`
- OpenAPI en desarrollo: `http://127.0.0.1:5103/openapi/v1.json`
- PostgreSQL local: `127.0.0.1:55432`
- Consola MinIO: `http://127.0.0.1:59001`

El frontend usa `NEXT_PUBLIC_API_BASE_URL` y `NEXT_PUBLIC_SCANNER_AGENT_URL`.
Son direcciones públicas, no secretos, y se incorporan al construir la aplicación.
Las rutas se definen en `frontend/src/app`; las pantallas de negocio se mantienen
en `frontend/src/screens`. Para producción: `npm run build` y `npm start`.
Next.js no reemplaza los controles de autorización de la API .NET.

Los secretos se generan localmente y nunca deben agregarse al repositorio. En
`Development`, la API carga el `.env` de la raíz como configuración local de
respaldo; variables de entorno definidas explícitamente conservan prioridad.
Por ello `BufeteJuridico.Api.csproj` puede iniciarse directamente desde Visual
Studio o mediante `dotnet run --launch-profile http`. En producción no se carga
`.env`: la plataforma debe inyectar los secretos y la API falla rápidamente si
falta alguno de los valores obligatorios.

## Calidad y validación

```powershell
.\scripts\quality-gate.ps1
.\scripts\smoke-test.ps1
dotnet build BufeteJuridico.slnx --configuration Release
.\scripts\backend-e2e.ps1
```

La puerta de calidad verifica formato, compilación sin advertencias, pruebas
.NET y React, modelo EF Core, dependencias vulnerables, código sin uso y build
de producción. GitHub Actions ejecuta los mismos controles en cada cambio.

## Imágenes Docker

`Dockerfile.api` publica la API ASP.NET Core y `frontend/Dockerfile` genera el
servidor Next.js `standalone`. Ambos ejecutan con usuarios sin privilegios,
incluyen health checks y excluyen secretos del contexto de construcción.

Para comprobarlos **en local**, con `.env` creado según la sección anterior:

```powershell
docker compose -f compose.yaml -f compose.app.yaml build api web
docker compose -f compose.yaml -f compose.app.yaml up -d postgres minio minio-init api web
```

- Web en `http://127.0.0.1:5180/acceso`.
- API en `http://127.0.0.1:5104/health/ready`.
- `NEXT_PUBLIC_API_BASE_URL` y la URL del escáner se incorporan al **build** del
  frontend; para cambiar de dominio hay que reconstruir la imagen web.
- En este despliegue local, la API lee los archivos desde MinIO por la red de
  Compose y los entrega tras autorizar la petición. No publica enlaces firmados
  con nombres internos de Docker que el navegador de Windows no puede abrir.
- `compose.app.yaml` es una demostración local: usa `Development` y una sola
  instancia, y permite migraciones al arrancar. No es un manifiesto de producción
  ni equivale a alta disponibilidad. Persiste el anillo local de Data Protection
  en un volumen; en producción debe compartirse y cifrarse mediante un servicio
  administrado. En producción se aplican migraciones como
  trabajo independiente, se inyectan secretos y se utiliza proxy HTTPS.
- El agente WIA del escáner corre en Windows; no forma parte de estas imágenes.

La política de nuevas contraseñas permite entre 8 y 128 caracteres sin exigir
combinaciones de símbolos, números o mayúsculas. La decisión de admitir ocho
caracteres sin MFA es institucional y aumenta el riesgo frente a la recomendación
actual para autenticación de un solo factor; se mantienen el bloqueo por intentos,
los hashes y la revocación de sesiones existentes. No se alteran las claves ya
emitidas.

## Documentación

- [Requerimientos confirmados](docs/requerimientos/01_REQUERIMIENTOS_DEL_SISTEMA.md)
- [Flujos end-to-end](docs/requerimientos/02_FLUJOS_END_TO_END.md)
- [Casos de uso](docs/requerimientos/03_CASOS_DE_USO.md)
- [Contrato API v1](docs/arquitectura/02_API_BACKEND_V1.md)
- [Base de datos y operación](docs/arquitectura/03_BASE_DATOS_Y_OPERACION_LOCAL.md)
- [Integración con escáner](docs/arquitectura/05_INTEGRACION_ESCANER.md)
- [Producción y alta disponibilidad](docs/arquitectura/09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md)
- [Auditoría integral vigente](docs/auditoria/AUDITORIA_CODIGO_INTEGRAL_2026-09-01.md)
- [Comparación de productos y diferenciador propuesto](docs/producto/COMPARATIVA_Y_DIFERENCIADOR_2026-10-03.md)

## Estado

Base técnica auditada y validada localmente. La salida a producción requiere
aprobar políticas institucionales, infraestructura redundante, observabilidad y
pruebas de restauración conjunta de PostgreSQL y documentos.

---

**Universidad Mariano Gálvez de Guatemala — Bufete Popular UMG**
