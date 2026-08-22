# Digitalización profesional multipágina

## Decisión de arquitectura

La digitalización es una sesión persistente, no una carga aislada. El navegador coordina la captura y edición; la API conserva el borrador, valida el acceso y genera el PDF definitivo. PostgreSQL almacena metadatos y trazabilidad, mientras MinIO o un proveedor S3 compatible conserva originales y documentos finales.

La adquisición física se realiza con el agente local `BufeteJuridico.ScannerAgent`, construido con **NAPS2 SDK 1.3.0**. Es software libre bajo LGPL-2.1-or-later y no requiere claves ni pagos por estación. En Windows admite:

- WIA para compatibilidad directa con Windows;
- TWAIN mediante el worker Win32 incluido;
- eSCL/AirScan para escáneres de red compatibles.

El agente escucha exclusivamente en `127.0.0.1:17654`. El VPS nunca intenta controlar el USB del usuario. La generación definitiva del PDF ocurre en backend con PDFsharp; el navegador no construye documentos base64 gigantes.

## Flujo end to end

1. El operador abre Digitalizar desde cliente, alumno, expediente o Archivo digital.
2. Si se abrió desde un perfil, el tipo e identificador quedan bloqueados.
3. El frontend consulta al agente local los escáneres WIA, TWAIN y eSCL disponibles.
4. El operador selecciona dispositivo, resolución, color, alimentador ADF y dúplex.
5. NAPS2 adquiere todas las hojas y devuelve un PDF multipágina local al navegador.
6. La API incorpora cada página como parte del borrador persistente e idempotente.
7. También se pueden importar PDF o imágenes sin disponer de escáner.
8. El operador reordena, gira, elimina o añade páginas.
9. Cada cambio invalida la vista previa anterior.
10. La API genera una vista previa PDF en el orden vigente.
11. Sólo después de revisarla puede confirmarse el documento.
12. La API calcula SHA-256, almacena el objeto final y crea la versión documental auditada.

## Agente local

Endpoints exclusivos de loopback:

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health` | Estado, versión, licencia y controladores disponibles |
| `GET` | `/devices` | Descubrir dispositivos WIA, TWAIN y eSCL |
| `POST` | `/scan` | Adquirir una o varias páginas y devolver PDF |

Para iniciarlo:

```powershell
.\scripts\start-scanner-agent.ps1
```

La petición de captura incluye `deviceId`, `resolutionDpi`, `colorMode`, `useFeeder` y `duplex`. Las capacidades dependen del controlador y modelo físico seleccionado.

## Persistencia

### `scan_sessions`

- contexto, etiqueta y documento reemplazado;
- proveedor, dispositivo y parámetros de adquisición;
- estado, vencimiento y último guardado;
- fechas de captura, vista previa, finalización, cancelación o fallo;
- usuario creador y auditoría.

### `scan_pages`

- identificadores del servidor y del cliente para idempotencia;
- posición, origen (`Scanner`, `Upload`, `PdfImport`) y estado;
- clave privada, nombre, MIME, tamaño y SHA-256;
- página fuente, dimensiones y rotación;
- usuario/fecha de alta y baja lógica.

### `documents`

El documento final registra `PageCount`, versión, contexto, SHA-256, tamaño, fuente y usuario responsable. El bucket es privado.

## Seguridad y operación

- El agente sólo escucha en loopback y restringe CORS a orígenes locales o expresamente autorizados.
- Toda sesión pertenece al usuario autenticado y exige `scanner.use`.
- Cada contexto vuelve a validar permiso de escritura.
- Se valida extensión, MIME, firma binaria, tamaño y máximo de páginas.
- Las páginas se cargan progresivamente con reintentos idempotentes.
- Ninguna credencial de MinIO/S3 llega al agente local.
- El agente serializa las adquisiciones para evitar dos trabajos concurrentes sobre el mismo hardware.
- Los temporales se crean en una carpeta controlada y se eliminan al terminar.

## Validación

`scripts/backend-e2e.ps1` cubre alta multipágina, recuperación de borrador, rotación, orden, eliminación, vista individual, vista previa, PDF final y auditoría contra PostgreSQL y almacenamiento real.

La única validación pendiente que exige hardware es probar los modelos físicos de la clínica con sus controladores: ADF, dúplex, DPI y compatibilidad WIA/TWAIN/eSCL.
