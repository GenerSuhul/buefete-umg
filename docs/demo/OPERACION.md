# Entorno de revisión

## Acceso y alcance

- Aplicación: https://bufete-umg-demo.vercel.app/acceso
- Manual: https://bufete-umg-demo.vercel.app/manual-demo.pdf
- Proyecto Vercel independiente: `bufete-umg-demo`.
- PostgreSQL independiente: `bufete-umg-demo-db` (Neon).
- Archivos privados independientes: `bufete-umg-demo-files` (Vercel Blob).
- Rama: `codex/demo-multisede`. No fusionar automáticamente en producción.

Las credenciales se entregan fuera del repositorio. Los ejemplos son ficticios y no tienen validez académica ni judicial. No cargar información personal, expedientes ni documentos reales.

## Activación y publicación

El adaptador se activa únicamente cuando `NEXT_PUBLIC_DEMO_MODE=true` durante el build y `DEMO_MODE=true` en el servidor. Sin ambas variables, el frontend mantiene su cliente API .NET y el endpoint de demostración responde 404. No se cambia la configuración de Docker ni de la base de datos productiva.

Variables privadas del proyecto demo: `DEMO_DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD_HASH`. La contraseña de plataforma usa scrypt; no se almacena en texto plano. Las cuentas locales también usan scrypt. Nunca configurar estas variables en el proyecto de producción.

La conexión Git está deshabilitada para despliegues automáticos mediante `vercel.json`. Publicación explícita desde `frontend/`: `npx vercel --prod --yes`. Comprobar que `.vercel/project.json` corresponde a **bufete-umg-demo** antes de publicar. No versionar `.vercel/` ni archivos `.env`.

## Validación

`scripts/verify-demo.mjs` comprueba contratos y persistencia reales contra `DEMO_TEST_URL`. Requiere la contraseña inicial en `DEMO_INITIAL_PASSWORD`, crea una sede identificada `qa-*` y muestra su código al terminar. `scripts/cleanup-demo-qa.mjs <código-exacto>` elimina exclusivamente esa sede desechable y sus archivos; rechaza sedes que no correspondan a la prueba. No ejecutarlo sobre espacios de evaluación del cliente.

`scripts/seed-demo.mjs` prepara ejemplos ficticios en Petén. `scripts/sync-demo-catalogs.mjs` proyecta los catálogos vigentes desde el inicializador .NET; no establece nuevos requisitos jurídicos.

El manual se genera con `scripts/build-demo-manual.py` y se verifica visualmente con `scripts/render-demo-manual.py`. El PDF publicado es `frontend/public/manual-demo.pdf`.

## Administración de sedes

El administrador de plataforma crea sedes y cambia de espacio. Las cuentas de cada sede no pueden cambiar libremente de tenant. Cada operación y descarga valida la sesión y el propietario dentro de su sede; cambiar de espacio renueva la sesión y recarga la interfaz.

Este prototipo utiliza un agregado JSONB transaccional por sede, adecuado para una revisión pequeña. No es el modelo de escala o alta disponibilidad de producción. Antes de integrar multi-sede en .NET deben acordarse gobierno institucional, administración delegada, movilidad de cuentas, retención y estrategia de despliegue/migración. No trasladar el backend demo como sustituto del dominio .NET.

## Restricciones visibles

- Archivos: máximo 3 MiB por solicitud. Importación documental y almacenamiento están habilitados.
- El escáner físico requiere agente y dispositivo local; no queda certificado por las pruebas de importación.
- El envío de correo está deshabilitado, no se informa falsamente como enviado.
- Las notificaciones del expediente registran seguimiento; no presentan documentos ante autoridades.
- La vista de retención no habilita una depuración institucional real en la demo.
- Los servicios gratuitos tienen cuotas y arranque en frío; la demo no ofrece SLA de producción.
