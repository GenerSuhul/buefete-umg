# Publicación con identidad institucional

## Requisito y alcance

Publicar los cambios del frontend en el proyecto Vercel existente y retirar las etiquetas visibles de demostración. Se conserva el backend PostgreSQL/Blob del proyecto vinculado, sin migrar a .NET ni modificar usuarios, documentos o expedientes existentes.

## Encontrado y causa raíz

El modo de publicación habilitaba textos específicos de demo en LoginPage, WorkspaceBanner, Sedes, informes, declaraciones, errores y manual. El enlace público también contenía demo. Los identificadores internos activan el adaptador correcto; retirarlos indiscriminadamente rompería el backend.

## Cambios

- Acceso y franja de sede con identidad institucional; enlace a `/manual.pdf`.
- Sedes, reportes, declaraciones y errores sin etiquetas demo; correo no configurado sigue informado como tal.
- Manual edición 1.1, 14 páginas, regenerado y revisado visualmente. Alias del PDF anterior conservado.
- Dominio `bufete-popular-umg.vercel.app` agregado al proyecto `prj_Epgi1833nxFQgv3DS1gxcgnFOoO9` del equipo `team_7u1d8BSi4YqMjXjsmxvgdLCr`.
- Inicio del agente de escaneo con orígenes exactos para los dominios nuevo y anterior; loopback conservado.

## Trazabilidad

| Requisito | Módulo/pantalla/acción | Contrato/persistencia | Permisos | Verificación |
|---|---|---|---|---|
| Acceder sin etiqueta demo | LoginPage → login | POST /api/demo; demo_sessions y demo_tenants sin cambios | Autenticación vigente | Página pública revisada en navegador; llamada sin sesión rechazada |
| Mostrar sede y manual | AppShell → WorkspaceBanner → getWorkspace; /manual.pdf | Adaptador y datos conservados; PDF público sin credenciales | Sesión para sede; manual público | Pruebas frontend y hash del PDF publicado |
| Identidad en informes/documentos | generateReport; declaración de ingresos | DTO y persistencia conservados; cambia encabezado de HTML | Permisos existentes | Regresión del dominio; contratos sin cambios |
| Escáner desde dominio | ScanWorkspace → scannerAgent | GET /health y /devices en 127.0.0.1:17654 | CORS por origen; API mantiene scanner.use | Configuración local; captura física desde dominio pendiente |

## Pruebas realizadas

- `npm run typecheck`: aprobado.
- Vitest focalizado: domain, scanContract y AppShell; 3 archivos, 11 pruebas aprobadas.
- Build Next.js de producción en Vercel: aprobado (TypeScript y prerender incluidos).
- Despliegue final preparado: `dpl_5W2behLQkLNgVUPMqz7TFwuzy8Ng`, snapshot local sobre `e1573ad` con cambios sin commit.
- POST getPlatformHealth en despliegue final: Healthy, PostgreSQL Healthy.
- POST getWorkspace sin sesión: 401.
- Manual del despliegue final: descargado y SHA-256 igual al PDF local; 14 páginas, sin palabra demo en el contenido.
- Revisión React: cambios de texto sin alterar hooks, permisos, contratos ni claves; navegación/roles conservados.
- Promoción del despliegue final completada. Dominio público nuevo: acceso revisado en navegador, getPlatformHealth Healthy y manual HTTP 200.
- Agente local reiniciado: /health HTTP 200 y Access-Control-Allow-Origin exacto para https://bufete-popular-umg.vercel.app. No equivale a captura física desde el dominio.
- Suite general `npm test`: terminó correctamente antes del intento de cierre; 23 archivos y 89 pruebas aprobadas en 295.31 segundos. Las 11 pruebas focalizadas también pasaron.

## Límites

No se acredita un flujo completo autenticado de producción con registros existentes por estas comprobaciones públicas. No se ha probado una captura física desde el dominio, instalado inicio automático en estaciones ni configurado correo. Los nombres y valores existentes de las cuentas no se reescriben para alterar su identidad. Las limitaciones del entorno siguen documentadas en `docs/demo/OPERACION.md`.
