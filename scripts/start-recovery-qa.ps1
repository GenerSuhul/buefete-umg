param([int]$Port = 5107, [int]$SmtpPort = 2526)
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common.ps1')
Import-BufeteEnvironment -Path (Join-Path $repositoryRoot '.env')
Import-BufeteEnvironment -Path (Join-Path $repositoryRoot '.env.platform.local')
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "El puerto $Port está ocupado." }
$artifactDirectory = Join-Path $repositoryRoot '.artifacts/changes-qa/065f3491deaa'
$env:ConnectionStrings__BufeteDb = "Host=127.0.0.1;Port=$($env:POSTGRES_PORT);Database=bufete_changes_qa_065f3491deaa;Username=$($env:POSTGRES_USER);Password=$($env:POSTGRES_PASSWORD)"
$env:Database__ApplyMigrationsOnStartup = 'true'
$env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:RateLimiting__Authentication__PermitLimit = '200'
$env:Storage__S3__UsePresignedUrls = 'false'
$env:Storage__S3__KeyPrefix = 'bufete-changes-qa/065f3491deaa'
$env:Storage__RootPath = Join-Path $artifactDirectory 'files'
$env:Smtp__Enabled = 'true'
$env:Smtp__Host = '127.0.0.1'
$env:Smtp__Port = "$SmtpPort"
$env:Smtp__UseSsl = 'false'
$env:Smtp__FromAddress = 'qa@example.test'
$env:Smtp__Username = ''
$env:Smtp__Password = ''
$binaryDirectory = Join-Path $artifactDirectory ('bin-recovery-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $binaryDirectory -Force | Out-Null
Copy-Item -Path (Join-Path $repositoryRoot 'src\BufeteJuridico.Api\bin\Release\net10.0\*') -Destination $binaryDirectory -Recurse
$api = Start-Process -FilePath 'dotnet' -ArgumentList @((Join-Path $binaryDirectory 'BufeteJuridico.Api.dll')) -WorkingDirectory (Join-Path $repositoryRoot 'src/BufeteJuridico.Api') -RedirectStandardOutput (Join-Path $artifactDirectory 'recovery.stdout.log') -RedirectStandardError (Join-Path $artifactDirectory 'recovery.stderr.log') -WindowStyle Hidden -PassThru
@{ processId = $api.Id; port = $Port; smtpPort = $SmtpPort } | ConvertTo-Json
