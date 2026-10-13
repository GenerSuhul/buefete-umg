#Requires -Version 7.0
param([int]$Port = 5118)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Puerto $Port ocupado." }
foreach ($line in [IO.File]::ReadAllLines((Join-Path $repo '.env'))) {
    if ($line.Trim() -and !$line.TrimStart().StartsWith('#')) {
        $parts = $line.Split('=', 2); [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
}
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$database = "bufete_tenancy_qa_$suffix"
$createdDatabases = [Collections.Generic.List[string]]::new()
$base = "http://127.0.0.1:$Port/api/v1"
$artifacts = Join-Path $repo ".artifacts/tenancy/$suffix"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$env:PlatformAdmin__Email = "root-$suffix@example.test"
$env:PlatformAdmin__Password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(10))
$password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(10))
$env:Database__ApplyMigrationsOnStartup = 'true'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
$env:RateLimiting__Authentication__PermitLimit = '200'
$env:Storage__S3__UsePresignedUrls = 'false'
$env:Storage__S3__KeyPrefix = "native-tenancy-e2e/$suffix"
$env:ConnectionStrings__BufeteDb = "Host=127.0.0.1;Port=$($env:POSTGRES_PORT);Database=$database;Username=$($env:POSTGRES_USER);Password=$($env:POSTGRES_PASSWORD)"
$process = $null
$checks = 0
function Api([string]$Method, [string]$Path, $Body = $null, [string]$Token = '', [string]$Sede = 'peten', [int]$Expected = 200) {
    $headers = @{ 'X-Sede-Code' = $Sede }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $args = @{ Uri = "$base$Path"; Method = $Method; Headers = $headers; SkipHttpErrorCheck = $true; TimeoutSec = 90 }
    if ($null -ne $Body) { $args.ContentType = 'application/json'; $args.Body = $Body | ConvertTo-Json -Depth 12 }
    $response = Invoke-WebRequest @args
    if ([int]$response.StatusCode -ne $Expected) { throw "$Method $Path ($Sede): esperado $Expected, recibido $($response.StatusCode). $($response.Content)" }
    $script:checks++
    if ($Expected -ge 400) { return }
    $text = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { [string]$response.Content }
    if ($text -and $response.Headers['Content-Type'] -match 'json') { return $text | ConvertFrom-Json }
}
try {
    dotnet build src/BufeteJuridico.Api --no-restore --verbosity quiet
    if ($LASTEXITCODE) { throw 'Falló compilación.' }
    docker exec bufete-juridico-umg-postgres-1 createdb -U $env:POSTGRES_USER $database
    if ($LASTEXITCODE) { throw 'Falló creación de base QA.' }
    $createdDatabases.Add($database)
    $process = Start-Process dotnet -ArgumentList @('src/BufeteJuridico.Api/bin/Debug/net10.0/BufeteJuridico.Api.dll') -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput "$artifacts/api.stdout.log" -RedirectStandardError "$artifacts/api.stderr.log"
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try { if ((Invoke-WebRequest "http://127.0.0.1:$Port/health/ready" -TimeoutSec 2).StatusCode -eq 200) { $ready = $true; break } } catch { Start-Sleep -Milliseconds 500 }
    }
    if (!$ready) { throw "API QA no disponible; consulte $artifacts" }
    $root = Api POST /auth/login @{ email = $env:PlatformAdmin__Email; password = $env:PlatformAdmin__Password }
    if (!$root.user.isPlatformAdmin) { throw 'Falta atributo global.' }
    $local = Api POST /auth/login @{ email = $env:BootstrapAdmin__Email; password = $env:BootstrapAdmin__Password }
    Api GET /platform/tenants $null $local.accessToken peten 403
    Api POST /platform/tenants @{ code = 'denied'; name = 'Denied' } $local.accessToken peten 403
    $a = "qa-a-$suffix"; $b = "qa-b-$suffix"
    Api POST /platform/tenants @{ code = "reserved-$suffix"; name = 'Identidad reservada'; administratorName = 'Admin'; administratorEmail = $env:PlatformAdmin__Email; administratorPassword = $password } $root.accessToken peten 409
    foreach ($code in @($a, $b)) {
        $body = @{ code = $code; name = "Sede $code"; administratorName = 'Administrador QA'; administratorEmail = 'admin@example.test'; administratorPassword = $password }
        Api POST /platform/tenants $body $root.accessToken | Out-Null
    }
    $names = docker exec bufete-juridico-umg-postgres-1 psql -U $env:POSTGRES_USER -d $database -At -c 'SELECT "DatabaseName" FROM bufete.tenants WHERE "Code" <> ''peten'';'
    foreach ($name in $names) { if ($name -match '^bufete_t_[a-f0-9]{32}$') { $createdDatabases.Add($name) } }
    # Simulate an interrupted provisioning state only in the disposable QA registry.
    $sql = 'UPDATE bufete.tenants SET "Status" = ''Failed'', "IsActive" = false WHERE "Code" = ''{0}'';' -f $b
    docker exec bufete-juridico-umg-postgres-1 psql -U $env:POSTGRES_USER -d $database -c $sql | Out-Null
    if ($LASTEXITCODE) { throw 'No se pudo preparar escenario de reintento.' }
    Api POST /platform/tenants $body $root.accessToken | Out-Null
    Api POST /platform/tenants $body $root.accessToken peten 409
    Api POST /platform/tenants @{ code = '../invalid'; name = 'Inválida' } $root.accessToken peten 400
    $adminA = Api POST /auth/login @{ email = 'admin@example.test'; password = $password } '' $a
    $adminB = Api POST /auth/login @{ email = 'admin@example.test'; password = $password } '' $b
    if ($adminA.user.id -eq $adminB.user.id -or $adminA.user.isPlatformAdmin) { throw 'Identidades no aisladas.' }
    Api GET /users $null $adminA.accessToken $b 401
    Api GET /platform/tenants $null $adminA.accessToken $a 403
    $roles = Api GET /roles $null $adminA.accessToken $a
    $role = $roles | Where-Object name -eq 'Secretaria'
    $secretary = Api POST /users @{ username = 'secretaria-qa'; email = 'secretaria@example.test'; fullName = 'Secretaria QA'; password = $password; roleIds = @($role.id); isPlatformAccount = $true } $adminA.accessToken $a 201
    $secretarySession = Api POST /auth/login @{ email = 'secretaria@example.test'; password = $password } '' $a
    if ($secretarySession.user.isPlatformAdmin) { throw 'Escalamiento de privilegios.' }
    Api GET /users $null $secretarySession.accessToken $a 403
    Api GET "/users/$($secretary.id)" $null $adminB.accessToken $b 404
    $client = Api POST /clients @{ fullName = 'Cliente aislamiento QA'; residenceAddress = 'Dirección QA'; dpi = '1234567890101'; childrenCount = 0; assistanceRequested = 'Consulta QA'; receptionPlace = 'Sede QA'; receptionDate = '2026-10-10' } $adminA.accessToken $a 201
    Api GET "/clients/$($client.id)" $null $adminB.accessToken $b 404
    $clientsB = Api GET /clients $null $adminB.accessToken $b
    if ($clientsB.totalCount -ne 0) { throw 'Registros cruzados.' }
    $entered = Api POST "/platform/tenants/$a/session" $null $root.accessToken
    if ($entered.user.tenantCode -ne $a -or !$entered.user.isPlatformAdmin) { throw 'Cambio de sede incorrecto.' }
    Api GET "/clients/$($client.id)" $null $entered.accessToken $a | Out-Null
    Api GET /users $null $entered.accessToken peten 401
    Api GET "/users/$($root.user.id)" $null $adminA.accessToken $a 404
    Api POST "/users/$($root.user.id)/reset-password" @{ newPassword = $password } $adminA.accessToken $a 404
    Api DELETE "/users/$($root.user.id)" $null $adminA.accessToken $a 404
    Api POST "/users/$($root.user.id)/roles" @{ roleId = $role.id } $adminA.accessToken $a 404
    $users = Api GET /users $null $adminA.accessToken $a
    if ($users.items.id -contains $root.user.id) { throw 'Cuenta global visible para administrador local.' }
    $renewed = Api POST /auth/refresh @{ refreshToken = $entered.refreshToken } '' $a
    if ($renewed.user.tenantCode -ne $a) { throw 'Renovación perdió sede.' }
    Api POST /auth/refresh @{ refreshToken = $adminA.refreshToken } '' $b 401
    $http = [Net.Http.HttpClient]::new()
    $http.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $adminA.accessToken)
    $http.DefaultRequestHeaders.Add('X-Sede-Code', $a)
    $form = [Net.Http.MultipartFormDataContent]::new()
    $photo = [Net.Http.ByteArrayContent]::new([IO.File]::ReadAllBytes("$repo/frontend/public/umg.png"))
    $photo.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::new('image/png')
    $form.Add($photo, 'File', 'qa.png')
    foreach ($pair in @{ ContextType = 'UserPhoto'; ContextId = $secretary.id; Label = 'Foto QA'; Source = 'Upload' }.GetEnumerator()) { $form.Add([Net.Http.StringContent]::new($pair.Value), $pair.Key) }
    $upload = $http.PostAsync("$base/documents", $form).GetAwaiter().GetResult()
    $content = $upload.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if ([int]$upload.StatusCode -ne 201) { throw "Carga fallida: $content" }
    $document = $content | ConvertFrom-Json
    $download = $http.GetAsync("$base/documents/$($document.id)/content").GetAwaiter().GetResult()
    if ([int]$download.StatusCode -ne 200) { throw 'Archivo no recuperable.' }
    $checks += 2
    $form.Dispose(); $http.Dispose()
    Api GET "/documents/$($document.id)" $null $adminB.accessToken $b 404
    Api GET "/documents/$($document.id)/content" $null $adminB.accessToken $b 404
    Api PUT "/platform/tenants/$a" @{ name = 'Sede A actualizada'; isActive = $false } $root.accessToken | Out-Null
    Api GET /clients $null $adminA.accessToken $a 403
    Api POST /auth/login @{ email = 'admin@example.test'; password = $password } '' $a 403
    Api GET /clients $null $adminB.accessToken $b | Out-Null
    Api PUT "/platform/tenants/$a" @{ name = 'Sede A actualizada'; isActive = $true } $root.accessToken | Out-Null
    Api PUT /platform/tenants/peten @{ name = 'Petén'; isActive = $false } $root.accessToken peten 409
    $list = Api GET /platform/tenants $null $root.accessToken
    if (($list | Where-Object code -eq $a).name -ne 'Sede A actualizada') { throw 'Nombre no persistido.' }
    $audit = Api GET '/audit?pageSize=100' $null $root.accessToken
    if ($audit.totalCount -lt 3) { throw 'No hay trazabilidad central.' }
    $platformAudit = Api GET '/audit?entityType=Tenant' $null $root.accessToken
    if ($platformAudit.totalCount -lt 2) { throw 'No hay auditoría global de sedes.' }
    $localAudit = Api GET '/audit?entityType=Tenant' $null $local.accessToken
    if ($localAudit.totalCount -ne 0) { throw 'Auditoría global expuesta al administrador local.' }
    Api POST /users/me/change-password @{ currentPassword = $env:PlatformAdmin__Password; newPassword = $password } $root.accessToken peten 204
    Api GET /clients $null $renewed.accessToken $a 401
    Api POST /auth/refresh @{ refreshToken = $renewed.refreshToken } '' $a 401
    Write-Output "PASS: $checks comprobaciones reales de API, PostgreSQL y MinIO. Evidencia sin credenciales: $artifacts"
}
finally {
    if ($process -and !$process.HasExited) { Stop-Process -Id $process.Id -Force; Wait-Process -Id $process.Id -ErrorAction SilentlyContinue }
    foreach ($owned in $createdDatabases) {
        if ($owned -eq $database -and $owned -match '^bufete_tenancy_qa_[a-f0-9]{12}$' -or $owned -match '^bufete_t_[a-f0-9]{32}$') {
            docker exec bufete-juridico-umg-postgres-1 dropdb -U $env:POSTGRES_USER --force $owned | Out-Null
        }
    }
    if ($env:Storage__S3__KeyPrefix -match '^native-tenancy-e2e/[a-f0-9]{12}$') {
        docker compose exec -T minio sh -c 'mc alias set qa http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm --recursive --force "qa/$1/$2" >/dev/null' -- $env:Storage__S3__BucketName $env:Storage__S3__KeyPrefix
    }
}
