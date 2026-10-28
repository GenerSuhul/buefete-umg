# Instalación del agente de escaneo en Windows

Cada estación Windows instala el agente local que conecta el navegador con el escáner de esa computadora. El agente sólo escucha en `127.0.0.1:17654`; no se debe publicar ni abrir este puerto en el firewall.

## Requisitos

- Windows 10 u 11 de 64 bits.
- Git para Windows.
- .NET SDK 10 x64 para compilar el agente durante la instalación.
- Controlador WIA, TWAIN o eSCL del escáner instalado por el fabricante. El script no puede instalar ni validar automáticamente todos los controladores físicos.
- El origen HTTPS exacto del sistema desplegado, sin rutas; por ejemplo `https://bufete.ejemplo.com`.

## Instalar

Abra PowerShell con la cuenta de Windows que utilizará el escáner. Descargue `scripts/install-scanner-agent.ps1` desde la rama `main` del repositorio o clone el repo:

```powershell
git clone --depth 1 --branch main https://github.com/GenerSuhul/buefete-umg.git C:\BufeteUMG
cd C:\BufeteUMG
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install-scanner-agent.ps1 -SystemOrigin 'https://bufete.ejemplo.com'
```

El instalador compila el agente autocontenido para Windows x64, registra una tarea programada para ejecutarlo al iniciar sesión con esa cuenta y verifica `/health`. Se puede usar un directorio y nombre de tarea personalizados con `-InstallDirectory` y `-TaskName`.

La cuenta que ejecuta el instalador debe tener permiso para crear una tarea programada. La tarea usa inicio de sesión interactivo, porque el acceso a WIA/TWAIN y al escáner depende de la sesión y los controladores del usuario. No es un servicio SCM de Windows.

## Verificar y usar

```powershell
Invoke-RestMethod http://127.0.0.1:17654/health
Invoke-RestMethod http://127.0.0.1:17654/devices
```

Abra el sistema en esa misma computadora, inicie sesión, abra un documento o requisito, seleccione **Escanear**, elija el dispositivo, capture las páginas, revise la vista previa y guarde el documento.

## Cambiar el dominio autorizado

Vuelva a ejecutar el instalador con el nuevo `-SystemOrigin`. También es posible editar `agent-settings.json` dentro del directorio de instalación y reiniciar la tarea:

```powershell
Stop-ScheduledTask -TaskName 'Bufete UMG Scanner Agent'
# Edite agent-settings.json, propiedad systemOrigin, con el origen HTTPS exacto.
Start-ScheduledTask -TaskName 'Bufete UMG Scanner Agent'
```

## Quitar

```powershell
Unregister-ScheduledTask -TaskName 'Bufete UMG Scanner Agent' -Confirm:$false
```

Después se puede borrar el directorio de instalación mostrado por el instalador. No elimine otros datos del usuario.
