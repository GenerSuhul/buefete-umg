# Frontend — Bufete Jurídico UMG

Aplicación React + TypeScript construida sobre los requerimientos, flujos E2E y
contratos de la API v1. El modo normal consume el backend; el adaptador mock se
carga únicamente cuando una prueba lo solicita de forma explícita.

## Ejecución local

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Abrir `http://127.0.0.1:5173`.

## Configuración de la API

En `.env`:

```dotenv
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:5103/api/v1
```

La URL debe terminar en `/api/v1`. El cliente HTTP ya envía JWT, renueva la
sesión mediante refresh token y usa JSON o `multipart/form-data` según el
contrato del backend. Para pruebas aisladas puede utilizarse
`VITE_DATA_SOURCE=mock`; ese conjunto de datos no se incluye en el bundle de
producción conectado a la API.

## Comandos

```powershell
npm run dev
npm run build
npm run test
npm run typecheck
npm run check:unused
npm run check
npm run preview
```

## Cobertura funcional de pantallas

- panel de operación;
- búsqueda global de clientes, alumnos y expedientes;
- clientes, ficha, papelería, procesos y declaración de ingresos;
- alumnos, inscripción, requisitos, carné y casos asignados;
- expedientes, requisitos, asignaciones, contraparte, cronología y memoriales;
- documentos, carga y experiencia de escáner;
- actividades y reportes semanales;
- usuarios, auditoría, catálogos y vista previa de retención.

Las acciones destructivas de retención permanecen bloqueadas porque la política
institucional todavía no ha sido aprobada.
