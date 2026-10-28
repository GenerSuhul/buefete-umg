# Encargo de despliegue para el servidor Bufete

Solicitud del responsable, 28 de octubre de 2026: descargar este repositorio,
instalar lo necesario en el servidor, construir y levantar el sistema completo
con Docker y ofrecer acceso por **IP pública y puerto, sin dominio**, con
certificado TLS confiable y renovación automática. El agente que trabaje en
el servidor debe ejecutar la implementación y la aceptación, no entregar sólo
un plan. Este archivo es el punto de entrada; leer también `AGENTS.md`.

Repositorio: https://github.com/GenerSuhul/buefete-umg — rama `main`.
El acceso SSH se proporciona en el entorno del operador; no pertenece al repo.
No hay un despliegue remoto acreditado en esta entrega.

## Orden de trabajo

1. Leer `README.md`, `docs/arquitectura/09_ARQUITECTURA_PRODUCCION_ALTA_DISPONIBILIDAD.md`,
   `docs/arquitectura/10_MULTITENANCY_NATIVO.md`,
   `docs/entrega/CAPITULO_VI_DESPLIEGUE_VPS_DOCKER.md` y
   `docs/auditoria/CAMBIOS_SOLICITADOS_2026-10-27.md`.
   Esta solicitud sustituye la exigencia de dominio del capítulo VI: usar IP.
2. Inspeccionar sistema operativo, arquitectura, recursos, disco, servicios,
   puertos ocupados, firewall, IP pública/NAT y Docker existente. Conservar
   servicios ajenos y acceso SSH. Registrar el commit que se va a desplegar.
3. Instalar Git, Docker Engine y el plugin Compose desde fuentes oficiales
   para la distribución detectada. Habilitar arranque automático. Construir
   con los Dockerfiles del repositorio; no hace falta instalar .NET y Node
   en el host para ejecutar sus contenedores. No utilizar Docker Desktop en Linux.
4. Crear y versionar un `compose.prod.yaml` independiente, configuración del
   proxy, scripts operativos y ejemplos sin secretos. **No existe aún ese
   manifiesto en esta entrega.** `compose.yaml` y `compose.app.yaml` son locales:
   Development, orígenes localhost, migración al arrancar y endpoint de
   inicialización MinIO mediante `host.docker.internal` no deben copiarse tal cual.
5. Generar secretos aleatorios en el servidor en un archivo privado fuera de
   Git y del contexto Docker (permisos 0600), preservándolos en actualizaciones.
   Nunca copiar `.env` local, reutilizar contraseñas de QA ni imprimir secretos.
6. Preparar volúmenes persistentes de PostgreSQL 18, MinIO y Data Protection,
   red privada, usuario de aplicación, bucket privado y cuentas iniciales.
   Revisar los permisos de creación de bases de sede en `TenantRegistry`.
   Evitar dar a la aplicación un superusuario de PostgreSQL; verificar el
   alta real de una sede con el rol de aprovisionamiento elegido.
7. Construir imágenes API y web, iniciar dependencias, inicializar bucket
   utilizando `http://minio:9000` desde la red de Compose y ejecutar una sola
   tarea `api --migrate`. Detener el despliegue ante cualquier error.
8. Configurar TLS, iniciar aplicación y proxy, ejecutar pruebas de aceptación,
   programar respaldos, probar restauración y verificar arranque tras reinicio.
   No eliminar volúmenes para actualizar ni restaurar encima de datos existentes.

## Contrato de configuración y exposición

- URL prevista: `https://IP_PUBLICA:443/acceso`. Usar otro puerto HTTPS libre
  sólo si el servidor lo requiere y registrar la URL exacta. Mantener 80
  accesible para HTTP-01. El certificado cubre la IP, no un puerto particular.
- Publicar únicamente el proxy para la aplicación. PostgreSQL, MinIO, consola
  de MinIO, API 8080 y web 3000 permanecen privados; revisar también reglas
  de Docker y firewall del proveedor, no confiar sólo en UFW.
- Proxy: `/api/` hacia API conservando el prefijo; `/` hacia Next.js. Rutas
  de salud según necesidad operativa. Limitar cargas conforme al tamaño
  documental y multipart de la aplicación; configurar timeouts y logs rotados.
- API: `ASPNETCORE_ENVIRONMENT=Production`,
  `Database__ApplyMigrationsOnStartup=false`, `AllowedHosts=IP_PUBLICA;localhost;127.0.0.1`
  (los hosts locales permiten los health checks internos), CORS con origen
  público exacto, `ReverseProxy__KnownProxies__0` con IP estable del proxy
  en una subred Docker sin conflicto. El proxy debe fijar correctamente
  Host, X-Forwarded-For y X-Forwarded-Proto. No confiar en cualquier origen.
- Inyectar `ConnectionStrings__BufeteDb`, `Jwt__Issuer`, `Jwt__Audience`,
  `Jwt__SigningKey`, `BootstrapAdmin__*`, `PlatformAdmin__Email` y
  `PlatformAdmin__Password`; consultar código y `.env.example` para opciones.
  Probar acceso de superadministrador, creación de sede y acceso institucional.
- Almacenamiento: `Storage__Provider=S3`, URL interna `http://minio:9000`,
  bucket privado, credenciales propias, `Storage__S3__ForcePathStyle=true`,
  `Storage__S3__UsePresignedUrls=false` para entrega autorizada por la API.
  Probar subir, asociar, refrescar, previsualizar y descargar desde fuera del VPS.
- Web: construir `frontend/Dockerfile` con
  `NEXT_PUBLIC_API_BASE_URL=https://IP_PUBLICA:443/api/v1` (o el puerto elegido)
  y `NEXT_PUBLIC_SCANNER_AGENT_URL=http://127.0.0.1:17654`. Asegurar modo
  nativo, sin activar `NEXT_PUBLIC_DEMO_MODE`. Cambiar la URL exige reconstruir.
  El origen normalmente omite `:443` al normalizarse: comprobar el Origin real
  del navegador y configurarlo exactamente en CORS.
- Persistir y proteger claves Data Protection; comprobar permisos del usuario
  no privilegiado del contenedor, cifrado en reposo y copia recuperable.
- SMTP necesita una cuenta/proveedor real: inyectar `Smtp__*` y probar correo
  y recuperación. Si faltan credenciales, pedir sólo ese dato y dejar la
  dependencia expresamente pendiente; SMTP simulado no acredita producción.

## HTTPS sin dominio y renovación

Let's Encrypt admite certificados para IP públicas con perfil `shortlived`.
Usar Certbot 5.4 o superior para HTTP-01 webroot. Preparar el proxy HTTP y
servir `/.well-known/acme-challenge/` desde el webroot compartido antes de
activar TLS; probar staging y luego emitir el certificado confiable.

Ejemplo orientativo, con variables definidas en el servidor:

```bash
sudo certbot certonly --staging --preferred-profile shortlived \
  --webroot --webroot-path "$ACME_WEBROOT" --ip-address "$PUBLIC_IP"
```

Emitir luego sin `--staging`, comprobar la ruta efectiva con `certbot certificates`,
montar certificados en el proxy y configurar un deploy-hook que valide y
recargue el proxy después de renovar. Activar el timer de renovación, probar
`certbot renew --dry-run`, comprobar el hook y el certificado servido externamente.
Monitorear fallos/vencimiento: estos certificados duran aproximadamente seis
días. No entregar certificados de staging o autofirmados como confiables.
Si la IP es privada o la validación pública está bloqueada, resolver esa
dependencia y documentarla; no afirmar que TLS quedó aprobado.

Fuente oficial verificada al preparar esta entrega:
https://letsencrypt.org/2026/03/11/shorter-certs-certbot
Revisar la documentación vigente al ejecutar el despliegue.

## Trazabilidad y aceptación en el entorno final

Usar registros QA identificables en un entorno/sede autorizados, y secretos
fuera de reportes. Completar la matriz funcional existente; esta tabla agrega
la aceptación operativa sin sustituirla.

| Requisito | Módulo / pantalla / acción | Contrato / persistencia | Permiso / prueba |
|---|---|---|---|
| Acceso público TLS | Acceso / iniciar sesión | Proxy → AuthController → AuthenticationService → PostgreSQL | Login real, sesión, 401/403, certificado y renovación |
| Separación institucional | Administración / crear sede | API → TenantRegistry → base central y bases de sede | Superadmin; aislamiento entre dos sedes |
| Continuidad jurídica | Cliente → expediente → requisito | Controllers → servicios → EF Core → tablas de cliente, expediente y relaciones | Crear, editar, guardar, refrescar, reabrir, histórico |
| Ciclo documental | Requisito / adjuntar y consultar | API → servicio documental → metadatos PostgreSQL + S3FileStorage/MinIO | Archivo privado, descarga autorizada, hash tras reinicio |
| Continuidad académica | Alumno / inscripción, sanción, estudio y cierre | StudentService, StudentDisciplineService, StudentLegalStudyService y persistencia | Roles, cierre, consulta histórica, bloqueos entre sedes |
| Recuperación | Acceso / recuperar contraseña | PlatformPasswordRecoveryService → SMTP e identidad | Código incorrecto/reutilizado rechazado, correo real, revocación |
| Operación recuperable | Backup / restauración aislada | Todas las bases de sede y central + objetos + claves | Restauración sin tocar producción; registro y archivo recuperados |

Ejecutar además E01–E15 del capítulo VI usando IP en lugar de dominio, revisar
consola del navegador, requests y logs. No basta HTTP 200 o contenedores running.
Programar backups consistentes, cifrados y externos al VPS; registrar destino,
retención, RPO/RTO acordados, comprobación y procedimiento de actualización/rollback.
Un solo VPS no constituye alta disponibilidad.

## Pendientes funcionales heredados que deben cerrarse o reportarse

**Actualización de entrega del 28 de octubre:** leer primero
`docs/auditoria/DEPENDENCIAS_2026-10-28.md`. Se publicaron actualizaciones de
seguridad por solicitud expresa del responsable sin completar su validación.
El lock actualizado pasó auditoría npm, pero faltan instalación reproducible,
suite con nuevas versiones, build y navegador. Resolverlos antes de exponer
el sistema y no confundir las 103 pruebas previas con aprobación del cambio.

La evidencia del 27–28 de octubre es local, no aceptación del servidor:

- A10: cambio de modalidad del alumno con limpieza/ignoración de datos inaplicables.
- A01–A04: descarga y bloqueo disciplinario comprobados desde otra sede.
- I01: correo institucional real para recuperación del superadministrador.
- R01: regresión general tras purga definitiva y reintento de objetos.
- Suite general frontend: comprobar estabilidad del caso App.test que tuvo
  temporización intermitente; no ocultar fallos reduciendo la cobertura.
- Escáner: requiere estación Windows, controladores y dispositivo físico.
  Configurar origen HTTPS final en el agente, probar permisos del navegador y
  captura completa. El VPS no instala ni controla el escáner de secretaría.
- Vercel sigue aplazado; no sustituye el sistema nativo .NET/PostgreSQL/MinIO.

## Entrega del agente del servidor

Dejar scripts/configuraciones reproducibles sin secretos en Git y un informe
con IP/URL real, commit, versiones/digests, servicios, puertos, migraciones,
salud, TLS/renovación, respaldo/restauración y resultados de cada recorrido.
Entregar credenciales iniciales por canal privado, nunca en commits o logs.
Separar comprobado, fallido y pendiente, explicando causa y siguiente paso.
No declarar producción terminada mientras falte una verificación aplicable.
