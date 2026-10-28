[CmdletBinding()]
param(
    [string]$SystemOrigin = 'https://5.189.160.157',
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'BufeteUMG\ScannerAgent'),
    [string]$TaskName = 'Bufete UMG Scanner Agent'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Assert-NativeSuccess([string]$Message) {
    if ($LASTEXITCODE -ne 0) { throw $Message }
}

try {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Este instalador requiere Windows de 64 bits.' }
    $originUri = $null
    if (-not [Uri]::TryCreate($SystemOrigin, [UriKind]::Absolute, [ref]$originUri) -or
        $originUri.Scheme -ne 'https' -or $originUri.AbsolutePath -ne '/' -or $originUri.Query -or $originUri.Fragment) {
        throw 'El origen debe ser HTTPS y no llevar rutas. Ejemplo: https://5.189.160.157'
    }
    $SystemOrigin = $originUri.GetLeftPart([UriPartial]::Authority).TrimEnd('/')

    $InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory)
    $sourceDirectory = Join-Path $InstallDirectory 'source'
    $publishDirectory = Join-Path $InstallDirectory 'publish'
    $configPath = Join-Path $InstallDirectory 'agent-settings.json'
    $launcherPath = Join-Path $InstallDirectory 'run-scanner-agent.ps1'
    $entryPoint = Join-Path $publishDirectory 'BufeteJuridico.ScannerAgent.exe'
    $temporaryRoot = Join-Path $env:TEMP ('bufete-scanner-' + [guid]::NewGuid().ToString('N'))
    $archive = Join-Path $temporaryRoot 'repo.zip'
    $sdkDirectory = Join-Path $InstallDirectory 'dotnet-sdk'
    New-Item -ItemType Directory -Path $InstallDirectory,$temporaryRoot -Force | Out-Null

    Write-Step 'Descargando el agente oficial desde GitHub (sin instalar Git)'
    Invoke-WebRequest -Uri 'https://codeload.github.com/GenerSuhul/buefete-umg/zip/refs/heads/main' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $temporaryRoot -Force
    $repoRoot = Get-ChildItem -LiteralPath $temporaryRoot -Directory | Select-Object -First 1
    if (-not $repoRoot) { throw 'GitHub descargó un archivo vacío; revise la conexión e inténtelo de nuevo.' }
    if (Test-Path $sourceDirectory) { Remove-Item -LiteralPath $sourceDirectory -Recurse -Force }
    Copy-Item -LiteralPath $repoRoot.FullName -Destination $sourceDirectory -Recurse
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force

    Write-Step 'Preparando .NET SDK 10 (instalación privada de esta cuenta)'
    $dotnet = (Get-Command dotnet -ErrorAction SilentlyContinue).Source
    $hasSdk10 = $false
    if ($dotnet) {
        $sdks = & $dotnet --list-sdks 2>$null | Out-String
        $hasSdk10 = $sdks -match '(?m)^10\.'
    }
    if (-not $hasSdk10) {
        $installer = Join-Path $env:TEMP ('dotnet-install-' + [guid]::NewGuid().ToString('N') + '.ps1')
        try {
            Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installer
            & $env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -Channel 10.0 -Quality GA -InstallDir $sdkDirectory
            Assert-NativeSuccess '.NET SDK 10 no se pudo instalar. Revise la conexión a dot.net y vuelva a ejecutar el instalador.'
        } finally { Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue }
        $dotnet = Join-Path $sdkDirectory 'dotnet.exe'
    }
    if (-not (Test-Path $dotnet)) { throw 'No se encontró dotnet.exe después de preparar el SDK.' }

    Write-Step 'Publicando el agente autocontenido para Windows x64'
    $project = Join-Path $sourceDirectory 'tools\BufeteJuridico.ScannerAgent\BufeteJuridico.ScannerAgent.csproj'
    if (-not (Test-Path $project)) { throw 'El repositorio descargado no contiene el proyecto del agente.' }
    Push-Location $sourceDirectory
    try {
        & $dotnet publish $project --configuration Release --runtime win-x64 --self-contained true -p:PublishSingleFile=true --output $publishDirectory
        Assert-NativeSuccess 'Falló la publicación del agente. Compruebe espacio libre e internet para restaurar paquetes NuGet.'
    } finally { Pop-Location }
    if (-not (Test-Path $entryPoint)) { throw 'La compilación terminó sin crear el ejecutable del agente.' }

    Write-Step 'Configurando el arranque automático al iniciar sesión'
    @{ systemOrigin = $SystemOrigin } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8
    @'
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$settings = Get-Content -LiteralPath (Join-Path $root 'agent-settings.json') -Raw | ConvertFrom-Json
$env:SCANNER_ALLOWED_ORIGINS = [string]$settings.systemOrigin
Set-Location $root
& (Join-Path $root 'publish\BufeteJuridico.ScannerAgent.exe')
'@ | Set-Content -LiteralPath $launcherPath -Encoding utf8

    $powershell = Join-Path $PSHOME 'powershell.exe'
    $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$launcherPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
    $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $taskSettings -Principal $principal -Description 'Agente local de escaneo Bufete Popular UMG.' -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName

    Write-Step 'Verificando que el agente responda'
    $healthy = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:17654/health' -TimeoutSec 2
            if ($health.ready -eq $true) { $healthy = $true; break }
        } catch { }
    }
    if (-not $healthy) { throw "La tarea se registró pero el agente no respondió en 30 segundos. Reinicie Windows e inspeccione la tarea '$TaskName'." }

    Write-Host "`nINSTALACIÓN COMPLETADA" -ForegroundColor Green
    Write-Host "Sistema autorizado: $SystemOrigin"
    Write-Host "Agente local: http://127.0.0.1:17654/health"
    Write-Host "Tarea automática: $TaskName (cuenta $user)"
    Write-Host 'Conecte el escáner e instale su controlador de fabricante si aún no está instalado.'
    Write-Host 'Para comprobar dispositivos, abra PowerShell y ejecute: Invoke-RestMethod http://127.0.0.1:17654/devices'
} catch {
    Write-Host "`nINSTALACIÓN NO COMPLETADA: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'La ventana permanecerá abierta para que pueda leer el error.' -ForegroundColor Yellow
    try { Read-Host 'Presione Enter para cerrar' | Out-Null } catch { }
    exit 1
}

Read-Host 'El agente quedó instalado. Presione Enter para cerrar' | Out-Null
