[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Invoke-QualityStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "`n[$Name]"
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Falló el control de calidad: $Name"
    }
}

Push-Location $repositoryRoot
try {
    Import-BufeteEnvironment -Path (Join-Path $repositoryRoot '.env')
    Invoke-QualityStep 'Validar Docker Compose' { docker compose config --quiet }
    Invoke-QualityStep 'Restaurar herramientas .NET' { dotnet tool restore }
    Invoke-QualityStep 'Restaurar dependencias .NET' { dotnet restore BufeteJuridico.slnx }
    Invoke-QualityStep 'Verificar formato .NET' { dotnet format BufeteJuridico.slnx --verify-no-changes --no-restore --verbosity minimal }
    Invoke-QualityStep 'Compilar backend y agente' { dotnet build BufeteJuridico.slnx --no-restore }
    Invoke-QualityStep 'Ejecutar pruebas .NET' { dotnet test BufeteJuridico.slnx --no-build }
    Invoke-QualityStep 'Verificar modelo EF Core' {
        dotnet tool run dotnet-ef migrations has-pending-model-changes --no-build `
            --project src\BufeteJuridico.Infrastructure `
            --startup-project src\BufeteJuridico.Api
    }
    Invoke-QualityStep 'Auditar dependencias NuGet' { dotnet list BufeteJuridico.slnx package --vulnerable --include-transitive }

    Push-Location (Join-Path $repositoryRoot 'frontend')
    try {
        # npm ci reemplaza node_modules y falla en Windows si Vite mantiene un
        # binario nativo abierto. CI conserva npm ci; localmente npm install
        # respeta el lockfile sin interrumpir el servidor del desarrollador.
        Invoke-QualityStep 'Sincronizar dependencias frontend' { npm install --ignore-scripts --prefer-offline }
        Invoke-QualityStep 'Auditar dependencias npm' { npm audit --audit-level=moderate }
        Invoke-QualityStep 'Validar frontend' { npm run check }
    }
    finally {
        Pop-Location
    }

    Write-Host "`nTodos los controles de calidad finalizaron correctamente."
}
finally {
    Pop-Location
}
