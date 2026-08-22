param(
    [string]$BaseUrl = 'http://127.0.0.1:5103'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
$artifactDirectory = Join-Path $repositoryRoot '.artifacts\seed'

function Import-EnvironmentFile([string]$Path) {
    if (-not (Test-Path $Path)) { throw 'No existe .env.' }
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        $parts = $line.Split('=', 2)
        if ($parts.Count -eq 2) { [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process') }
    }
}

function Invoke-Api {
    param([string]$Method, [string]$Path, [object]$Body = $null, [string]$Token = '', [int]$ExpectedStatus = 200)
    $parameters = @{ Uri = "$BaseUrl$Path"; Method = $Method; UseBasicParsing = $true; TimeoutSec = 30; ErrorAction = 'Stop' }
    if ($Token) { $parameters.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json; charset=utf-8'
        $jsonBody = $Body | ConvertTo-Json -Depth 12
        $parameters.Body = $jsonBody
        if ($Path -eq '/api/v1/clients') { [IO.File]::WriteAllText((Join-Path $artifactDirectory 'last-client-request.json'), $jsonBody, (New-Object Text.UTF8Encoding($false))) }
    }
    try {
        $response = Invoke-WebRequest @parameters
        $status = [int]$response.StatusCode
        $content = $response.Content
    }
    catch {
        if ($null -eq $_.Exception.Response) { throw }
        $status = [int]$_.Exception.Response.StatusCode
        $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    if ($status -ne $ExpectedStatus) { throw "HTTP $status en $Method $Path; se esperaba $ExpectedStatus. $content" }
    if ([string]::IsNullOrWhiteSpace($content)) { return $null }
    $parsed = $content | ConvertFrom-Json
    if ($parsed -is [System.Array]) {
        foreach ($entry in $parsed) { Write-Output $entry }
        return
    }
    return $parsed
}

function Add-DemoDocument([string]$Token, [Guid]$CaseId, [string]$Label) {
    Add-Type -AssemblyName System.Net.Http
    $pdfPath = Join-Path $artifactDirectory 'demo-document.pdf'
    if (-not (Test-Path $pdfPath)) {
        $bytes = [Text.Encoding]::ASCII.GetBytes("%PDF-1.4`n1 0 obj<</Type/Catalog>>endobj`ntrailer<</Root 1 0 R>>`n%%EOF")
        [IO.File]::WriteAllBytes($pdfPath, $bytes)
    }
    $client = New-Object Net.Http.HttpClient
    $form = New-Object Net.Http.MultipartFormDataContent
    $stream = [IO.File]::OpenRead($pdfPath)
    $file = New-Object Net.Http.StreamContent($stream)
    try {
        $client.DefaultRequestHeaders.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer', $Token)
        $file.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/pdf')
        $form.Add($file, 'File', 'documento-demostracion.pdf')
        $form.Add((New-Object Net.Http.StringContent('Upload')), 'Source')
        $form.Add((New-Object Net.Http.StringContent('LegalCase')), 'ContextType')
        $form.Add((New-Object Net.Http.StringContent($CaseId.ToString())), 'ContextId')
        $form.Add((New-Object Net.Http.StringContent($Label)), 'Label')
        $response = $client.PostAsync("$BaseUrl/api/v1/documents", $form).GetAwaiter().GetResult()
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne 201) { throw "Carga documental HTTP $([int]$response.StatusCode): $content" }
        return $content | ConvertFrom-Json
    }
    finally { $file.Dispose(); $stream.Dispose(); $form.Dispose(); $client.Dispose() }
}

Import-EnvironmentFile $environmentPath
New-Item -ItemType Directory -Force $artifactDirectory | Out-Null
$health = Invoke-WebRequest "$BaseUrl/health/ready" -UseBasicParsing -TimeoutSec 10
if ($health.StatusCode -ne 200) { throw 'La API no está lista.' }

$authentication = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{
    email = $env:BootstrapAdmin__Email
    password = $env:BootstrapAdmin__Password
}
$token = $authentication.accessToken
$catalog = Invoke-RestMethod -Uri "$BaseUrl/api/v1/catalogs/process-types" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 30
$processTypes = @()
foreach ($entry in $catalog) { $processTypes += $entry }
if ($processTypes.Count -lt 1) { throw 'No existen tipos de proceso.' }

$runId = Get-Date -Format 'yyyyMMddHHmmss'
$clientNames = @('Ana Lucia Lopez', 'Carlos Estuardo Mendez', 'Maria Fernanda Ruiz', 'Jose Antonio Garcia', 'Claudia Isabel Perez')
$studentNames = @('Sofia Alejandra Castillo', 'Diego Armando Perez', 'Camila Fernanda Ortiz', 'Luis Fernando Garcia', 'Maria Jose Hernandez')
$created = @()

for ($index = 0; $index -lt 5; $index++) {
    $sequence = $index + 1
    $processType = $processTypes[$index % $processTypes.Count]
    $client = Invoke-Api -Method Post -Path '/api/v1/clients' -Token $token -ExpectedStatus 201 -Body @{
        fullName = "$($clientNames[$index]) - Demo $runId"
        birthDate = "199$index-0$sequence-15"
        ageAtReception = 30 + $index
        birthPlace = 'Guatemala'
        nationality = 'Guatemalteca'
        sex = $(if ($index % 2 -eq 0) { 'F' } else { 'M' })
        maritalStatus = 'Soltero(a)'
        dpi = "DEMO-$runId-$sequence"
        residenceAddress = "Zona $sequence, Ciudad de Guatemala"
        education = 'Diversificado'
        occupation = 'Comerciante'
        workplace = $null
        workAddress = $null
        workPhone = $null
        phone = "55550$($sequence.ToString('000'))"
        mobilePhone = "55551$($sequence.ToString('000'))"
        salaryAmount = 2500 + (250 * $index)
        salaryFrequency = 'Mensual'
        childrenCount = $index % 3
        assistanceRequested = $processType.name
        receptionPlace = 'Clinica Juridica UMG'
        receptionDate = (Get-Date).ToString('yyyy-MM-dd')
        signatureDocumentId = $null
    }
    $null = Invoke-Api -Method Post -Path "/api/v1/clients/$($client.id)/income-declarations" -Token $token -ExpectedStatus 201 -Body @{
        fullName = $client.fullName; declaredAge = 30 + $index; maritalStatus = 'Soltero(a)'; sex = $(if ($index % 2 -eq 0) { 'F' } else { 'M' }); dpi = $client.dpi
        occupation = 'Comerciante'; nationality = 'Guatemalteca'; residenceAddress = $client.residenceAddress; phone = $client.phone; mobilePhone = $client.mobilePhone
        workplace = $null; workAddress = $null; salaryAmount = 2500 + (250 * $index); salaryFrequency = 'Mensual'; place = 'Guatemala'
        declarationDate = (Get-Date).ToString('yyyy-MM-dd'); declaresLimitedResources = $true; signedDocumentId = $null
    }
    $student = Invoke-Api -Method Post -Path '/api/v1/students' -Token $token -ExpectedStatus 201 -Body @{
        fullName = "$($studentNames[$index]) - Demo $runId"
        birthDate = "200$index-0$sequence-10"
        ageAtRegistration = 22 + $index
        studentCardNumber = "CARNET-$runId-$sequence"
        dpi = "ALUMNO-$runId-$sequence"
        semester = 10
        studyShift = 'Vespertina'
        workplace = $null; workPhone = $null; immediateSupervisor = $null; jobTitle = $null
        residenceAddress = "Zona $sequence, Ciudad de Guatemala"
        mobilePhone = "55552$($sequence.ToString('000'))"; homePhone = $null
        email = "demo-$runId-$sequence@example.test"
        registrationDate = (Get-Date).ToString('yyyy-MM-dd')
    }
    $enrollment = Invoke-Api -Method Post -Path "/api/v1/students/$($student.id)/enrollments" -Token $token -ExpectedStatus 201 -Body @{
        modality = 'CivilFamilyCases'; siteName = 'Bufete Juridico UMG'; siteAddress = 'Sede central'; shift = 'Vespertina'; practiceDays = 'Lunes y miercoles'
        startTime = '14:00:00'; endTime = '18:00:00'; startDate = (Get-Date).ToString('yyyy-MM-dd'); endDate = (Get-Date).AddMonths(10).ToString('yyyy-MM-dd')
    }
    $case = Invoke-Api -Method Post -Path '/api/v1/cases' -Token $token -ExpectedStatus 201 -Body @{
        clientId = $client.id; processTypeId = $processType.id; initialStage = 'Recoleccion documental'
        counterparties = @(@{ fullName = "Contraparte demo $sequence"; dpi = $null; residenceAddress = 'Guatemala'; workAddress = $null; phone = $null; notes = 'Registro demostrativo' })
    }
    $caseId = [Guid]$case.summary.id
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$caseId/assignments" -Token $token -ExpectedStatus 201 -Body @{ studentId = $student.id; isPrimary = $true }
    $document = Add-DemoDocument -Token $token -CaseId $caseId -Label "Documento inicial - escenario $sequence"
    if (@($case.requirements).Count -gt 0 -and $index % 2 -eq 1) {
        $requirement = @($case.requirements)[0]
        $null = Invoke-Api -Method Put -Path "/api/v1/cases/$caseId/requirements/$($requirement.id)" -Token $token -Body @{
            status = 'Accepted'; documentId = $document.id; dataValue = $null; conditionMet = $true; documentIssueDate = (Get-Date).ToString('yyyy-MM-dd'); notes = 'Validado para demostracion'
        }
    }
    $newStatus = if ($index -ge 2) { 'Active' } else { $null }
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$caseId/timeline" -Token $token -ExpectedStatus 201 -Body @{
        type = 'GeneralAction'; occurredAtUtc = [DateTimeOffset]::UtcNow.AddMinutes(-$index).ToString('o'); title = "Seguimiento inicial del escenario $sequence"
        description = 'Registro creado para validacion integral local'; performedByStudentId = $student.id; documentId = $document.id
        newStage = $(if ($index -ge 2) { 'Seguimiento juridico' } else { $null }); newStatus = $newStatus
    }
    $null = Invoke-Api -Method Post -Path '/api/v1/activities' -Token $token -ExpectedStatus 201 -Body @{
        occurredAtUtc = [DateTimeOffset]::UtcNow.AddMinutes(-$index).ToString('o'); activityType = 'Seguimiento de expediente'
        description = "Actividad del escenario demostrativo $sequence"; clientId = $client.id; studentId = $student.id; legalCaseId = $caseId; correctionReason = $null
    }
    $created += [pscustomobject]@{ Scenario = $sequence; Client = $client.fullName; Student = $student.fullName; CaseNumber = $case.summary.caseNumber; ProcessType = $processType.name; DocumentId = $document.id }
}

[pscustomobject]@{
    RunId = $runId
    ScenarioCount = $created.Count
    ApiVersion = 'v1'
    Created = $created
} | ConvertTo-Json -Depth 5
