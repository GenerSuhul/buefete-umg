param(
    [switch]$RotateApplicationSecrets
)

$ErrorActionPreference = 'Stop'

function New-RandomSecret([int]$ByteCount) {
    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    return [Convert]::ToBase64String($bytes)
}

function Read-EnvironmentFile([string]$Path) {
    $values = [ordered]@{}

    if (-not (Test-Path $Path)) {
        return $values
    }

    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
            continue
        }

        $parts = $line.Split('=', 2)
        if ($parts.Count -eq 2) {
            $values[$parts[0]] = $parts[1]
        }
    }

    return $values
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
$values = Read-EnvironmentFile $environmentPath

if (-not $values.Contains('POSTGRES_DB')) { $values['POSTGRES_DB'] = 'bufete_juridico' }
if (-not $values.Contains('POSTGRES_USER')) { $values['POSTGRES_USER'] = 'bufete_app' }
if (-not $values.Contains('POSTGRES_PASSWORD')) { $values['POSTGRES_PASSWORD'] = New-RandomSecret 32 }
if (-not $values.Contains('POSTGRES_PORT')) { $values['POSTGRES_PORT'] = '55432' }

$connectionString = 'Host=127.0.0.1;Port={0};Database={1};Username={2};Password={3};Maximum Pool Size=30;Minimum Pool Size=2;Connection Idle Lifetime=300;Connection Pruning Interval=10;Keepalive=30;Timeout=15;Command Timeout=30' -f `
    $values['POSTGRES_PORT'], `
    $values['POSTGRES_DB'], `
    $values['POSTGRES_USER'], `
    $values['POSTGRES_PASSWORD']

$values['ConnectionStrings__BufeteDb'] = $connectionString
$values['Database__ApplyMigrationsOnStartup'] = 'false'
$values['Cors__AllowedOrigins__0'] = 'http://localhost:5173'
$values['Cors__AllowedOrigins__1'] = 'http://127.0.0.1:5173'
$values['Jwt__Issuer'] = 'BufeteJuridicoUMG'
$values['Jwt__Audience'] = 'BufeteJuridicoUMG.Web'

if ($RotateApplicationSecrets -or -not $values.Contains('Jwt__SigningKey')) {
    $values['Jwt__SigningKey'] = New-RandomSecret 64
}

$values['Jwt__AccessTokenMinutes'] = '15'
$values['Jwt__RefreshTokenDays'] = '7'
$values['RateLimiting__Authentication__PermitLimit'] = '10'
$values['RateLimiting__Authentication__WindowSeconds'] = '60'
$values['BootstrapAdmin__Username'] = 'admin'
$values['BootstrapAdmin__Email'] = 'admin@bufete.local'
$values['BootstrapAdmin__FullName'] = 'Administrador General'

if ($RotateApplicationSecrets -or -not $values.Contains('BootstrapAdmin__Password')) {
    $values['BootstrapAdmin__Password'] = 'Adm!' + (New-RandomSecret 24)
}

$values['MINIO_ROOT_USER'] = 'bufete_minio'
if ($RotateApplicationSecrets -or -not $values.Contains('MINIO_ROOT_PASSWORD')) {
    $values['MINIO_ROOT_PASSWORD'] = New-RandomSecret 32
}
$values['MINIO_BUCKET'] = 'bufete-documentos'
$values['MINIO_API_PORT'] = '59000'
$values['MINIO_CONSOLE_PORT'] = '59001'
$values['Storage__Provider'] = 'S3'
$values['Storage__RootPath'] = '.data/files'
$values['Storage__MaxFileSizeBytes'] = '26214400'
$values['Storage__DownloadUrlMinutes'] = '2'
$values['Storage__S3__BucketName'] = $values['MINIO_BUCKET']
$values['Storage__S3__Region'] = 'us-east-1'
$values['Storage__S3__ServiceUrl'] = 'http://127.0.0.1:59000'
$values['Storage__S3__ForcePathStyle'] = 'true'
$values['Storage__S3__AccessKey'] = $values['MINIO_ROOT_USER']
$values['Storage__S3__SecretKey'] = $values['MINIO_ROOT_PASSWORD']
$values['Storage__S3__KeyPrefix'] = 'bufete'
$values['Scanner__SessionMinutes'] = '30'
$values['Scanner__MaximumPages'] = '200'
$values['Scanner__CleanupIntervalMinutes'] = '15'
$values['Scanner__DraftRetentionDays'] = '30'
$values['Smtp__Enabled'] = 'false'
if (-not $values.Contains('Smtp__Host')) { $values['Smtp__Host'] = '' }
$values['Smtp__Port'] = '587'
$values['Smtp__UseSsl'] = 'true'
if (-not $values.Contains('Smtp__Username')) { $values['Smtp__Username'] = '' }
if (-not $values.Contains('Smtp__Password')) { $values['Smtp__Password'] = '' }
$values['Smtp__FromAddress'] = 'no-reply@bufete.local'
$values['Smtp__FromName'] = 'Bufete Juridico UMG'

$lines = foreach ($entry in $values.GetEnumerator()) {
    '{0}={1}' -f $entry.Key, $entry.Value
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($environmentPath, $lines, $utf8WithoutBom)

Write-Host 'Configuración local creada en .env.'
Write-Host 'La API carga este archivo automáticamente cuando se ejecuta en Development.'
Write-Host 'Las credenciales no se imprimen. Abra .env localmente para consultarlas.'
