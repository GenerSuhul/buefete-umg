param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [string]$BaseUrl = 'http://127.0.0.1:5103'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Import-BufeteEnvironment -Path (Join-Path $repositoryRoot '.env')

function Send-Json([string]$Method, [string]$Path, [object]$Body, [string]$Token) {
    Invoke-RestMethod -Uri "$BaseUrl$Path" -Method $Method -Headers @{ Authorization = "Bearer $Token" } `
        -ContentType 'application/json; charset=utf-8' -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 30
}

$auth = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json; charset=utf-8' `
    -Body (@{ email = $env:BootstrapAdmin__Email; password = $env:BootstrapAdmin__Password } | ConvertTo-Json) -TimeoutSec 30
$token = $auth.accessToken
$headers = @{ Authorization = "Bearer $token" }
$clientNames = @('Ana Lucia Lopez', 'Carlos Estuardo Mendez', 'Maria Fernanda Ruiz', 'Jose Antonio Garcia', 'Claudia Isabel Perez')
$studentNames = @('Sofia Alejandra Castillo', 'Diego Armando Perez', 'Camila Fernanda Ortiz', 'Luis Fernando Garcia', 'Maria Jose Hernandez')

$clients = (Invoke-RestMethod -Uri "$BaseUrl/api/v1/clients?search=$RunId&page=1&pageSize=25" -Headers $headers -TimeoutSec 30).items | Sort-Object dpi
$students = (Invoke-RestMethod -Uri "$BaseUrl/api/v1/students?search=$RunId&page=1&pageSize=25" -Headers $headers -TimeoutSec 30).items | Sort-Object studentCardNumber
if (@($clients).Count -ne 5 -or @($students).Count -ne 5) { throw 'La corrida no contiene exactamente cinco clientes y cinco alumnos.' }

for ($index = 0; $index -lt 5; $index++) {
    $client = @($clients)[$index]
    $student = @($students)[$index]
    $sequence = $index + 1
    $null = Send-Json Put "/api/v1/clients/$($client.id)" @{
        fullName = "$($clientNames[$index]) - Demo $RunId"; birthDate = $client.birthDate; ageAtReception = $client.ageAtReception
        birthPlace = 'Guatemala'; nationality = 'Guatemalteca'; sex = $client.sex; maritalStatus = 'Soltero(a)'; dpi = $client.dpi
        residenceAddress = "Zona $sequence, Ciudad de Guatemala"; education = 'Diversificado'; occupation = 'Comerciante'; workplace = $null
        workAddress = $null; workPhone = $null; phone = $client.phone; mobilePhone = $client.mobilePhone; salaryAmount = $client.salaryAmount
        salaryFrequency = 'Mensual'; childrenCount = $client.childrenCount; assistanceRequested = 'Asistencia juridica de demostracion'
        receptionPlace = 'Clinica Juridica UMG'; receptionDate = $client.receptionDate; signatureDocumentId = $client.signatureDocumentId
    } $token
    $null = Send-Json Put "/api/v1/students/$($student.id)" @{
        fullName = "$($studentNames[$index]) - Demo $RunId"; birthDate = $student.birthDate; ageAtRegistration = $student.ageAtRegistration
        studentCardNumber = $student.studentCardNumber; dpi = $student.dpi; semester = $student.semester; studyShift = 'Vespertina'; workplace = $null
        workPhone = $null; immediateSupervisor = $null; jobTitle = $null; residenceAddress = "Zona $sequence, Ciudad de Guatemala"
        mobilePhone = $student.mobilePhone; homePhone = $null; email = $student.email; registrationDate = $student.registrationDate
    } $token
}

$cases = (Invoke-RestMethod -Uri "$BaseUrl/api/v1/cases?search=$RunId&page=1&pageSize=25" -Headers $headers -TimeoutSec 30).items
$activities = (Invoke-RestMethod -Uri "$BaseUrl/api/v1/activities?page=1&pageSize=100" -Headers $headers -TimeoutSec 30).items
foreach ($case in $cases) {
    $studentId = $case.assignments[0].studentId
    $null = Send-Json Post "/api/v1/cases/$($case.id)/timeline" @{
        type = 'GeneralAction'; occurredAtUtc = [DateTimeOffset]::UtcNow.ToString('o'); title = 'Datos demostrativos normalizados'
        description = 'Correccion de codificacion de la corrida local'; performedByStudentId = $studentId; documentId = $null
        newStage = $(if ($case.status -eq 'Active') { 'Seguimiento juridico' } else { 'Recoleccion documental' }); newStatus = $null
    } $token
    foreach ($activity in @($activities | Where-Object { $_.legalCaseId -eq $case.id })) {
        $null = Send-Json Put "/api/v1/activities/$($activity.id)/correction" @{
            occurredAtUtc = $activity.occurredAtUtc; activityType = 'Seguimiento de expediente'; description = 'Actividad del escenario demostrativo normalizada'
            clientId = $activity.clientId; studentId = $activity.studentId; legalCaseId = $activity.legalCaseId; correctionReason = 'Normalizacion de codificacion local'
        } $token
    }
}

[pscustomobject]@{ RunId = $RunId; ClientsUpdated = @($clients).Count; StudentsUpdated = @($students).Count; CasesUpdated = @($cases).Count } | ConvertTo-Json
