param([int]$Port = 5103, [string]$ExistingEnvironment = '', [string]$BinarySource = '')
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common.ps1')
Import-BufeteEnvironment -Path (Join-Path $repositoryRoot '.env')
$platformEnvironment = Join-Path $repositoryRoot '.env.platform.local'
if (Test-Path -LiteralPath $platformEnvironment) { Import-BufeteEnvironment -Path $platformEnvironment }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "El puerto $Port está ocupado." }
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12)
if ($ExistingEnvironment) {
    $previous = Get-Content -LiteralPath $ExistingEnvironment -Raw | ConvertFrom-Json
    $databaseName = $previous.databaseName
    if ($databaseName -notmatch '^bufete_changes_qa_([a-f0-9]{12})$') { throw 'La base existente no es QA.' }
    $suffix = $Matches[1]
} else { $databaseName = "bufete_changes_qa_$suffix" }
if ($databaseName -notmatch '^bufete_changes_qa_[a-f0-9]{12}$') { throw 'Nombre QA inválido.' }
$artifactDirectory = Join-Path $repositoryRoot ".artifacts\changes-qa\$suffix"
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
if (-not $ExistingEnvironment) {
    & docker exec bufete-juridico-umg-postgres-1 createdb -U $env:POSTGRES_USER $databaseName
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear PostgreSQL QA.' }
}
$env:ConnectionStrings__BufeteDb = "Host=127.0.0.1;Port=$($env:POSTGRES_PORT);Database=$databaseName;Username=$($env:POSTGRES_USER);Password=$($env:POSTGRES_PASSWORD)"
$env:Database__ApplyMigrationsOnStartup = 'true'
$env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:RateLimiting__Authentication__PermitLimit = '200'
$env:Storage__S3__UsePresignedUrls = 'false'
$env:Storage__S3__KeyPrefix = "bufete-changes-qa/$suffix"
$env:Storage__RootPath = Join-Path $artifactDirectory 'files'
$env:Cors__AllowedOrigins__2 = 'http://127.0.0.1:5191'
$binaryDirectory = Join-Path $artifactDirectory ('bin-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $binaryDirectory -Force | Out-Null
$source = if ($BinarySource) { $BinarySource } else { Join-Path $repositoryRoot 'src\BufeteJuridico.Api\bin\Release\net10.0' }
Copy-Item -Path (Join-Path $source '*') -Destination $binaryDirectory -Recurse
$apiDll = Join-Path $binaryDirectory 'BufeteJuridico.Api.dll'
$api = Start-Process -FilePath 'dotnet' -ArgumentList @($apiDll) -WorkingDirectory (Join-Path $repositoryRoot 'src\BufeteJuridico.Api') -RedirectStandardOutput (Join-Path $artifactDirectory 'api.stdout.log') -RedirectStandardError (Join-Path $artifactDirectory 'api.stderr.log') -WindowStyle Hidden -PassThru
$metadata = @{ databaseName = $databaseName; processId = $api.Id; port = $Port; artifacts = $artifactDirectory; storagePrefix = "bufete-changes-qa/$suffix" }
$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactDirectory 'environment.json')
$metadata | ConvertTo-Json
