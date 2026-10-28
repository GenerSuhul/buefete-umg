# Entrega a GitHub — 28 de octubre de 2026

## Encontrado y alcance

La rama local main coincidía con origin/main antes de esta entrega. Había cambios
funcionales, migraciones, manuales y scripts QA sin publicar. Los manifiestos
Compose existentes son locales; no había manifiesto productivo ni proxy TLS.

## Causa y cambios de entrega

El servidor no podía reproducir los cambios que sólo existían en el árbol local.
Se incluyen fuentes y documentación pendientes, se excluyen `.next-*`,
`.qa-build` y `.validate-cafeteria`, y se agrega `INSTRUCCIONES_SERVIDOR.md`
enlazado desde README. Los secretos y resultados locales permanecen fuera de Git.
La guía encomienda al agente del servidor crear y verificar el manifiesto
productivo, instalar Docker y dependencias, configurar IP/TLS, migrar y probar.
No equivale a un despliegue ejecutado.

## Pruebas realizadas en esta entrega

| Comando / revisión | Resultado |
|---|---|
| `dotnet build BufeteJuridico.slnx --configuration Release --no-restore` | Correcto, 0 errores y 0 advertencias |
| `dotnet test BufeteJuridico.slnx --configuration Release --no-build --no-restore` | 39 unitarias y 21 de integración aprobadas |
| `docker compose -f compose.yaml -f compose.app.yaml build api web` | Ambas imágenes construidas, pasos de compilación reutilizados de caché |
| `docker compose -f compose.yaml -f compose.app.yaml ps` | Instalación local preexistente saludable; no acredita ejecución de las imágenes recién construidas |
| `npm test -- --maxWorkers=2` | Sin resultado final; ejecución detenida tras permanecer sin progreso visible |
| `node node_modules/vitest/vitest.mjs run --exclude '**/.next*/**' --maxWorkers=2` | Tampoco produjo resumen; detenida. Suite frontend pendiente, causa no demostrada |
| Revisión de archivos preparados | Sin `.env` reales, builds temporales ni coincidencias con valores secretos locales y firmas de claves privadas en textos preparados; no sustituye auditoría exhaustiva |
| `git diff --cached --check` | Correcto después de retirar espacios finales en documentación de entrega |

## Pendiente y límites

No se ejecutaron en esta entrega recorridos nuevos de navegador, migraciones,
persistencia/objetos ni regresiones completas. Sus evidencias previas y casos
faltantes se conservan en `CAMBIOS_SOLICITADOS_2026-10-27.md`.
Quedan la suite frontend, el despliegue real, TLS y renovación, SMTP institucional,
backups/restauración, pruebas entre sedes, modalidad de alumno, regresión de purga
y escáner físico según `INSTRUCCIONES_SERVIDOR.md`. No declarar aceptación final
por el solo hecho de que el código haya sido publicado.
