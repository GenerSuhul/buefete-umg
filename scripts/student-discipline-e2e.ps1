param([int]$Port = 5127)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common.ps1')
Import-BufeteEnvironment -Path (Join-Path $root '.env')
$platform = Join-Path $root '.env.platform.local'
if (Test-Path -LiteralPath $platform) { Import-BufeteEnvironment -Path $platform }
$base = "http://127.0.0.1:$Port/api/v1"
function Api([string]$Method, [string]$Path, $Body = $null, [string]$Token = '') {
    $headers = @{ 'X-Sede-Code' = 'peten' }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $parameters = @{ Uri = "$base$Path"; Method = $Method; Headers = $headers; SkipHttpErrorCheck = $true; TimeoutSec = 30 }
    if ($null -ne $Body) { $parameters.ContentType = 'application/json'; $parameters.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
    $response = Invoke-WebRequest @parameters
    $content = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { [string]$response.Content }
    $data = if ($content) { $content | ConvertFrom-Json } else { $null }
    return @{ status = [int]$response.StatusCode; data = $data }
}
function Check($actual, $expected, [string]$label) { if ($actual -ne $expected) { throw "${label}: esperado $expected, recibido $actual" } }
$login = Api 'POST' '/auth/login' @{ email = $env:BootstrapAdmin__Email; password = $env:BootstrapAdmin__Password }
Check $login.status 200 'Login administrador'
$token = $login.data.accessToken
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
$dpiSuffix = '{0:D8}' -f ([int]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() % 100000000))
$student = @{ fullName = "Alumno sanciones QA $suffix"; birthDate = '2000-01-01'; ageAtRegistration = $null; studentCardNumber = "QA-$suffix"; dpi = "33074$dpiSuffix"; semester = $null; studyShift = 'Sábado'; workplace = $null; workPhone = $null; immediateSupervisor = $null; jobTitle = $null; residenceAddress = 'Dirección QA'; mobilePhone = '56857965'; homePhone = $null; registrationDate = '2026-10-27' }
$enrollment = @{ modality = 'CivilFamilyCases'; initialStatus = 'Draft'; siteName = $null; siteAddress = $null; shift = $null; practiceDays = $null; startTime = $null; endTime = $null; startDate = $null; endDate = $null }
$registration = Api 'POST' '/students/registration' @{ student = $student; enrollment = $enrollment; access = $null } $token
Check $registration.status 201 'Alta sin correo ni cuenta'
if ($registration.data.access -ne $null -or $registration.data.student.email -ne '') { throw 'Alta sin acceso o correo no persistió correctamente.' }
$studentId = $registration.data.student.id
$discipline = Api 'POST' "/students/$studentId/disciplines" @{ kind = 'PermanentSuspension'; reason = 'Suspensión definitiva de verificación QA'; startsOn = $null; endsOn = $null; documentId = $null } $token
if ($discipline.status -ne 201) { throw "Crear suspensión HTTP $($discipline.status): $($discipline.data | ConvertTo-Json -Depth 5 -Compress)" }
Check $discipline.status 201 'Crear suspensión definitiva'
$listed = Api 'GET' "/students/$studentId/disciplines" $null $token
Check $listed.status 200 'Listar suspensión'
if ($listed.data.Count -ne 1 -or !$listed.data[0].isBlocking) { throw 'Suspensión global no visible.' }
$blocked = Api 'POST' "/students/$studentId/enrollments" $enrollment $token
Check $blocked.status 409 'Bloqueo de inscripción'
$reactivate = Api 'PUT' "/students/$studentId/active" @{ isActive = $true } $token
Check $reactivate.status 409 'Bloqueo de activación'
$revoke = Api 'POST' "/students/$studentId/disciplines/$($discipline.data.id)/revoke" @{ reason = 'Retiro administrativo de verificación QA' } $token
Check $revoke.status 200 'Retirar suspensión'
$listedAfter = Api 'GET' "/students/$studentId/disciplines" $null $token
if ($listedAfter.data[0].isBlocking -or !$listedAfter.data[0].revokedAtUtc) { throw 'La medida no quedó retirada con historial.' }
$student2 = @{} + $student
$student2.fullName = "Alumno temporal QA $suffix"
$student2.studentCardNumber = "QB-$suffix"
$student2.dpi = "33075$dpiSuffix"
$student2.email = "qa-$suffix@example.test"
$password = 'PruebaAlumno-2026!'
$registered2 = Api 'POST' '/students/registration' @{ student = $student2; enrollment = $enrollment; access = @{ password = $password; participationStartDate = $null; participationEndDate = $null } } $token
Check $registered2.status 201 'Alta con cuenta opcional'
$studentLogin = Api 'POST' '/auth/login' @{ email = $student2.email; password = $password }
Check $studentLogin.status 200 'Acceso inicial del alumno'
$start = ([DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(-6))).ToString('yyyy-MM-dd')
$end = ([DateTime]::ParseExact($start, 'yyyy-MM-dd', $null)).AddMonths(6).ToString('yyyy-MM-dd')
$temporary = Api 'POST' "/students/$($registered2.data.student.id)/disciplines" @{ kind = 'SixMonthSuspension'; reason = 'Suspensión temporal de verificación QA'; startsOn = $start; endsOn = $end; documentId = $null } $token
Check $temporary.status 201 'Crear suspensión temporal'
$blockedSession = Api 'GET' '/auth/me' $null $studentLogin.data.accessToken
Check $blockedSession.status 401 'Revocación de sesión del alumno'
$blockedLogin = Api 'POST' '/auth/login' @{ email = $student2.email; password = $password }
Check $blockedLogin.status 401 'Bloqueo de nuevo login'
$revokeTemporary = Api 'POST' "/students/$($registered2.data.student.id)/disciplines/$($temporary.data.id)/revoke" @{ reason = 'Rehabilitación temporal de verificación QA' } $token
Check $revokeTemporary.status 200 'Retiro temporal'
$restoredLogin = Api 'POST' '/auth/login' @{ email = $student2.email; password = $password }
Check $restoredLogin.status 200 'Acceso restaurado'
$pdfPath = Join-Path $root ".artifacts/amonestacion-$suffix.pdf"
$generator = "const fs=require('fs'); const {PDFDocument}=require('./frontend/node_modules/pdf-lib'); (async()=>{const d=await PDFDocument.create();d.addPage([200,200]);fs.writeFileSync(process.argv[1],await d.save());})().catch(e=>{console.error(e);process.exitCode=1})"
& node -e $generator $pdfPath
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $pdfPath)) { throw 'No se pudo generar PDF QA.' }
$http = [System.Net.Http.HttpClient]::new()
$http.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
$http.DefaultRequestHeaders.Add('X-Sede-Code', 'peten')
$multipart = [System.Net.Http.MultipartFormDataContent]::new()
$content = [System.Net.Http.ByteArrayContent]::new([IO.File]::ReadAllBytes($pdfPath))
$content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/pdf')
$multipart.Add($content, 'File', 'amonestacion.pdf')
$multipart.Add([System.Net.Http.StringContent]::new('Upload'), 'Source')
$multipart.Add([System.Net.Http.StringContent]::new('Student'), 'ContextType')
$multipart.Add([System.Net.Http.StringContent]::new($registered2.data.student.id), 'ContextId')
$multipart.Add([System.Net.Http.StringContent]::new('Amonestación escrita QA'), 'Label')
$uploadedResponse = $http.PostAsync("$base/documents", $multipart).Result
Check ([int]$uploadedResponse.StatusCode) 201 'Carga PDF'
$uploaded = $uploadedResponse.Content.ReadAsStringAsync().Result | ConvertFrom-Json
$written = Api 'POST' "/students/$($registered2.data.student.id)/disciplines" @{ kind = 'WrittenWarning'; reason = 'Amonestación escrita de verificación QA'; startsOn = $null; endsOn = $null; documentId = $uploaded.id } $token
Check $written.status 201 'Amonestación escrita con PDF'
$pdfResponse = $http.GetAsync("$base/students/$($registered2.data.student.id)/disciplines/$($written.data.id)/document").Result
Check ([int]$pdfResponse.StatusCode) 200 'Descarga PDF vinculado'
$downloaded = $pdfResponse.Content.ReadAsByteArrayAsync().Result
if (-not [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($downloaded)).Equals([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($pdfPath))))) { throw 'El PDF descargado no coincide con el firmado.' }
$http.Dispose()
$result = @{ passed = $true; studentId = $studentId; disciplineId = $discipline.data.id; checks = @('alta sin correo/acceso','suspensión persistida','bloqueo inscripción','bloqueo activación','retiro e historial','alta con acceso opcional','bloqueo JWT y login por seis meses','rehabilitación global','amonestación escrita, PDF almacenado y descargado idéntico') }
$artifact = Join-Path $root '.artifacts/student-discipline-e2e.json'
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifact
$result | ConvertTo-Json -Depth 4
