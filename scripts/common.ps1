function Import-BufeteEnvironment {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw 'No existe .env. Ejecute .\scripts\bootstrap-local.ps1 primero.'
    }

    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
            continue
        }

        $parts = $line.Split('=', 2)
        if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Entrada inválida en el archivo de entorno: $($parts[0])"
        }

        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
}
