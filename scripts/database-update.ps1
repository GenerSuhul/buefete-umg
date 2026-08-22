param(
    [string]$Migration = ""
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
Import-BufeteEnvironment -Path $environmentPath

Push-Location $repositoryRoot

try {
    dotnet tool restore
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if (-not [string]::IsNullOrWhiteSpace($Migration)) {
        dotnet tool run dotnet-ef migrations add $Migration `
            --project src\BufeteJuridico.Infrastructure `
            --startup-project src\BufeteJuridico.Api `
            --context BufeteDbContext `
            --output-dir Persistence\Migrations

        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }

    dotnet run --no-launch-profile --project src\BufeteJuridico.Api -- --migrate

    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
