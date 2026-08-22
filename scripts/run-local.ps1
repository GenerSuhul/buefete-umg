param(
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
Import-BufeteEnvironment -Path $environmentPath

$arguments = @('run', '--project', 'src\BufeteJuridico.Api')
if ($NoBuild) {
    $arguments += '--no-build'
}

& dotnet @arguments
exit $LASTEXITCODE
