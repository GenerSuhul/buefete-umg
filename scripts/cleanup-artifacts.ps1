[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param([ValidateRange(1, 365)][int]$RetentionDays = 14)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot '.artifacts'))

if (-not $artifactRoot.StartsWith($repositoryRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La ruta de artefactos está fuera del repositorio.'
}
if (-not (Test-Path -LiteralPath $artifactRoot -PathType Container)) {
    return
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
foreach ($directory in Get-ChildItem -LiteralPath $artifactRoot -Directory) {
    $resolved = [System.IO.Path]::GetFullPath($directory.FullName)
    if (-not $resolved.StartsWith($artifactRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Ruta de limpieza rechazada: $resolved"
    }

    $latestFile = Get-ChildItem -LiteralPath $resolved -Recurse -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    $lastWrite = if ($latestFile) { $latestFile.LastWriteTime } else { $directory.LastWriteTime }
    if ($lastWrite -lt $cutoff -and $PSCmdlet.ShouldProcess($resolved, 'Eliminar artefactos regenerables')) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
