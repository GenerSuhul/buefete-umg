[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$agentProject = Join-Path $projectRoot 'tools\BufeteJuridico.ScannerAgent'

Write-Host 'Iniciando agente gratuito NAPS2 en http://127.0.0.1:17654'
Write-Host 'Controladores disponibles: WIA, TWAIN y eSCL.'
Write-Host 'Mantenga esta ventana abierta mientras utilice el escáner.'
dotnet run --project $agentProject
