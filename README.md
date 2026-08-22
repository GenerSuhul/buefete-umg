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
React + TypeScript
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
| `frontend/` | aplicación React y contratos de consumo de API |
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
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:5103`
- OpenAPI en desarrollo: `http://127.0.0.1:5103/openapi/v1.json`
- PostgreSQL local: `127.0.0.1:55432`
- Consola MinIO: `http://127.0.0.1:59001`

Los secretos se generan localmente y nunca deben agregarse al repositorio.

## Calidad y validación

```powershell
.\scripts\quality-gate.ps1
.\scripts\smoke-test.ps1
.\scripts\backend-e2e.ps1
```

La puerta de calidad verifica formato, compilación sin advertencias, pruebas
.NET y React, modelo EF Core, dependencias vulnerables, código sin uso y build
de producción. GitHub Actions ejecuta los mismos controles en cada cambio.

## Documentación

- [Requerimientos confirmados](docs/requerimientos/01_REQUERIMIENTOS_DEL_SISTEMA.md)
- [Flujos end-to-end](docs/requerimientos/02_FLUJOS_END_TO_END.md)
- [Casos de uso](docs/requerimientos/03_CASOS_DE_USO.md)
- [Contrato API v1](docs/arquitectura/02_API_BACKEND_V1.md)
- [Base de datos y operación](docs/arquitectura/03_BASE_DATOS_Y_OPERACION_LOCAL.md)
- [Integración con escáner](docs/arquitectura/05_INTEGRACION_ESCANER.md)
- [Producción y alta disponibilidad](docs/arquitectura/09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md)
- [Auditoría técnica integral](docs/auditoria/AUDITORIA_TECNICA_INTEGRAL_2026-08-21.md)

## Estado

Base técnica auditada y validada localmente. La salida a producción requiere
aprobar políticas institucionales, infraestructura redundante, observabilidad y
pruebas de restauración conjunta de PostgreSQL y documentos.

---

**Universidad Mariano Gálvez de Guatemala — Bufete Popular UMG**
