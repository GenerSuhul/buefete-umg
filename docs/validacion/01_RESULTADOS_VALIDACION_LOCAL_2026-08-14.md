# Resultados de validación local — 14 de agosto de 2026

## Resultado ejecutivo

El frontend quedó conectado a la API versionada, PostgreSQL y MinIO locales. La
validación automatizada y el recorrido real en navegador terminaron correctamente. Se
mantienen bloqueadas las operaciones que dependen de decisiones institucionales
o de infraestructura externa: borrado irreversible, escáner físico, entrega SMTP
real y alta disponibilidad de producción.

## Entorno validado

- Frontend: React + Vite en `http://127.0.0.1:5173`.
- API: ASP.NET Core 10 en `http://127.0.0.1:5103/api/v1`.
- Base de datos: PostgreSQL 18 en Docker, estado `healthy`.
- Objetos: MinIO privado en Docker, estado `healthy`, bucket
  `bufete-documentos` y claves bajo `bufete/`.
- Agente local: ASP.NET Core 10 + WIA en `127.0.0.1:17654`, `/health` correcto.
- Contrato: OpenAPI 3.1.1, 69 rutas y 83 operaciones.
- CORS: preflight HTTP 204 para `http://127.0.0.1:5173`.
- Almacenamiento de desarrollo: S3 compatible mediante MinIO; descarga privada
  con URL prefirmada y vencimiento de dos minutos.

## Datos persistentes de demostración

La corrida `20260814151256` creó mediante la API, sin inserciones SQL directas:

- 5 clientes con declaración de ingresos;
- 5 alumnos con solicitud de inscripción;
- 5 expedientes de distintos tipos;
- 5 asignaciones alumno-expediente;
- 5 documentos PDF;
- requisitos aceptados y pendientes;
- 5 movimientos cronológicos;
- 5 actividades de secretaría.

La consulta autenticada posterior confirmó exactamente 5 clientes, 5 alumnos y
5 expedientes asociados a la corrida.

## Pruebas ejecutadas

| Verificación | Resultado |
|---|---:|
| Compilación solución .NET | Correcta, 0 errores y 0 advertencias |
| Pruebas unitarias .NET | 13/13 |
| Pruebas de integración .NET | 7/7 |
| Compilación frontend | Correcta |
| Pruebas React | 4/4 |
| Recorrido navegador contra API/PostgreSQL/MinIO | Correcto, 0 errores de consola |
| Auditoría visual responsive | 21/21 vistas, 0 desbordamientos detectados |
| Humo contra PostgreSQL persistente | Correcto |
| E2E completo contra PostgreSQL temporal | Correcto |
| Login frontend → API real | HTTP 200 |
| Sesión JWT en frontend | Correcta |
| Errores de consola en dashboard real | 0 |
| Overflow horizontal a 1536 px | No detectado |
| Overflow horizontal a 390 px | No detectado |
| Favicon servido | HTTP 200; firma ICO `0-0-1-0` |

Evidencias visuales actuales:

- `../../.artifacts/frontend-functional-e2e-final.png`
- `../../.artifacts/ui-audit-final/`

## Cobertura de API

El recorrido ampliado cubre autenticación y rotación de tokens; usuarios,
roles y permisos; clientes y declaraciones; alumnos, inscripción, requisitos y
carné; catálogos configurables; expedientes, contrapartes, asignaciones, línea de
tiempo, memoriales, revisiones, presentación, notificaciones, cierre y reapertura;
documentos PDF e imagen PNG; sesiones de escaneo completas, canceladas y fallidas;
actividades y correcciones; reportes, impresión e intento de envío; búsqueda,
auditoría y vista previa de retención.

También se validaron:

- HTTP 401 para acceso anónimo a recursos protegidos;
- HTTP 403 para un alumno intentando consultar clientes o usar el escáner;
- versión obligatoria `/api/v1` y rechazo de versiones/rutas inexistentes;
- liveness independiente y readiness conectado a PostgreSQL;
- documento OpenAPI disponible únicamente en desarrollo;
- registro de fallo SMTP cuando el proveedor está deshabilitado;
- revocación de refresh token y rechazo de su reutilización.

## Requerimientos funcionales

| Grupo | Estado local | Evidencia principal |
|---|---|---|
| RF-AUT — acceso y sesión | Validado | login, refresh, revoke, 401/403 |
| RF-USR — usuarios internos | Validado | CRUD, roles, permisos, vigencias, foto y contraseñas |
| RF-CLI — clientes y papelería | Validado E2E | ficha, declaración imprimible, perfil, PDF/PNG y etiquetas |
| RF-TIP — tipos y requisitos | Validado | alta, modificación y reglas configurables |
| RF-PRO — expediente judicial | Validado E2E | flujo cronológico, notificación, memorial, revisión, presentación, cierre y reapertura |
| RF-ALU — alumnos | Validado E2E | inscripción, papelería, requisitos, resolución, carné y asignación |
| RF-BUS — búsqueda | Validado | cliente, alumno, expediente y último paso |
| RF-ACT — actividades | Validado | alta, consulta y corrección trazable |
| RF-REP — reportes | Validado sin entrega SMTP real | historial persistente, generar, revisar, previsualizar, imprimir e intento de envío |
| RF-AUD — trazabilidad | Validado | auditoría HTTP/EF y autoría de movimientos |
| RF-DEP — depuración | Validado hasta vista previa | borrado irreversible deliberadamente no expuesto |

## Requerimientos no funcionales documentados

| RNF | Resultado |
|---|---|
| RNF-01 Uso interno | Validado con autenticación y autorización por permiso |
| RNF-02 Claridad documental | Validado técnicamente con etiquetas independientes del nombre físico; requiere prueba de usuario |
| RNF-03 Facilidad de consulta | Búsqueda, perfiles y último paso disponibles; requiere prueba de usabilidad con secretaría |
| RNF-04 Integridad del historial | Validado con línea de tiempo append-oriented, auditoría y correcciones con motivo |
| RNF-05 PDF e imágenes | Validado con carga, metadata, consulta y descarga de PDF y PNG |
| RNF-06 Crecimiento funcional | Validado creando y modificando tipo de proceso y requisito sin migración |

## Validaciones que no deben declararse terminadas todavía

1. El cliente debe entregar los tipos de proceso restantes hasta aproximarse a
   los 25 esperados. Actualmente existen 7 tipos confirmados.
2. El agente WIA, su protocolo local y el flujo alternativo cámara/archivo están
   implementados y probados. La adquisición mecánica requiere conectar el modelo
   real de escáner de la clínica; no había hardware disponible en esta estación.
3. El envío real requiere credenciales SMTP, destinatarios y plantilla aprobada.
   En local se verificó que el fallo queda registrado y auditado.
4. La eliminación irreversible permanece bloqueada hasta aprobar política,
   autorización, respaldo y alcance legal de retención.
5. La alta disponibilidad, recuperación ante desastre y carga sostenida deben
   validarse en la topología final del VPS/almacenamiento; un entorno local de un
   nodo no puede demostrar esas propiedades.

## Comandos reproducibles

```powershell
dotnet test BufeteJuridico.slnx --no-build
./scripts/smoke-test.ps1 -Port 5105
./scripts/backend-e2e.ps1
cd frontend
npm test
npm run build
```

Las credenciales se leen desde `.env`; ningún script de validación las imprime.
