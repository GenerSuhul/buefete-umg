param(
    [int]$Port = 5103
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
    throw "El puerto $Port ya está ocupado; no se inició el smoke test."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
Import-BufeteEnvironment -Path $environmentPath

$artifactDirectory = Join-Path $repositoryRoot '.artifacts\smoke'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null

$standardOutputPath = Join-Path $artifactDirectory 'api.stdout.log'
$standardErrorPath = Join-Path $artifactDirectory 'api.stderr.log'
$baseUrl = "http://127.0.0.1:$Port"
$previousUrls = $env:ASPNETCORE_URLS
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
$apiProcess = $null

try {
    $env:ASPNETCORE_URLS = $baseUrl
    $env:ASPNETCORE_ENVIRONMENT = 'Development'

    $apiProcess = Start-Process `
        -FilePath 'dotnet' `
        -ArgumentList @(
            'run',
            '--project',
            'src\BufeteJuridico.Api',
            '--no-build',
            '--no-launch-profile'
        ) `
        -WorkingDirectory $repositoryRoot `
        -RedirectStandardOutput $standardOutputPath `
        -RedirectStandardError $standardErrorPath `
        -WindowStyle Hidden `
        -PassThru

    $isReady = $false

    for ($attempt = 1; $attempt -le 12; $attempt++) {
        if ($apiProcess.HasExited) {
            break
        }

        try {
            $readyResponse = Invoke-WebRequest `
                -Uri "$baseUrl/health/ready" `
                -UseBasicParsing `
                -TimeoutSec 10

            if ($readyResponse.StatusCode -eq 200) {
                $isReady = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $isReady) {
        $standardOutputTail = if (Test-Path $standardOutputPath) {
            Get-Content $standardOutputPath -Tail 30
        }
        else {
            @()
        }

        $standardErrorTail = if (Test-Path $standardErrorPath) {
            Get-Content $standardErrorPath -Tail 30
        }
        else {
            @()
        }

        throw @"
La API no alcanzó readiness.
STDOUT: $($standardOutputTail -join ' | ')
STDERR: $($standardErrorTail -join ' | ')
"@
    }

    $liveResponse = Invoke-WebRequest `
        -Uri "$baseUrl/health/live" `
        -UseBasicParsing `
        -TimeoutSec 5

    $readyResponse = Invoke-WebRequest `
        -Uri "$baseUrl/health/ready" `
        -UseBasicParsing `
        -TimeoutSec 5

    $systemInformation = Invoke-RestMethod `
        -Uri "$baseUrl/api/v1/system" `
        -TimeoutSec 5

    $openApiDocument = Invoke-RestMethod `
        -Uri "$baseUrl/openapi/v1.json" `
        -TimeoutSec 5

    $loginBody = @{
        email = $env:BootstrapAdmin__Email
        password = $env:BootstrapAdmin__Password
    } | ConvertTo-Json

    $authentication = Invoke-RestMethod `
        -Uri "$baseUrl/api/v1/auth/login" `
        -Method Post `
        -ContentType 'application/json' `
        -Body $loginBody `
        -TimeoutSec 10

    $authorizationHeaders = @{
        Authorization = "Bearer $($authentication.accessToken)"
    }

    $processTypes = Invoke-RestMethod `
        -Uri "$baseUrl/api/v1/catalogs/process-types" `
        -Headers $authorizationHeaders `
        -TimeoutSec 10

    $anonymousProtectedStatus = try {
        $anonymousResponse = Invoke-WebRequest `
            -Uri "$baseUrl/api/v1/users" `
            -UseBasicParsing `
            -TimeoutSec 5
        $anonymousResponse.StatusCode
    }
    catch {
        [int]$_.Exception.Response.StatusCode
    }

    [pscustomobject]@{
        LiveStatus = $liveResponse.StatusCode
        ReadyStatus = $readyResponse.StatusCode
        Service = $systemInformation.service
        ApiVersion = $systemInformation.version
        ApiUtcNow = $systemInformation.utcNow
        OpenApiVersion = $openApiDocument.openapi
        AuthenticatedUser = $authentication.user.username
        ProcessTypeCount = @($processTypes).Count
        AnonymousProtectedStatus = $anonymousProtectedStatus
        PostgreSqlContainer = docker inspect `
            --format '{{.State.Health.Status}}' `
            bufete-juridico-umg-postgres-1
    }
}
finally {
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force
        Wait-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue
    }

    $env:ASPNETCORE_URLS = $previousUrls
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
}
