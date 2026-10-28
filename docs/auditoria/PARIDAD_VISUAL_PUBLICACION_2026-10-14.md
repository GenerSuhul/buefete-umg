# Publicación institucional: iconos y perfil

## Encontrado y causa raíz

La captura del dominio anterior corresponde al frontend publicado, pero AppShell seleccionaba Fluent sólo cuando `!demoEnabled && user.isPlatformAdmin`. El adaptador publicado siempre conservaba los iconos Lucide. El nombre `Licenciado Demo` provenía del registro raíz persistido en `demo_tenants.state.users`, y AuthProvider no consultaba el perfil al restaurar una sesión.

## Trazabilidad

| Requisito | Módulo/pantalla/acción | Endpoint y servicio | Persistencia | Permisos | Prueba |
|---|---|---|---|---|---|
| Iconos coherentes | AppShell, navegación | No requiere escritura | No aplica | Se conserva filtrado por permisos | AppShell.test.tsx y navegador publicado |
| Administración con aspecto actual | AppShell, sedes | POST /api/demo, getWorkspace, workspace | demo_sessions.platform_admin + demo_tenants | Ámbito verificado por servidor; createTenant conserva control 403 | Prueba de menú global y exclusión de funcionalidades nativas |
| Perfil sin nombre de muestra | Inicio/cabecera, refrescar | initializeDemo + getCurrentUser | UPDATE transaccional de demo_tenants.state/revision y state.audit | Sólo ID raíz con nombre exactamente predeterminado | institutionalProfile.test.ts y comprobación PostgreSQL publicada |
| Actualización de sesión existente | AuthProvider, refrescar | dataSource.getCurrentUser | Perfil remoto; caché de sesión sincronizada | Se comprueba el mismo ID antes de aplicar respuesta | Browser E2E con nombre de caché anterior |

## Cambios

- Iconos Fluent compartidos para navegación local y publicada.
- Aspecto de administración global y navegación de sedes activados por la respuesta autenticada getWorkspace, manteniendo restricciones del servidor.
- Nombre inicial Administrador de plataforma. Normalización transaccional e idempotente del nombre antiguo exacto, conservando IDs, credenciales, roles, nombres personalizados y demás datos; registra un evento por perfil corregido.
- Restauración de sesión consulta el perfil remoto y actualiza nombre, correo y foto; ignora respuestas de otra cuenta y operaciones canceladas.

## Validación

- TypeScript sin errores y build de producción Vercel completado.
- Pruebas dirigidas de perfil, navegación y contrato de catálogos: 8 aprobadas. Regresión dirigida de mensajes y navegación: 10 aprobadas.
- Despliegue preparado: dpl_J9xBuxbdTCV3kNnRSniPz8H1Cq8Y. Health de su API comprobado: Healthy, PostgreSQL Healthy.
- Script scripts/publication-visual-e2e.cjs crea sede y usuario QA aislados, comprueba nombres raíz persistidos, inicia sesión mediante formulario real, verifica iconos, exclusión de navegación privilegiada para secretaría y actualización de caché al refrescar. Limpia sólo esa sede y sus sesiones por ID y código exactos.
- E2E aprobado primero en el despliegue preparado y luego en https://bufete-popular-umg.vercel.app. Evidencia pública: `.artifacts/publication/qa-publicacion-1791960454256/result.json` y capturas `publicacion-verificada.png`, `administracion-publicada.png`, inspeccionadas visualmente. 10 iconos Fluent; refresh del perfil correcto; cero nombres raíz predeterminados antiguos en las sedes existentes; consola y requests sin errores.
- En la sesión QA temporal se configuró `demo_sessions.platform_admin=true` por ID de sede/usuario exclusivamente para comprobar el ámbito global real del servidor: menú de sedes presente, administración compacta y cabecera de 64 px, sin exponer Lista negra nativa. La sede y sus sesiones se eliminaron al finalizar.
- Promoción completada de dpl_J9xBuxbdTCV3kNnRSniPz8H1Cq8Y; el alias anterior https://bufete-umg-demo.vercel.app también resuelve esa publicación.

## Ajuste solicitado: retirar franja institucional

El usuario solicita eliminar la franja adicional de Vercel, incluidos sus accesos Sedes y Manual. Se retira el marcado y los estilos de WorkspaceBanner. WorkspaceContext mantiene únicamente la consulta getWorkspace para identificar la sede y aplicar el ámbito autorizado del menú lateral, donde Sedes ya tiene su acceso correspondiente. No cambia el contrato, la persistencia ni los permisos del servidor. El PDF sigue disponible por su URL existente. La comprobación de navegador publicada exige ausencia de la franja, conserva el recorrido de login/refresh y comprueba navegación por ámbito.

## Límites

El frontend publicado sigue usando su adaptador Next/Neon. Esta corrección no migra el backend .NET ni agrega al adaptador las funciones nativas de lista negra. El escaneo físico continúa dependiendo de un agente local disponible. No declarar esas diferencias resueltas por un cambio de iconos o nombre. El E2E publicado usa una cuenta temporal de secretaría y una configuración temporal de ámbito global en su propia sesión QA; no se accedió a la sesión real del usuario. No hubo cambios al backend .NET en esta fase: su última compilación y pruebas pertenecen a las fases anteriores.

## Resultado del retiro de franja y arranque de escaneo

- Publicado y promovido dpl_8KboJCXeWzxEhfH1Yw9yUXDxwdJ4; el dominio bufete-popular-umg.vercel.app apunta a esa versión, verificado mediante inspect.
- Build y TypeScript Vercel correctos, 5 pruebas de navegación aprobadas. E2E real aprobado: .artifacts/publication/qa-publicacion-1791985456231. Ausencia de franja, refresh de perfil, iconos y ámbitos comprobados, cero errores de consola/respuestas fallidas. Captura de administración inspeccionada visualmente.
- Agente NAPS2 iniciado en segundo plano con scripts/start-scanner-agent.ps1. /health ready=true y /devices HTTP 200, 12 entradas de dispositivos/controladores. CORS admite el dominio público. No se ejecutó una captura física. Logs: tmp/runtime/scanner-current.out.log y scanner-current.err.log.
