# Bufete Jurídico UMG

Aplicación interna de gestión del Bufete Popular UMG: backend ASP.NET Core,
frontend React y almacenamiento privado de documentos en MinIO/S3.

## Fuente de verdad

Antes de modificar funcionalidades debe revisarse
[`docs/requerimientos/06_CONTEXTO_REUNION.md`](docs/requerimientos/06_CONTEXTO_REUNION.md)
y los demás documentos de `docs/requerimientos/`. Los artefactos de MVP ubicados
en `docs/archive/` son históricos y no constituyen un diseño aprobado.

## Stack inicial

- ASP.NET Core 10 Web API con controladores;
- Entity Framework Core 10;
- PostgreSQL 18;
- proveedor Npgsql para EF Core;
- React 19, TypeScript y Vite para el frontend;
- sistema visual propio con Lucide y Manrope autoalojado;
- Docker Compose para aislar PostgreSQL y MinIO en desarrollo.

## Estructura

```text
src/
  BufeteJuridico.Domain/          Reglas y conceptos del negocio
  BufeteJuridico.Application/     Casos de uso y contratos
  BufeteJuridico.Infrastructure/  PostgreSQL, EF Core e integraciones
  BufeteJuridico.Api/             Controladores y composición HTTP
tests/
  BufeteJuridico.UnitTests/
  BufeteJuridico.IntegrationTests/
frontend/                           Aplicación React y repositorios mock/API
docs/                               Requerimientos, arquitectura y auditorías
scripts/                            Operación local y controles automatizados
```

Las dependencias apuntan hacia adentro:

```text
Api -> Application + Infrastructure
Infrastructure -> Application + Domain
Application -> Domain
Domain -> ninguna capa del sistema
```

## Preparación local

1. Copiar `.env.example` como `.env` y reemplazar la contraseña.
2. Levantar PostgreSQL y MinIO (bucket privado incluido):

   ```powershell
   docker compose up -d postgres minio minio-init
   ```

3. Generar la configuración local y credenciales seguras:

   ```powershell
   .\scripts\bootstrap-local.ps1
   ```

   El archivo `.env` real contiene PostgreSQL, JWT y el administrador inicial.
   Está excluido de Git y los scripts nunca imprimen sus valores.

4. Restaurar, compilar y probar:

   ```powershell
   dotnet restore BufeteJuridico.slnx
   dotnet build BufeteJuridico.slnx --no-restore
   dotnet test BufeteJuridico.slnx --no-build
   ```

5. Aplicar las migraciones y datos iniciales:

   ```powershell
   .\scripts\database-update.ps1
   ```

6. Ejecutar la API cargando `.env`:

   ```powershell
   .\scripts\run-local.ps1
   ```

   No ejecute `dotnet run` directamente: el script carga PostgreSQL, JWT,
   MinIO y el administrador desde `.env` sin imprimir sus secretos.

7. Para adquisición directa en una estación Windows, iniciar el agente WIA:

   ```powershell
   .\scripts\start-scanner-agent.ps1
   ```

8. Ejecutar una prueba de humo contra PostgreSQL y MinIO reales:

   ```powershell
   .\scripts\smoke-test.ps1
   ```

9. Ejecutar el recorrido funcional end-to-end en una base temporal aislada:

   ```powershell
   .\scripts\backend-e2e.ps1
   ```

   El script crea una base con nombre validado, ejecuta los flujos principales y
   elimina únicamente esa base temporal al finalizar.

## Endpoints de plataforma

- `GET /api/v1/system`: información mínima del servicio.
- `GET /health/live`: confirma que el proceso está vivo.
- `GET /health/ready`: confirma que PostgreSQL y MinIO están disponibles.
- `GET /openapi/v1.json`: documento OpenAPI, solo en desarrollo.

## Frontend local

El frontend local está configurado para consumir la API real. También conserva
un adaptador mock seleccionable mediante `VITE_DATA_SOURCE=mock`:

```powershell
cd frontend
npm install
npm run dev
```

Abrir `http://127.0.0.1:5173`. El modo predeterminado consume la API v1. El
adaptador mock queda reservado para pruebas explícitas con
`VITE_DATA_SOURCE=mock`.

La guía de ejecución está en [`frontend/README.md`](frontend/README.md) y las
reglas visuales en [`frontend/UI_DESIGN_SYSTEM.md`](frontend/UI_DESIGN_SYSTEM.md).

## Backend completo según requerimientos confirmados

La API v1 implementa identidad y permisos dinámicos, clientes, declaraciones
de ingresos, alumnos e inscripciones, catálogos, expedientes, asignaciones,
documentos versionados, línea de tiempo, memoriales, revisiones, presentaciones,
notificaciones, actividades, reportes, búsqueda, auditoría y vista previa de
retención. Incluye sesiones de escaneo directo con captura temporal,
previsualización obligatoria, confirmación y limpieza automática.

Documentación de continuidad:

- [`docs/arquitectura/01_MODELO_DOMINIO_BACKEND.md`](docs/arquitectura/01_MODELO_DOMINIO_BACKEND.md)
- [`docs/arquitectura/02_API_BACKEND_V1.md`](docs/arquitectura/02_API_BACKEND_V1.md)
- [`docs/arquitectura/03_BASE_DATOS_Y_OPERACION_LOCAL.md`](docs/arquitectura/03_BASE_DATOS_Y_OPERACION_LOCAL.md)
- [`docs/arquitectura/04_TRAZABILIDAD_IMPLEMENTACION.md`](docs/arquitectura/04_TRAZABILIDAD_IMPLEMENTACION.md)
- [`docs/arquitectura/05_INTEGRACION_ESCANER.md`](docs/arquitectura/05_INTEGRACION_ESCANER.md)
- [`docs/arquitectura/06_ALMACENAMIENTO_DE_OBJETOS.md`](docs/arquitectura/06_ALMACENAMIENTO_DE_OBJETOS.md)
- [`docs/arquitectura/09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md`](docs/arquitectura/09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md)

## Control de calidad

La validación reproducible de backend, esquema, dependencias y frontend se
ejecuta con:

```powershell
.\scripts\quality-gate.ps1
```

Los mismos controles se ejecutan en CI para cada cambio dirigido a `main`.

## Seguridad

- No se versionan contraseñas ni cadenas de conexión con secretos.
- PostgreSQL se publica únicamente en `127.0.0.1` durante desarrollo.
- OpenAPI no se expone automáticamente en producción.
- La baja de usuarios es lógica y conserva la autoría histórica.
- La depuración irreversible no se habilita hasta aprobar su política de
  conservación y recuperación.
