param([int]$Port = 5191, [string]$ApiUrl = 'http://127.0.0.1:5103/api/v1')
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$env:NEXT_DIST_DIR = '.next-qa'
$env:NEXT_PUBLIC_API_BASE_URL = $ApiUrl
$env:NEXT_PUBLIC_DEMO_MODE = 'false'
$qaLog = Join-Path $repositoryRoot '.artifacts\changes-qa'
New-Item -ItemType Directory -Path $qaLog -Force | Out-Null
$web = Start-Process -FilePath 'node' -ArgumentList @('node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', $Port) -WorkingDirectory (Join-Path $repositoryRoot 'frontend') -RedirectStandardOutput (Join-Path $qaLog 'web.stdout.log') -RedirectStandardError (Join-Path $qaLog 'web.stderr.log') -WindowStyle Hidden -PassThru
Write-Output "Web QA PID $($web.Id), puerto $Port"
