[CmdletBinding()]
param(
    [string[]]$AllowedOrigins = @(
        'https://bufete-popular-umg.vercel.app',
        'https://bufete-umg-demo.vercel.app'
    )
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$agentProject = Join-Path $projectRoot 'tools\BufeteJuridico.ScannerAgent'

# Los dominios autorizados se configuran al iniciar; el agente permanece en loopback.
if (-not $env:SCANNER_ALLOWED_ORIGINS) {
    $env:SCANNER_ALLOWED_ORIGINS = $AllowedOrigins -join ';'
}

Write-Host 'Iniciando agente gratuito NAPS2 en http://127.0.0.1:17654'
Write-Host 'Controladores disponibles: WIA, TWAIN y eSCL.'
Write-Host 'Mantenga esta ventana abierta mientras utilice el escáner.'
dotnet run --project $agentProject
