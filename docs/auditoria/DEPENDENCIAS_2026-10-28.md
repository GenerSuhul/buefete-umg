# Dependencias y continuación de QA — 28 de octubre de 2026

## Requisito y causa

Preparar el repositorio para instalación reproducible en el servidor, cerrar
la suite frontend pendiente y corregir dependencias con avisos de seguridad.
El `npm audit` inicial reportó nueve paquetes afectados (incluidas cadenas
transitivas), con severidad crítica en Next.js. No equivale al conteo de avisos
individuales de Dependabot.

La suite anterior sí terminó al dejar completar importación y ejecución:
28 archivos, 103 pruebas aprobadas, 420,17 segundos. La importación consumió
179,54 segundos y jsdom 131,70; no se demostró un bloqueo permanente.

## Cambios y trazabilidad

| Requisito | Módulo / acción | Capas y contratos | Verificación |
|---|---|---|---|
| Corregir vulnerabilidades | Frontend / instalar y construir | package.json → package-lock.json → npm ci → Next standalone → Docker | Audit, build y ejecución |
| Mantener flujos existentes | Acceso, navegación, documentos y dominio / suite | Componentes → contratos API/mock aislado de pruebas | 28 archivos sin retirar casos |
| Pruebas sin actualizaciones fuera de act | AppShell / renderizar navegación | Efectos de salud y búsqueda → estado → aserciones | Render asíncrono esperado mediante act |

No cambian endpoints, DTO, tablas ni permisos productivos en esta continuación.
Next.js pasa de 16.3.8 a 16.4.3; Vite a 8.3.5 y Vitest a 4.1.12.
Undici pasa a 6.29.1/7.30.1 y Zod a 4.6.6. Se fija un override de Zod
**sólo bajo @vercel/cli-config**, que declara 4.1.11 exactamente. Sigue dentro
de Zod 4; retirar el override cuando el proveedor declare una versión corregida.
No se elimina el adaptador Vercel para esconder su dependencia vulnerable.

El npm 10.9.2 local falló en Arborist (`edgesOut`) al resolver peers opcionales,
también en una carpeta sin node_modules. El lock se resolvió con Node 24/npm 11
en Docker, sin usar `--force` ni `--legacy-peer-deps`.

## Evidencia inicial

- Suite previa a actualización: 103/103, sin fallos; avisos act de AppShell
  motivaron corregir la espera del render en sus cinco pruebas.
- `dotnet list BufeteJuridico.slnx package --vulnerable --include-transitive --format json`:
  sin paquetes vulnerables reportados para los siete proyectos.
- `npm audit fix --package-lock-only --ignore-scripts` con Node 24:
  cero vulnerabilidades en el lock actualizado.

Por instrucción expresa del responsable, estos cambios se publican sin esperar
la validación restante, para que el agente del servidor la complete y corrija
los fallos que encuentre. **No están aprobados el build nuevo, la suite con las
dependencias actualizadas ni el recorrido de navegador del script nuevo**
`scripts/frontend-runtime-smoke.cjs`. Las 103 pruebas aprobadas corresponden a
las dependencias anteriores. Ejecutar `npm ci`, `npm audit`, `npm run check`,
build Docker y el recorrido real antes de aceptar producción.
Esta evidencia no acredita producción remota, SMTP, escáner físico ni cierre
de los pendientes funcionales de la entrega anterior.

## Incidencia del entorno Docker

Durante el build limpio, `docker system df` devolvió un error de snapshot
inexistente bajo `io.containerd.snapshotter.v1.overlayfs`. Se canceló ese build,
sin borrar volúmenes, imágenes ni reiniciar servicios ajenos. Se inició una
instalación con Node 24 en una carpeta QA aislada que contiene sólo fuentes
versionadas y el lock actualizado; no hay resultado final acreditado de esa
instalación en esta entrega. El build Docker nuevo no queda aprobado
por las construcciones de la entrega anterior.

Fuentes de avisos consultadas:
- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
