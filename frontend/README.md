# Frontend — Bufete Popular UMG

Aplicación Next.js App Router + React + TypeScript construida sobre los requerimientos, flujos E2E y
contratos de la API v1. El modo normal consume el backend; el adaptador mock se
carga únicamente cuando una prueba lo solicita de forma explícita.

## Ejecución local

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`.

## Configuración de la API

En `.env`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5103/api/v1
NEXT_PUBLIC_SCANNER_AGENT_URL=http://127.0.0.1:17654
```

La URL debe terminar en `/api/v1`. Son valores públicos incluidos durante
`npm run build`; no coloque secretos en variables `NEXT_PUBLIC_*`.
El cliente HTTP ya envía JWT, renueva la
sesión mediante refresh token y usa JSON o `multipart/form-data` según el
contrato del backend. El adaptador mock se usa únicamente en pruebas aisladas,
no como sustituto de la API en producción.

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
