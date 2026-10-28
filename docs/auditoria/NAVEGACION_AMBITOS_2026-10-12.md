# Navegación por ámbito — 12 de octubre de 2026

## Requisito y causa

Separar la administración de la plataforma de la operación de una sede, preservando paleta, contratos, permisos y posiciones de las acciones de la pantalla de sedes. Las capturas muestran enlaces globales sueltos antes del resumen local. La causa está en `AppShell`: sedes y vetos se renderizaban fuera de los grupos y los controles de trazabilidad se mezclaban con administración local.

## Modelo funcional

El superusuario dispone de Administración global: Bufetes y sedes y Vetos globales. Debajo, Operación de sede identifica explícitamente el contexto activo. Crear o editar una sede no cambia ese contexto; entrar a ella sí. El administrador local sólo ve su sede; sus vetos se ubican en Administración de sede. Secretaría no recibe controles globales ni emisión de vetos. Los grupos vacíos se ocultan conforme a permisos. Las cuentas de acceso se distinguen de los usuarios atendidos.

Grupos locales: Resumen operativo, Gestión jurídica, Práctica académica, Operación interna, Administración de sede y Control y trazabilidad. No se agregan módulos ficticios ni funcionalidades comerciales ajenas al bufete.

## Matriz de trazabilidad

| Requisito / módulo / pantalla / acción | Endpoint / servicio / persistencia | Permisos / prueba |
|---|---|---|
| Administración global / sedes / `/sedes` / crear, renombrar, entrar | `/platform/tenants`; `PlatformTenantsController` → `ITenantManagementService` / `TenantRegistry` / `TenantContext`; `bufete.tenants` central y base PostgreSQL independiente por sede | `isPlatformAdmin`; E2E nativo crea sede QA, refresca, renombra, entra y verifica contexto |
| Vetos globales / `/vetos` / consultar | `/client-restrictions`; `ClientRestrictionsController` → `ClientRestrictionService` → `TenantRegistry` / EF; registro central por DPI | Superusuario; prueba del shell verifica ubicación única |
| Administración de sede / `/usuarios`, `/catalogos`, `/vetos` / navegar | Contratos existentes de cuentas, catálogos y restricciones; persistencia nativa sin modificaciones | Permisos existentes y rol Administrador para vetos; pruebas shell y E2E administrador local |
| Gestión jurídica / usuarios atendidos, expedientes, archivo / navegar | Contratos existentes clients, cases, documents y base de la sede activa | Permisos existentes; prueba shell Secretaría |
| Práctica académica / alumnos / navegar | Contratos existentes students en base de sede | Permisos existentes; prueba shell Alumno y plegado de grupo |
| Control y trazabilidad / auditoría, eliminados, retención / navegar | Contratos existentes de auditoría, eliminación y retención | Permisos existentes; ocultación de grupo sin permisos |

No se modifica ninguna entidad, migración, API ni política de autorización. La navegación no sustituye autorización del servidor. El módulo de sedes conserva sus formularios y acciones; añade explicación del contexto y distingue Activa, Suspendida, Preparando y Error de aprovisionamiento.

## Verificación

Comprobado:

- `tsc --noEmit`: sin errores.
- `vitest run src/components/layout/AppShell.test.tsx`: cuatro pruebas aprobadas (superusuario, administrador local, secretaría y alumno).
- `docker compose ... build web`: construcción Next.js de producción aprobada; se actualizó únicamente web y quedó saludable. No se cambió backend, esquema ni almacenamiento.
- `admin-center-visual-check.cjs`: línea base y nueva versión, 16 recorridos cada una (1920, 1440, 1366 y 1024 px), teclado, sidebar 260/68 px, tooltips, fuente/paleta conservadas y móvil 390 px. Sin desbordamiento ni errores de consola.
- `native-tenancy-ui-e2e.cjs`: superusuario crea sede y administrador reales, renombra y refresca, entra a esa sede; administrador local crea secretaría y verifica tras refrescar, no recibe módulo global y se rechaza entrada directa a `/sedes`; secretaría no recibe controles globales ni vetos. Aprobado sin errores de consola. Artefactos: `.artifacts/tenancy-ui/qa-ui-1791864148848/result.json`.

Los resultados visuales se guardan en `.artifacts/admin-center/after/`. La sede, base y cuentas QA de este recorrido fueron eliminadas sólo mediante validación del identificador propio de la ejecución; no se modificó información de negocio.

Alcance de aceptación: organización de navegación y continuidad de los flujos existentes de sedes y personal. No equivale a una nueva auditoría de todos los módulos; no se probaron nuevamente escáner físico ni cambios de negocio ajenos a esta fase. Los cambios están aplicados localmente en `http://localhost:5180`, sin publicación adicional a GitHub en esta fase.
