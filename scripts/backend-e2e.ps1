param(
    [int]$Port = 5104,
    [switch]$KeepDatabase,
    [switch]$ProxyS3Downloads
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
$containerName = 'bufete-juridico-umg-postgres-1'
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$numericSeed = [Convert]::ToInt64($suffix, 16) % 10000000000000
$clientDpi = $numericSeed.ToString('D13')
$studentDpi = (($numericSeed + 1) % 10000000000000).ToString('D13')
$rollbackDpi = (($numericSeed + 2) % 10000000000000).ToString('D13')
$databaseName = "bufete_juridico_e2e_$suffix"
$baseUrl = "http://127.0.0.1:$Port"
$apiProcess = $null
$databaseCreated = $false
$artifactDirectory = Join-Path $repositoryRoot ".artifacts\e2e\$suffix"

function Import-EnvironmentFile([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw 'No existe .env. Ejecute .\scripts\bootstrap-local.ps1 primero.'
    }

    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
            continue
        }

        $parts = $line.Split('=', 2)
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
        }
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = '',
        [int]$ExpectedStatus = 200
    )

    $parameters = @{
        Uri = "$baseUrl$Path"
        Method = $Method
        UseBasicParsing = $true
        TimeoutSec = 20
        ErrorAction = 'Stop'
    }

    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $parameters['Headers'] = @{ Authorization = "Bearer $Token" }
    }

    if ($null -ne $Body) {
        $parameters['ContentType'] = 'application/json; charset=utf-8'
        $parameters['Body'] = $Body | ConvertTo-Json -Depth 12
    }

    $status = 0
    $content = ''

    try {
        $response = Invoke-WebRequest @parameters
        $status = [int]$response.StatusCode
        $content = $response.Content
    }
    catch {
        if ($null -eq $_.Exception.Response) {
            throw
        }

        $errorResponse = $_.Exception.Response
        $status = [int]$errorResponse.StatusCode
        if (-not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
            $content = $_.ErrorDetails.Message
        }
        elseif ($errorResponse -is [System.Net.Http.HttpResponseMessage]) {
            try {
                $content = $errorResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }
            catch [System.ObjectDisposedException] {
                $content = ''
            }
        }
        elseif ($errorResponse.PSObject.Methods.Name -contains 'GetResponseStream') {
            $stream = $errorResponse.GetResponseStream()
            if ($null -ne $stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
            }
        }
    }

    if ($status -ne $ExpectedStatus) {
        throw "Se esperaba HTTP $ExpectedStatus para $Method $Path y se recibió $status. Respuesta: $content"
    }

    if ([string]::IsNullOrWhiteSpace($content)) {
        return $null
    }

    $parsed = $content | ConvertFrom-Json
    if ($parsed -is [System.Array]) {
        foreach ($entry in $parsed) {
            Write-Output $entry
        }

        return
    }

    return $parsed
}

function Upload-TestDocument {
    param(
        [string]$Token,
        [Guid]$ContextId,
        [ValidateSet('LegalCase', 'CaseRequirement', 'Memorial', 'Student', 'Enrollment', 'UserPhoto')][string]$ContextType = 'LegalCase',
        [ValidateSet('Pdf', 'Image')][string]$Kind = 'Pdf',
        [string]$Label,
        [Guid]$ReplaceDocumentId = [Guid]::Empty,
        [int]$ExpectedStatus = 201
    )

    Add-Type -AssemblyName System.Net.Http
    if ($Kind -eq 'Image') {
        $filePath = Join-Path $artifactDirectory 'foto-e2e.png'
        $fileBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=')
        $fileName = 'foto-e2e.png'; $mediaType = 'image/png'
        if ([string]::IsNullOrWhiteSpace($Label)) { $Label = 'Fotografía E2E' }
    }
    else {
        $filePath = Join-Path $artifactDirectory 'memorial-e2e.pdf'
        $fileBytes = [System.Text.Encoding]::ASCII.GetBytes("%PDF-1.4`n1 0 obj<</Type/Catalog>>endobj`ntrailer<</Root 1 0 R>>`n%%EOF")
        $fileName = 'memorial-e2e.pdf'; $mediaType = 'application/pdf'
        if ([string]::IsNullOrWhiteSpace($Label)) { $Label = 'Memorial inicial E2E' }
    }
    [System.IO.File]::WriteAllBytes($filePath, $fileBytes)

    $client = New-Object System.Net.Http.HttpClient
    $form = New-Object System.Net.Http.MultipartFormDataContent
    $fileStream = [System.IO.File]::OpenRead($filePath)
    $fileContent = New-Object System.Net.Http.StreamContent($fileStream)

    try {
        $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $Token)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($mediaType)
        $form.Add($fileContent, 'File', $fileName)
        $form.Add((New-Object System.Net.Http.StringContent('Upload')), 'Source')
        $form.Add((New-Object System.Net.Http.StringContent($ContextType)), 'ContextType')
        $form.Add((New-Object System.Net.Http.StringContent($ContextId.ToString())), 'ContextId')
        $form.Add((New-Object System.Net.Http.StringContent($Label)), 'Label')
        if ($ReplaceDocumentId -ne [Guid]::Empty) {
            $form.Add((New-Object System.Net.Http.StringContent($ReplaceDocumentId.ToString())), 'ReplaceDocumentId')
        }

        $response = $client.PostAsync("$baseUrl/api/v1/documents", $form).GetAwaiter().GetResult()
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne $ExpectedStatus) {
            throw "La carga documental devolvió HTTP $([int]$response.StatusCode): $content"
        }

        if ([string]::IsNullOrWhiteSpace($content)) { return $null }
        return $content | ConvertFrom-Json
    }
    finally {
        $fileContent.Dispose()
        $fileStream.Dispose()
        $form.Dispose()
        $client.Dispose()
    }
}

function Upload-ScanCapture {
    param(
        [string]$Token,
        [Guid]$SessionId
    )

    Add-Type -AssemblyName System.Net.Http
    $pdfPath = Join-Path $artifactDirectory "scanner-page-$([Guid]::NewGuid().ToString('N')).png"
    $pdfBytes = [System.IO.File]::ReadAllBytes((Join-Path $repositoryRoot 'frontend\public\umg.png'))
    [System.IO.File]::WriteAllBytes($pdfPath, $pdfBytes)

    $client = New-Object System.Net.Http.HttpClient
    $form = New-Object System.Net.Http.MultipartFormDataContent
    $fileStream = [System.IO.File]::OpenRead($pdfPath)
    $fileContent = New-Object System.Net.Http.StreamContent($fileStream)

    try {
        $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $Token)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('image/png')
        $form.Add($fileContent, 'File', [System.IO.Path]::GetFileName($pdfPath))
        $form.Add((New-Object System.Net.Http.StringContent([Guid]::NewGuid().ToString())), 'ClientPageId')
        $form.Add((New-Object System.Net.Http.StringContent('Scanner')), 'Source')
        $form.Add((New-Object System.Net.Http.StringContent('1')), 'WidthPixels')
        $form.Add((New-Object System.Net.Http.StringContent('1')), 'HeightPixels')

        $response = $client.PostAsync("$baseUrl/api/v1/scan-sessions/$SessionId/pages", $form).GetAwaiter().GetResult()
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne 200) {
            throw "La captura de escáner devolvió HTTP $([int]$response.StatusCode): $content"
        }

        return $content | ConvertFrom-Json
    }
    finally {
        $fileContent.Dispose()
        $fileStream.Dispose()
        $form.Dispose()
        $client.Dispose()
    }
}

Import-EnvironmentFile $environmentPath
if ($ProxyS3Downloads -and $env:Storage__Provider -eq 'S3') {
    $env:Storage__S3__UsePresignedUrls = 'false'
}

if ($databaseName -notmatch '^bufete_juridico_e2e_[a-f0-9]{12}$') {
    throw 'El nombre de la base temporal no superó la validación de seguridad.'
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "El puerto $Port ya está ocupado."
}

& dotnet restore 'src\BufeteJuridico.Api\BufeteJuridico.Api.csproj' --locked-mode
if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar la API para E2E.' }
& dotnet build 'src\BufeteJuridico.Api\BufeteJuridico.Api.csproj' --configuration Release --no-restore
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la API para E2E.' }

New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null

try {
    & docker exec $containerName createdb -U $env:POSTGRES_USER $databaseName
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base temporal E2E.' }
    $databaseCreated = $true

    $env:ConnectionStrings__BufeteDb = "Host=127.0.0.1;Port=$($env:POSTGRES_PORT);Database=$databaseName;Username=$($env:POSTGRES_USER);Password=$($env:POSTGRES_PASSWORD)"
    $env:Database__ApplyMigrationsOnStartup = 'true'
    $env:ASPNETCORE_URLS = $baseUrl
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:RateLimiting__Authentication__PermitLimit = '100'
    $env:Storage__RootPath = Join-Path $artifactDirectory 'files'
    if ($env:Storage__Provider -eq 'S3') {
        $env:Storage__S3__KeyPrefix = "bufete-e2e/$suffix"
    }

    $stdoutPath = Join-Path $artifactDirectory 'api.stdout.log'
    $stderrPath = Join-Path $artifactDirectory 'api.stderr.log'
    $apiProcess = Start-Process `
        -FilePath 'dotnet' `
        -ArgumentList @('run', '--project', 'src\BufeteJuridico.Api', '--configuration', 'Release', '--no-build', '--no-launch-profile') `
        -WorkingDirectory $repositoryRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -WindowStyle Hidden `
        -PassThru

    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        if ($apiProcess.HasExited) { break }
        try {
            $health = Invoke-WebRequest -Uri "$baseUrl/health/ready" -UseBasicParsing -TimeoutSec 10
            if ($health.StatusCode -eq 200) { $ready = $true; break }
        }
        catch { Start-Sleep -Milliseconds 500 }
    }

    if (-not $ready) {
        $output = Get-Content $stdoutPath -Tail 50 -ErrorAction SilentlyContinue
        $errorOutput = Get-Content $stderrPath -Tail 50 -ErrorAction SilentlyContinue
        throw "La API E2E no alcanzó readiness. STDOUT: $($output -join ' | ') STDERR: $($errorOutput -join ' | ')"
    }

    $adminLogin = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{
        email = $env:BootstrapAdmin__Email
        password = $env:BootstrapAdmin__Password
    }
    $adminToken = $adminLogin.accessToken
    $adminProfile = Invoke-Api -Method Get -Path '/api/v1/auth/me' -Token $adminToken
    if ($adminProfile.username -ne $env:BootstrapAdmin__Username) { throw 'El perfil autenticado no corresponde al administrador inicial.' }
    $roles = @(Invoke-Api -Method Get -Path '/api/v1/roles' -Token $adminToken)
    $studentRole = $roles | Where-Object { $_.name -eq 'Alumno' } | Select-Object -First 1
    if ($null -eq $studentRole) { throw 'No se sembró el rol Alumno.' }
    $permissions = @(Invoke-Api -Method Get -Path '/api/v1/roles/permissions' -Token $adminToken)
    if ($permissions.Count -lt 1) { throw 'No se obtuvo el catálogo de permisos.' }
    $customRole = Invoke-Api -Method Post -Path '/api/v1/roles' -Token $adminToken -ExpectedStatus 201 -Body @{
        name = "Rol E2E $suffix"; description = 'Rol temporal de cobertura contractual'; permissionCodes = @($permissions[0].code)
    }
    $customRole = Invoke-Api -Method Put -Path "/api/v1/roles/$($customRole.id)" -Token $adminToken -Body @{
        description = 'Rol temporal actualizado'; isActive = $true; permissionCodes = @($permissions[0].code)
    }

    $processTypes = @(Invoke-Api -Method Get -Path '/api/v1/catalogs/process-types' -Token $adminToken)
    if ($processTypes.Count -ne 7) { throw "Se esperaban 7 tipos de proceso y se encontraron $($processTypes.Count)." }
    $processType = $processTypes | Where-Object { $_.code -eq 'FIJACION_PENSION' } | Select-Object -First 1
    $null = Invoke-Api -Method Get -Path "/api/v1/catalogs/process-types/$($processType.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path '/api/v1/catalogs/student-requirements' -Token $adminToken
    $temporaryProcessType = Invoke-Api -Method Post -Path '/api/v1/catalogs/process-types' -Token $adminToken -ExpectedStatus 201 -Body @{
        code = "E2E_$suffix"; name = "Proceso E2E $suffix"; description = 'Proceso temporal de validación'; isActive = $true
    }
    $temporaryProcessType = Invoke-Api -Method Put -Path "/api/v1/catalogs/process-types/$($temporaryProcessType.id)" -Token $adminToken -Body @{
        code = "E2E_$suffix"; name = "Proceso E2E $suffix"; description = 'Proceso temporal actualizado'; isActive = $true
    }
    $temporaryRequirement = Invoke-Api -Method Post -Path '/api/v1/catalogs/requirements' -Token $adminToken -ExpectedStatus 201 -Body @{
        scope = 'Process'; processTypeId = $temporaryProcessType.id; code = "REQ_$suffix"; label = 'Requisito E2E'; kind = 'Document'
        isRequired = $true; isConditional = $false; conditionDescription = $null; documentNature = 'Copy'; maximumAgeDays = $null
        subject = $null; instructions = 'Cobertura contractual'; sortOrder = 1; isActive = $true
    }
    $null = Invoke-Api -Method Put -Path "/api/v1/catalogs/requirements/$($temporaryRequirement.id)" -Token $adminToken -Body @{
        scope = 'Process'; processTypeId = $temporaryProcessType.id; code = "REQ_$suffix"; label = 'Requisito E2E actualizado'; kind = 'Document'
        isRequired = $true; isConditional = $false; conditionDescription = $null; documentNature = 'Copy'; maximumAgeDays = $null
        subject = $null; instructions = 'Cobertura contractual actualizada'; sortOrder = 1; isActive = $true
    }

    $client = Invoke-Api -Method Post -Path '/api/v1/clients' -Token $adminToken -ExpectedStatus 201 -Body @{
        fullName = "Cliente E2E $suffix"
        birthDate = '1990-01-15'
        ageAtReception = 36
        birthPlace = 'Guatemala'
        nationality = 'Guatemalteca'
        sex = 'F'
        maritalStatus = 'Soltera'
        dpi = $clientDpi
        residenceAddress = 'Dirección de prueba controlada'
        education = 'Diversificado'
        occupation = 'Comerciante'
        workplace = $null
        workAddress = $null
        workPhone = $null
        phone = '55550000'
        mobilePhone = '55550001'
        salaryAmount = 2500
        salaryFrequency = 'Mensual'
        childrenCount = 1
        assistanceRequested = 'Fijación de pensión alimenticia'
        receptionPlace = 'Clínica Jurídica UMG'
        receptionDate = (Get-Date).ToString('yyyy-MM-dd')
        signatureDocumentId = $null
    }

    $originalClientToken = $client.concurrencyToken
    $client = Invoke-Api -Method Put -Path "/api/v1/clients/$($client.id)/attention" -Token $adminToken -Body @{ isActive = $false; concurrencyToken = $originalClientToken }
    $inactiveClient = Invoke-Api -Method Get -Path "/api/v1/clients/$($client.id)" -Token $adminToken
    if ($inactiveClient.isActive) { throw 'La baja de atención no persistió.' }
    $activeList = Invoke-Api -Method Get -Path "/api/v1/clients?search=$suffix" -Token $adminToken
    $inactiveList = Invoke-Api -Method Get -Path "/api/v1/clients?search=$suffix&isActive=false" -Token $adminToken
    if ($activeList.totalCount -ne 0 -or $inactiveList.totalCount -ne 1) { throw 'El filtro de atención mezcla personas activas e inactivas.' }
    $null = Invoke-Api -Method Put -Path "/api/v1/clients/$($client.id)/attention" -Token $adminToken -ExpectedStatus 409 -Body @{ isActive = $true; concurrencyToken = $originalClientToken }
    $null = Invoke-Api -Method Post -Path '/api/v1/cases' -Token $adminToken -ExpectedStatus 404 -Body @{ clientId = $client.id; processTypeId = $processType.id }
    $client = Invoke-Api -Method Put -Path "/api/v1/clients/$($client.id)/attention" -Token $adminToken -Body @{ isActive = $true; concurrencyToken = $client.concurrencyToken }
    if (-not $client.isActive) { throw 'La reactivación no persistió.' }

    $declaration = Invoke-Api -Method Post -Path "/api/v1/clients/$($client.id)/income-declarations" -Token $adminToken -ExpectedStatus 201 -Body @{
        fullName = $client.fullName
        declaredAge = 36
        maritalStatus = 'Soltera'
        sex = 'F'
        dpi = $client.dpi
        occupation = 'Comerciante'
        nationality = 'Guatemalteca'
        residenceAddress = 'Dirección de prueba controlada'
        phone = '55550000'
        mobilePhone = '55550001'
        workplace = $null
        workAddress = $null
        salaryAmount = 2500
        salaryFrequency = 'Mensual'
        place = 'Guatemala'
        declarationDate = (Get-Date).ToString('yyyy-MM-dd')
        declaresLimitedResources = $true
        signedDocumentId = $null
    }
    $null = Invoke-Api -Method Get -Path "/api/v1/clients?search=$suffix&page=1&pageSize=10" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/clients/$($client.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/clients/$($client.id)/profile" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/clients/$($client.id)/income-declarations" -Token $adminToken
    $declarationPrint = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/clients/income-declarations/$($declaration.id)/print" -Headers @{ Authorization = "Bearer $adminToken" }
    if ([int]$declarationPrint.StatusCode -ne 200 -or $declarationPrint.Headers['Content-Type'] -notlike 'text/html*') { throw 'La declaración imprimible no está disponible.' }
    $clientUpdateBody = @{
        fullName = $client.fullName; birthDate = $client.birthDate; ageAtReception = $client.ageAtReception; birthPlace = $client.birthPlace
        nationality = $client.nationality; sex = $client.sex; maritalStatus = $client.maritalStatus; dpi = $client.dpi
        residenceAddress = $client.residenceAddress; education = $client.education; occupation = $client.occupation; workplace = $client.workplace
        workAddress = $client.workAddress; workPhone = $client.workPhone; phone = $client.phone; mobilePhone = $client.mobilePhone
        salaryAmount = $client.salaryAmount; salaryFrequency = $client.salaryFrequency; childrenCount = $client.childrenCount
        assistanceRequested = "$($client.assistanceRequested) actualizada"; receptionPlace = $client.receptionPlace; receptionDate = $client.receptionDate
        signatureDocumentId = $client.signatureDocumentId; concurrencyToken = $client.concurrencyToken
    }
    $client = Invoke-Api -Method Put -Path "/api/v1/clients/$($client.id)" -Token $adminToken -Body $clientUpdateBody
    $staleClientUpdateBody = $clientUpdateBody.Clone()
    $staleClientUpdateBody.assistanceRequested = 'Cambio obsoleto que no debe persistir'
    $null = Invoke-Api -Method Put -Path "/api/v1/clients/$($client.id)" -Token $adminToken -ExpectedStatus 409 -Body $staleClientUpdateBody

    $rollbackMarker = "rollback-$suffix"
    $null = Invoke-Api -Method Post -Path '/api/v1/students/registration' -Token $adminToken -ExpectedStatus 400 -Body @{
        student = @{
            fullName = "Alumno $rollbackMarker"; birthDate = $null; ageAtRegistration = $null
            studentCardNumber = "RB-$suffix"; dpi = $rollbackDpi; semester = 9; studyShift = 'Matutina'
            workplace = $null; workPhone = $null; immediateSupervisor = $null; jobTitle = $null
            residenceAddress = 'Dirección rollback'; mobilePhone = $null; homePhone = $null
            email = "$rollbackMarker@example.test"; registrationDate = (Get-Date).ToString('yyyy-MM-dd')
        }
        enrollment = @{ modality = 'CivilFamilyCases'; initialStatus = 'Draft'; siteName = 'Bufete Popular UMG'; shift = 'Matutina' }
        access = @{ password = 'débil'; participationStartDate = $null; participationEndDate = $null }
    }
    $rollbackSearch = Invoke-Api -Method Get -Path "/api/v1/students?search=$rollbackMarker&page=1&pageSize=10" -Token $adminToken
    if ($rollbackSearch.totalCount -ne 0) { throw 'La inscripción fallida dejó un alumno huérfano.' }

    $studentPassword = 'studentx'
    $registration = Invoke-Api -Method Post -Path '/api/v1/students/registration' -Token $adminToken -ExpectedStatus 201 -Body @{
        student = @{
            fullName = "Alumno E2E $suffix"; birthDate = '2000-02-10'; ageAtRegistration = 26
            studentCardNumber = "CAR-$suffix"; dpi = $studentDpi; semester = 10; studyShift = 'Vespertina'
            workplace = $null; workPhone = $null; immediateSupervisor = $null; jobTitle = $null
            residenceAddress = 'Dirección alumno E2E'; mobilePhone = '55551111'; homePhone = $null
            email = "alumno-$suffix@example.test"; registrationDate = (Get-Date).ToString('yyyy-MM-dd')
        }
        enrollment = @{
            modality = 'CivilFamilyCases'; initialStatus = 'Draft'; siteName = 'Bufete Popular UMG'; siteAddress = 'Sede de prueba'; shift = 'Vespertina'
            practiceDays = 'Lunes'; startTime = '14:00:00'; endTime = '18:00:00'
            startDate = (Get-Date).ToString('yyyy-MM-dd'); endDate = (Get-Date).AddMonths(10).ToString('yyyy-MM-dd')
        }
        access = @{
            password = $studentPassword
            participationStartDate = (Get-Date).ToString('yyyy-MM-dd'); participationEndDate = (Get-Date).AddMonths(10).ToString('yyyy-MM-dd')
        }
    }
    $student = $registration.student
    $enrollment = $registration.enrollment
    $studentUser = Invoke-Api -Method Get -Path "/api/v1/users/$($registration.access.userAccountId)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/students?search=$suffix&page=1&pageSize=10" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)/profile" -Token $adminToken
    $studentUpdateBody = @{
        fullName = $student.fullName; birthDate = '1968-08-21'; ageAtRegistration = $null
        studentCardNumber = $student.studentCardNumber; dpi = $student.dpi; semester = $student.semester; studyShift = $student.studyShift
        workplace = 'Práctica supervisada E2E'; workPhone = $student.workPhone; immediateSupervisor = $student.immediateSupervisor; jobTitle = $student.jobTitle
        residenceAddress = $student.residenceAddress; mobilePhone = $student.mobilePhone; homePhone = $student.homePhone
        email = $student.email; registrationDate = $student.registrationDate; concurrencyToken = $student.concurrencyToken
    }
    $student = Invoke-Api -Method Put -Path "/api/v1/students/$($student.id)" -Token $adminToken -Body $studentUpdateBody
    $studentAfterReload = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)" -Token $adminToken
    if ($studentAfterReload.birthDate -ne '1968-08-21') { throw 'La fecha histórica del alumno no persistió exactamente como DateOnly.' }
    $staleStudentUpdateBody = $studentUpdateBody.Clone()
    $staleStudentUpdateBody.workplace = 'Cambio obsoleto que no debe persistir'
    $null = Invoke-Api -Method Put -Path "/api/v1/students/$($student.id)" -Token $adminToken -ExpectedStatus 409 -Body $staleStudentUpdateBody
    foreach ($studentRequirement in @($enrollment.requirements)) {
        $requirementDocument = if ($studentRequirement.isConditional) {
            $null
        }
        else {
            Upload-TestDocument -Token $adminToken -ContextId $enrollment.id -ContextType Enrollment -Label $studentRequirement.label
        }
        $enrollment = Invoke-Api -Method Put -Path "/api/v1/students/enrollments/$($enrollment.id)/requirements/$($studentRequirement.id)" -Token $adminToken -Body @{
            status = if ($studentRequirement.isConditional) { 'NotApplicable' } else { 'Accepted' }
            documentId = if ($requirementDocument) { $requirementDocument.id } else { $null }
            dataValue = $null
            documentIssueDate = if ($requirementDocument) { (Get-Date).ToString('yyyy-MM-dd') } else { $null }
            notes = 'Cobertura E2E'
        }
    }
    foreach ($enrollmentStatus in @('Submitted', 'Admitted', 'UnderReview', 'Approved')) {
        $enrollment = Invoke-Api -Method Put -Path "/api/v1/students/enrollments/$($enrollment.id)/status" -Token $adminToken -Body @{
            status = $enrollmentStatus; resolutionNotes = 'Transición E2E'; resolutionDocumentId = $null
        }
    }
    $enrollment = Invoke-Api -Method Put -Path "/api/v1/students/enrollments/$($enrollment.id)/clinic-card" -Token $adminToken -Body @{
        cardNumber = "CLINIC-$suffix"; issuedDate = (Get-Date).ToString('yyyy-MM-dd'); expirationDate = (Get-Date).AddYears(1).ToString('yyyy-MM-dd'); markDelivered = $true
    }

    $null = Invoke-Api -Method Get -Path "/api/v1/users?search=$suffix&page=1&pageSize=10" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/users/$($studentUser.id)" -Token $adminToken
    $null = Invoke-Api -Method Post -Path "/api/v1/users/$($adminProfile.id)/roles" -Token $adminToken -ExpectedStatus 409 -Body @{
        roleId = $studentRole.id; validFromUtc = $null; validUntilUtc = $null
    }
    $null = Invoke-Api -Method Delete -Path "/api/v1/users/$($studentUser.id)/roles/$($studentRole.id)" -Token $adminToken -ExpectedStatus 409
    $null = Invoke-Api -Method Put -Path "/api/v1/users/$($studentUser.id)" -Token $adminToken -ExpectedStatus 409 -Body @{
        email = $studentUser.email; fullName = $studentUser.fullName; isActive = $true
        participationStartDate = $studentUser.participationStartDate; participationEndDate = $studentUser.participationEndDate; roleIds = @($studentRole.id)
    }
    $null = Invoke-Api -Method Post -Path "/api/v1/users/$($studentUser.id)/roles" -Token $adminToken -ExpectedStatus 204 -Body @{
        roleId = $customRole.id; validFromUtc = [DateTimeOffset]::UtcNow.ToString('o'); validUntilUtc = [DateTimeOffset]::UtcNow.AddDays(1).ToString('o')
    }
    $null = Invoke-Api -Method Delete -Path "/api/v1/users/$($studentUser.id)/roles/$($customRole.id)" -Token $adminToken -ExpectedStatus 204
    $studentPhotoDocument = Upload-TestDocument -Token $adminToken -ContextId $studentUser.id -ContextType UserPhoto -Kind Image -Label 'Fotografía de perfil'
    $studentIdentityDocument = Upload-TestDocument -Token $adminToken -ContextId $student.id -ContextType Student -Label 'Documento de identificación del alumno'
    $studentUser = Invoke-Api -Method Put -Path "/api/v1/users/$($studentUser.id)/photo" -Token $adminToken -Body @{ documentId = $studentPhotoDocument.id }
    if ($studentUser.photoDocumentId -ne $studentPhotoDocument.id) { throw 'La fotografía del alumno no quedó vinculada a su usuario.' }

    $legalCase = Invoke-Api -Method Post -Path '/api/v1/cases' -Token $adminToken -ExpectedStatus 201 -Body @{
        clientId = $client.id
        processTypeId = $processType.id
        initialStage = 'RecoleccionDocumental'
        counterparties = @(@{
            fullName = 'Contraparte E2E'
            dpi = $null
            residenceAddress = 'Dirección contraparte'
            workAddress = $null
            phone = $null
            notes = 'Dato de prueba'
        })
    }
    $caseUpdateBody = @{
        status = $legalCase.summary.status
        stage = 'Recolección documental E2E'
        concurrencyToken = $legalCase.summary.concurrencyToken
    }
    $legalCase = Invoke-Api -Method Put -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken -Body $caseUpdateBody
    $staleCaseUpdateBody = $caseUpdateBody.Clone()
    $staleCaseUpdateBody.stage = 'Etapa obsoleta que no debe persistir'
    $null = Invoke-Api -Method Put -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken -ExpectedStatus 409 -Body $staleCaseUpdateBody
    $null = Invoke-Api -Method Get -Path "/api/v1/cases?search=$suffix&page=1&pageSize=10" -Token $adminToken
    $additionalCounterparty = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/counterparties" -Token $adminToken -ExpectedStatus 201 -Body @{
        fullName = 'Segunda contraparte E2E'; dpi = $null; residenceAddress = 'Guatemala'; workAddress = $null; phone = $null; notes = 'Alta E2E'
    }
    $null = Invoke-Api -Method Put -Path "/api/v1/cases/$($legalCase.summary.id)/counterparties/$($additionalCounterparty.id)" -Token $adminToken -Body @{
        fullName = 'Segunda contraparte E2E actualizada'; dpi = $null; residenceAddress = 'Guatemala'; workAddress = $null; phone = $null; notes = 'Actualización E2E'
    }

    $assignmentCandidates = Invoke-Api -Method Get -Path "/api/v1/students/assignment-candidates?caseId=$($legalCase.summary.id)&search=$suffix&page=1&pageSize=1" -Token $adminToken
    if ($assignmentCandidates.page -ne 1 -or $assignmentCandidates.pageSize -ne 1 -or $assignmentCandidates.totalCount -ne 1 -or @($assignmentCandidates.items).Count -ne 1 -or $assignmentCandidates.items[0].id -ne $student.id) {
        throw 'El alumno elegible no apareció en el contrato paginado de candidatos.'
    }
    $assignment = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/assignments" -Token $adminToken -ExpectedStatus 201 -Body @{
        studentId = $student.id
        isPrimary = $true
    }
    $assignedStudentProfile = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)/profile" -Token $adminToken
    $studentCaseAssignment = @($assignedStudentProfile.cases | Where-Object { $_.caseId -eq $legalCase.summary.id })[0]
    if ($null -eq $studentCaseAssignment -or $studentCaseAssignment.assignmentId -ne $assignment.id -or $studentCaseAssignment.assignmentStatus -ne 'Active') {
        throw 'La asignación no quedó visible y activa desde el perfil del alumno.'
    }
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/timeline" -Token $adminToken -ExpectedStatus 201 -Body @{
        type = 'GeneralAction'; occurredAtUtc = [DateTimeOffset]::UtcNow.ToString('o'); title = 'Paso general E2E'
        description = 'Cobertura de línea de tiempo'; performedByStudentId = $student.id; documentId = $null; newStage = $null; newStatus = $null
    }

    $studentLogin = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{
        email = $studentUser.email
        password = $studentPassword
    }
    $studentToken = $studentLogin.accessToken
    $ownStudents = Invoke-Api -Method Get -Path '/api/v1/students?page=1&pageSize=10' -Token $studentToken
    if ($ownStudents.totalCount -ne 1 -or $ownStudents.items[0].id -ne $student.id) { throw 'El alumno pudo consultar perfiles ajenos o no encontró su perfil.' }
    $null = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)/profile" -Token $studentToken
    $assignedCases = Invoke-Api -Method Get -Path '/api/v1/cases?page=1&pageSize=10' -Token $studentToken
    if ($assignedCases.totalCount -ne 1 -or $assignedCases.items[0].id -ne $legalCase.summary.id) { throw 'El alumno pudo consultar casos no asignados o no encontró su caso.' }
    $null = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $studentToken
    $null = Invoke-Api -Method Get -Path '/api/v1/clients' -Token $studentToken -ExpectedStatus 403
    $null = Invoke-Api -Method Put -Path "/api/v1/clients/$($client.id)/attention" -Token $studentToken -ExpectedStatus 403 -Body @{ isActive = $false; concurrencyToken = $client.concurrencyToken }
    $null = Invoke-Api -Method Put -Path "/api/v1/students/$($student.id)" -Token $studentToken -ExpectedStatus 403 -Body @{
        fullName = $student.fullName; studentCardNumber = $student.studentCardNumber; dpi = $student.dpi
        residenceAddress = $student.residenceAddress; email = $student.email; registrationDate = $student.registrationDate
    }
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/timeline" -Token $studentToken -ExpectedStatus 403 -Body @{
        type = 'GeneralAction'; occurredAtUtc = [DateTimeOffset]::UtcNow.ToString('o'); title = 'Intento no autorizado'
        description = 'Debe ser rechazado'; performedByStudentId = $student.id
    }
    $null = Invoke-Api -Method Post -Path '/api/v1/scan-sessions' -Token $studentToken -ExpectedStatus 403 -Body @{
        contextType = 'LegalCase'
        contextId = $legalCase.summary.id
        label = 'Escaneo no autorizado'
        acquisitionProvider = 'WIA'
    }

    $scanSession = Invoke-Api -Method Post -Path '/api/v1/scan-sessions' -Token $adminToken -ExpectedStatus 201 -Body @{
        contextType = 'LegalCase'
        contextId = $legalCase.summary.id
        label = 'Documento escaneado E2E'
        acquisitionProvider = 'WIA'
        deviceId = 'WIA-E2E-001'
        deviceName = 'Scanner de prueba E2E'
        resolutionDpi = 300
        colorMode = 'Grayscale'
        duplex = $true
    }
    $null = Invoke-Api -Method Get -Path "/api/v1/scan-sessions/$($scanSession.id)" -Token $adminToken
    $scanSession = Upload-ScanCapture -Token $adminToken -SessionId $scanSession.id
    $scanSession = Upload-ScanCapture -Token $adminToken -SessionId $scanSession.id
    $scanSession = Upload-ScanCapture -Token $adminToken -SessionId $scanSession.id
    if ($scanSession.status -ne 'Captured' -or $scanSession.pageCount -ne 3) { throw 'La sesión no registró correctamente las páginas.' }
    $drafts = @(Invoke-Api -Method Get -Path '/api/v1/scan-sessions' -Token $adminToken)
    if (-not ($drafts | Where-Object { $_.id -eq $scanSession.id })) { throw 'El borrador multipágina no pudo recuperarse.' }
    $pageIds = @($scanSession.pages | Sort-Object position | ForEach-Object { $_.id })
    $scanSession = Invoke-Api -Method Put -Path "/api/v1/scan-sessions/$($scanSession.id)/pages/$($pageIds[0])/rotation" -Token $adminToken -Body @{ rotationDegrees = 90 }
    $scanSession = Invoke-Api -Method Put -Path "/api/v1/scan-sessions/$($scanSession.id)/pages/order" -Token $adminToken -Body @{ pageIds = @($pageIds[1], $pageIds[0], $pageIds[2]) }
    $null = Invoke-Api -Method Delete -Path "/api/v1/scan-sessions/$($scanSession.id)/pages/$($pageIds[2])" -Token $adminToken
    $scanSession = Invoke-Api -Method Post -Path "/api/v1/scan-sessions/$($scanSession.id)/draft" -Token $adminToken
    if ($scanSession.pageCount -ne 2) { throw 'Eliminar/reordenar páginas no actualizó el borrador.' }
    if ([DateTimeOffset]$scanSession.expiresAtUtc -lt [DateTimeOffset]::UtcNow.AddDays(29)) { throw 'Guardar el borrador no respetó la retención configurada.' }
    $pagePreview = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/scan-sessions/$($scanSession.id)/pages/$($pageIds[0])/content" -Headers @{ Authorization = "Bearer $adminToken" }
    if ([int]$pagePreview.StatusCode -ne 200 -or $pagePreview.Headers['Content-Type'] -notlike 'image/png*') { throw 'La página individual no se pudo consultar.' }
    $preview = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/scan-sessions/$($scanSession.id)/preview" -Headers @{ Authorization = "Bearer $adminToken" }
    if ([int]$preview.StatusCode -ne 200 -or $preview.Headers['Content-Type'] -notlike 'application/pdf*') { throw 'La previsualización del escaneo no está disponible.' }
    $scannedDocument = Invoke-Api -Method Post -Path "/api/v1/scan-sessions/$($scanSession.id)/complete" -Token $adminToken
    if ($scannedDocument.source -ne 'Scanner' -or $scannedDocument.contextId -ne $legalCase.summary.id) { throw 'El escaneo no se convirtió en documento del expediente.' }

    $caseRequirement = @($legalCase.requirements) | Select-Object -First 1
    if ($null -ne $caseRequirement) {
        $requirementScan = Invoke-Api -Method Post -Path '/api/v1/scan-sessions' -Token $adminToken -ExpectedStatus 201 -Body @{
            contextType = 'CaseRequirement'; contextId = $caseRequirement.id; label = $caseRequirement.label
            acquisitionProvider = 'BrowserImport'; resolutionDpi = 300; colorMode = 'Color'; duplex = $false
        }
        $requirementScan = Upload-ScanCapture -Token $adminToken -SessionId $requirementScan.id
        $null = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/scan-sessions/$($requirementScan.id)/preview" -Headers @{ Authorization = "Bearer $adminToken" }
        $requirementScanDocument = Invoke-Api -Method Post -Path "/api/v1/scan-sessions/$($requirementScan.id)/complete" -Token $adminToken
        $caseAfterRequirementScan = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken
        $linkedRequirement = @($caseAfterRequirementScan.requirements) | Where-Object { $_.id -eq $caseRequirement.id } | Select-Object -First 1
        if ($linkedRequirement.documentId -ne $requirementScanDocument.id -or $linkedRequirement.status -ne 'Submitted') {
            throw 'El escaneo del requisito no quedó asociado atómicamente al checklist.'
        }
    }
    $cancelSession = Invoke-Api -Method Post -Path '/api/v1/scan-sessions' -Token $adminToken -ExpectedStatus 201 -Body @{
        contextType = 'LegalCase'; contextId = $legalCase.summary.id; label = 'Cancelación E2E'; acquisitionProvider = 'WIA'
        deviceId = 'WIA-E2E-002'; deviceName = 'Scanner E2E'; resolutionDpi = 300; colorMode = 'Grayscale'; duplex = $false
    }
    $cancelSession = Invoke-Api -Method Post -Path "/api/v1/scan-sessions/$($cancelSession.id)/cancel" -Token $adminToken
    if ($cancelSession.status -ne 'Cancelled') { throw 'La cancelación del escaneo no quedó registrada.' }
    $failureSession = Invoke-Api -Method Post -Path '/api/v1/scan-sessions' -Token $adminToken -ExpectedStatus 201 -Body @{
        contextType = 'LegalCase'; contextId = $legalCase.summary.id; label = 'Fallo E2E'; acquisitionProvider = 'WIA'
        deviceId = 'WIA-E2E-003'; deviceName = 'Scanner E2E'; resolutionDpi = 300; colorMode = 'Grayscale'; duplex = $false
    }
    $failureSession = Invoke-Api -Method Post -Path "/api/v1/scan-sessions/$($failureSession.id)/failure" -Token $adminToken -Body @{ code = 'DEVICE_OFFLINE'; message = 'Fallo controlado E2E' }
    if ($failureSession.status -ne 'Failed') { throw 'El fallo del escaneo no quedó registrado.' }

    $document = Upload-TestDocument -Token $adminToken -ContextId $legalCase.summary.id
    $imageDocument = Upload-TestDocument -Token $adminToken -ContextId $legalCase.summary.id -Kind Image
    if ($imageDocument.contentType -ne 'image/png') { throw 'La imagen PNG no conservó su tipo de contenido.' }
    if ($ProxyS3Downloads) {
        $readAccess = Invoke-Api -Method Get -Path "/api/v1/documents/$($imageDocument.id)/access" -Token $adminToken
        if ($readAccess.url) { throw 'La API publicó una URL interna de MinIO en lugar de entregar el archivo autenticado.' }
        $imageDownload = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/documents/$($imageDocument.id)/content" -Headers @{ Authorization = "Bearer $adminToken" }
        if ([int]$imageDownload.StatusCode -ne 200 -or $imageDownload.Headers['Content-Type'] -notlike 'image/png*') {
            throw 'La imagen no se descargó por el flujo autenticado de la API.'
        }
    }
    $replacementImage = Upload-TestDocument -Token $adminToken -ContextId $legalCase.summary.id -Kind Image -ReplaceDocumentId $imageDocument.id
    if ($replacementImage.versionNumber -ne 2 -or $replacementImage.previousVersionId -ne $imageDocument.id) {
        throw 'La sustitución no creó una cadena de versiones válida.'
    }
    $documentHistory = Invoke-Api -Method Get -Path "/api/v1/documents/context/LegalCase/$($legalCase.summary.id)/history?page=1&pageSize=100" -Token $adminToken
    $photoHistory = @($documentHistory.items | Where-Object { $_.label -eq 'Fotografía E2E' })
    if ($photoHistory.Count -ne 2 -or (@($photoHistory.versionNumber | Sort-Object) -join ',') -ne '1,2') {
        throw 'El historial documental no devolvió ambas versiones.'
    }
    $encodedPhotoLabel = [Uri]::EscapeDataString('Fotografía E2E')
    $filteredPhotoHistory = Invoke-Api -Method Get -Path "/api/v1/documents/context/LegalCase/$($legalCase.summary.id)/history?label=$encodedPhotoLabel&page=1&pageSize=1" -Token $adminToken
    if ($filteredPhotoHistory.totalCount -ne 2 -or $filteredPhotoHistory.totalPages -ne 2) {
        throw 'El historial documental filtrado no conservó la paginación completa de la etiqueta.'
    }
    $null = Upload-TestDocument -Token $adminToken -ContextId $legalCase.summary.id -Kind Image -ReplaceDocumentId $imageDocument.id -ExpectedStatus 409
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($document.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/documents?contextType=LegalCase&contextId=$($legalCase.summary.id)&page=1&pageSize=25" -Token $adminToken
    $documentDownload = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/documents/$($document.id)/content" -Headers @{ Authorization = "Bearer $adminToken" }
    if ([int]$documentDownload.StatusCode -ne 200 -or $documentDownload.Headers['Content-Type'] -notlike 'application/pdf*') { throw 'El almacenamiento no devolvió el documento cargado.' }
    if ($null -ne $caseRequirement) {
        $null = Invoke-Api -Method Put -Path "/api/v1/cases/$($legalCase.summary.id)/requirements/$($caseRequirement.id)" -Token $adminToken -Body @{
            status = 'Accepted'; documentId = $requirementScanDocument.id; dataValue = $null; conditionMet = $true
            documentIssueDate = (Get-Date).ToString('yyyy-MM-dd'); notes = 'Requisito validado E2E'
        }
    }
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($document.id)" -Token $studentToken
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials" -Token $studentToken -ExpectedStatus 403 -Body @{
        title = 'Memorial no autorizado'; documentId = $document.id; submittedByStudentId = $student.id
    }
    $memorial = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials" -Token $adminToken -ExpectedStatus 201 -Body @{
        title = 'Memorial inicial E2E'
        documentId = $document.id
        submittedByStudentId = $student.id
        notes = 'Versión inicial controlada'
    }
    $versionId = $memorial.versions[0].id

    $memorial = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials/$($memorial.id)/reviews" -Token $adminToken -Body @{
        versionId = $versionId
        outcome = 'RequiresChanges'
        observations = 'Revisión E2E con cambios'
        reviewedDocumentId = $null
    }
    $memorialVersionDocument = Upload-TestDocument -Token $adminToken -ContextId $memorial.id -ContextType Memorial -Label 'Memorial corregido E2E'
    $memorial = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials/$($memorial.id)/versions" -Token $adminToken -Body @{
        documentId = $memorialVersionDocument.id; submittedByStudentId = $student.id; notes = 'Versión corregida E2E'
    }
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials/$($memorial.id)/reviews" -Token $adminToken -ExpectedStatus 409 -Body @{
        versionId = $versionId; outcome = 'Approved'; observations = 'Una versión anterior no puede aprobarse'; reviewedDocumentId = $null
    }
    $versionId = @($memorial.versions | Sort-Object versionNumber -Descending)[0].id
    $memorial = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials/$($memorial.id)/reviews" -Token $adminToken -Body @{
        versionId = $versionId; outcome = 'Approved'; observations = 'Revisión E2E aprobada'; reviewedDocumentId = $null
    }
    $receiptDocument = Upload-TestDocument -Token $adminToken -ContextId $memorial.id -ContextType Memorial -Label 'Constancia de presentación E2E'
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/memorials/$($memorial.id)/presentation" -Token $adminToken -ExpectedStatus 204 -Body @{
        presentedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        result = 'Recibido por el juzgado'
        presentedDocumentId = $memorialVersionDocument.id
        receiptDocumentId = $receiptDocument.id
    }
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/court-notifications" -Token $adminToken -ExpectedStatus 204 -Body @{
        notifiedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        description = 'Notificación E2E'
        documentId = $document.id
        newStage = 'Notificado'
    }
    $caseAfterCourtFlow = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken
    if (@($caseAfterCourtFlow.presentations).Count -ne 1 -or $caseAfterCourtFlow.presentations[0].receiptDocumentId -ne $receiptDocument.id) {
        throw 'La presentación o su constancia no se recuperaron en el detalle del expediente.'
    }
    if (@($caseAfterCourtFlow.courtNotifications).Count -ne 1 -or $caseAfterCourtFlow.courtNotifications[0].documentId -ne $document.id) {
        throw 'La notificación judicial no se recuperó en el detalle del expediente.'
    }
    if ($env:Storage__Provider -eq 'S3') {
        $bucketName = $env:Storage__S3__BucketName
        $objectPrefix = $env:Storage__S3__KeyPrefix
        if ($bucketName -notmatch '^[a-z0-9][a-z0-9.-]+$' -or $objectPrefix -notmatch '^bufete-e2e/[a-f0-9]{12}$') {
            throw 'El destino temporal de objetos no superó la validación de seguridad.'
        }
        $storedObjects = & docker compose exec -T minio sh -c 'mc alias set e2e http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc ls --recursive "e2e/$1/$2"' -- $bucketName $objectPrefix
        if ($LASTEXITCODE -ne 0 -or @($storedObjects).Count -lt 1) { throw 'No se encontraron objetos físicos de esta ejecución en MinIO.' }
    }

    $activity = Invoke-Api -Method Post -Path '/api/v1/activities' -Token $adminToken -ExpectedStatus 201 -Body @{
        occurredAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        activityType = 'Atención de alumno'
        description = 'Actividad de validación E2E'
        clientId = $client.id
        studentId = $student.id
        legalCaseId = $legalCase.summary.id
        correctionReason = $null
    }
    if ($null -eq $activity.id) { throw 'No se creó la actividad.' }
    $null = Invoke-Api -Method Get -Path '/api/v1/activities?page=1&pageSize=25' -Token $adminToken
    $activity = Invoke-Api -Method Put -Path "/api/v1/activities/$($activity.id)/correction" -Token $adminToken -Body @{
        occurredAtUtc = $activity.occurredAtUtc; activityType = $activity.activityType; description = 'Actividad E2E corregida'
        clientId = $client.id; studentId = $student.id; legalCaseId = $legalCase.summary.id; correctionReason = 'Validación de corrección E2E'
    }
    if (-not $activity.isCorrected) { throw 'La corrección de actividad no quedó registrada.' }

    $today = (Get-Date).ToString('yyyy-MM-dd')
    $report = Invoke-Api -Method Post -Path '/api/v1/reports/weekly' -Token $adminToken -ExpectedStatus 201 -Body @{ start = $today; end = $today }
    $reportPage = Invoke-Api -Method Get -Path '/api/v1/reports?page=1&pageSize=1' -Token $adminToken
    if ($reportPage.page -ne 1 -or $reportPage.pageSize -ne 1 -or $reportPage.totalCount -lt 1 -or @($reportPage.items).Count -ne 1) {
        throw 'El historial paginado de reportes no respeta su contrato.'
    }
    $null = Invoke-Api -Method Get -Path "/api/v1/reports/$($report.id)" -Token $adminToken
    $reportPrint = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/reports/$($report.id)/print" -Headers @{ Authorization = "Bearer $adminToken" }
    if ([int]$reportPrint.StatusCode -ne 200 -or $reportPrint.Headers['Content-Type'] -notlike 'text/html*') { throw 'El reporte imprimible no está disponible.' }
    if ($reportPrint.Content -notmatch [regex]::Escape($adminProfile.fullName)) { throw 'El reporte imprimible no identifica al responsable por nombre.' }
    if ($reportPrint.Content -notmatch 'data:image/png;base64,' -or [Net.WebUtility]::HtmlDecode($reportPrint.Content) -notmatch 'Sede Petén') { throw 'El reporte no conserva logo y sede institucional.' }
    $report = Invoke-Api -Method Post -Path "/api/v1/reports/$($report.id)/review" -Token $adminToken
    $report = Invoke-Api -Method Post -Path "/api/v1/reports/$($report.id)/send" -Token $adminToken -Body @{
        recipients = @('qa@example.test')
        subject = 'Reporte E2E'
        message = 'Validación automática'
    }
    if ($report.status -ne 'SendFailed') { throw 'SMTP deshabilitado debía quedar registrado como SendFailed.' }

    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/close" -Token $adminToken -ExpectedStatus 204 -Body @{
        closedAtUtc = [DateTimeOffset]::UtcNow.AddDays(-31).ToString('o'); reason = 'Cierre controlado E2E'
    }
    $retentionCandidates = Invoke-Api -Method Get -Path '/api/v1/retention/candidates?retentionDays=30&page=1&pageSize=25' -Token $adminToken
    if ($retentionCandidates.totalCount -lt 1) { throw 'El caso cerrado no apareció como candidato de retención.' }
    $null = Invoke-Api -Method Get -Path "/api/v1/retention/$($legalCase.summary.id)/preview?retentionDays=30" -Token $adminToken
    $null = Invoke-Api -Method Post -Path "/api/v1/cases/$($legalCase.summary.id)/reopen" -Token $adminToken -ExpectedStatus 204 -Body @{ reason = 'Reapertura controlada E2E' }
    $null = Invoke-Api -Method Put -Path "/api/v1/cases/$($legalCase.summary.id)/assignments/$($assignment.id)/end" -Token $adminToken -ExpectedStatus 204 -Body @{
        status = 'Completed'; reason = 'Fin de asignación E2E'
    }
    $caseAfterUnassignment = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken
    $endedCaseAssignment = @($caseAfterUnassignment.summary.assignments | Where-Object { $_.id -eq $assignment.id })[0]
    if ($null -eq $endedCaseAssignment -or $endedCaseAssignment.status -ne 'Completed' -or $null -eq $endedCaseAssignment.endedAtUtc -or $endedCaseAssignment.endReason -ne 'Fin de asignación E2E') {
        throw 'La desasignación no quedó reflejada en el expediente.'
    }
    $studentAfterUnassignment = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)/profile" -Token $adminToken
    $endedStudentAssignment = @($studentAfterUnassignment.cases | Where-Object { $_.assignmentId -eq $assignment.id })[0]
    if ($null -eq $endedStudentAssignment -or $endedStudentAssignment.assignmentStatus -ne 'Completed' -or $endedStudentAssignment.endReason -ne 'Fin de asignación E2E') {
        throw 'La desasignación no conservó estado y motivo en el histórico del alumno.'
    }
    if (-not (@($caseAfterUnassignment.timeline) | Where-Object { $_.type -eq 'Assignment' -and $_.title -eq 'Asignación finalizada' })) {
        throw 'La desasignación no generó el movimiento esperado en la bitácora.'
    }

    $updatedSelf = Invoke-Api -Method Put -Path '/api/v1/users/me' -Token $studentToken -Body @{ fullName = "$($student.fullName) Actualizado"; email = $studentUser.email }
    $updatedStudent = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)" -Token $studentToken
    if ($updatedStudent.fullName -ne $updatedSelf.fullName) { throw 'El nombre administrado por el alumno no se sincronizó con su perfil académico.' }
    $null = Invoke-Api -Method Put -Path '/api/v1/users/me/photo' -Token $studentToken -Body @{ documentId = $null }
    $studentPasswordChanged = 'newpassx'
    $null = Invoke-Api -Method Post -Path '/api/v1/users/me/change-password' -Token $studentToken -ExpectedStatus 204 -Body @{
        currentPassword = $studentPassword; newPassword = $studentPasswordChanged
    }
    $studentLogin = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $studentUser.email; password = $studentPasswordChanged }
    $studentPasswordReset = 'resetpwd'
    $null = Invoke-Api -Method Post -Path "/api/v1/users/$($studentUser.id)/reset-password" -Token $adminToken -ExpectedStatus 204 -Body @{ newPassword = $studentPasswordReset }
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $studentUser.email; password = $studentPasswordReset }

    $raceLogin = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $env:BootstrapAdmin__Email; password = $env:BootstrapAdmin__Password }
    $raceClient = [System.Net.Http.HttpClient]::new()
    $racePayload = (@{ refreshToken = $raceLogin.refreshToken } | ConvertTo-Json -Compress)
    $raceContentA = [System.Net.Http.StringContent]::new($racePayload, [System.Text.Encoding]::UTF8, 'application/json')
    $raceContentB = [System.Net.Http.StringContent]::new($racePayload, [System.Text.Encoding]::UTF8, 'application/json')
    try {
        $raceTaskA = $raceClient.PostAsync("$baseUrl/api/v1/auth/refresh", $raceContentA)
        $raceTaskB = $raceClient.PostAsync("$baseUrl/api/v1/auth/refresh", $raceContentB)
        $raceResponseA = $raceTaskA.GetAwaiter().GetResult()
        $raceResponseB = $raceTaskB.GetAwaiter().GetResult()
        $raceStatuses = @([int]$raceResponseA.StatusCode, [int]$raceResponseB.StatusCode) | Sort-Object
        if ($raceStatuses[0] -ne 200 -or $raceStatuses[1] -ne 401) {
            throw "La rotación concurrente debía aceptar una sola petición. Estados: $($raceStatuses -join ', ')."
        }
    }
    finally {
        $raceContentA.Dispose(); $raceContentB.Dispose(); $raceClient.Dispose()
    }

    $rotationLogin = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $env:BootstrapAdmin__Email; password = $env:BootstrapAdmin__Password }
    $rotatedSession = Invoke-Api -Method Post -Path '/api/v1/auth/refresh' -Body @{ refreshToken = $rotationLogin.refreshToken }
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/revoke' -Token $rotatedSession.accessToken -ExpectedStatus 204 -Body @{ refreshToken = $rotatedSession.refreshToken }
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/refresh' -ExpectedStatus 401 -Body @{ refreshToken = $rotatedSession.refreshToken }

    $null = Invoke-Api -Method Delete -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken -ExpectedStatus 204 -Body @{ reason = 'Validación E2E de papelera' }
    $hiddenCases = Invoke-Api -Method Get -Path "/api/v1/cases?search=$suffix&page=1&pageSize=10" -Token $adminToken
    if ($hiddenCases.totalCount -ne 0) { throw 'El expediente eliminado siguió visible en el listado operativo.' }
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($document.id)" -Token $adminToken -ExpectedStatus 404
    $deletedCases = Invoke-Api -Method Get -Path "/api/v1/deleted-records?type=LegalCase&search=$($legalCase.summary.caseNumber)&page=1&pageSize=10" -Token $adminToken
    if (-not (@($deletedCases.items) | Where-Object { $_.id -eq $legalCase.summary.id })) { throw 'El expediente no apareció en la papelera.' }
    $null = Invoke-Api -Method Post -Path "/api/v1/deleted-records/LegalCase/$($legalCase.summary.id)/restore" -Token $adminToken -ExpectedStatus 204
    $null = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken
    $restoredCaseDocument = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/v1/documents/$($document.id)/content" -Headers @{ Authorization = "Bearer $adminToken" }
    if ([int]$restoredCaseDocument.StatusCode -ne 200) { throw 'El documento del expediente no se restauró con su propietario.' }

    $null = Invoke-Api -Method Delete -Path "/api/v1/clients/$($client.id)" -Token $adminToken -ExpectedStatus 204 -Body @{ reason = 'Validación E2E de cascada de cliente' }
    $hiddenClients = Invoke-Api -Method Get -Path "/api/v1/clients?search=$suffix&page=1&pageSize=10" -Token $adminToken
    if ($hiddenClients.totalCount -ne 0) { throw 'El cliente eliminado siguió visible en el listado operativo.' }
    $null = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken -ExpectedStatus 404
    $null = Invoke-Api -Method Post -Path "/api/v1/deleted-records/Client/$($client.id)/restore" -Token $adminToken -ExpectedStatus 204
    $null = Invoke-Api -Method Get -Path "/api/v1/clients/$($client.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/cases/$($legalCase.summary.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($document.id)" -Token $adminToken

    $studentSessionBeforeDeletion = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $studentUser.email; password = $studentPasswordReset }
    $null = Invoke-Api -Method Delete -Path "/api/v1/students/$($student.id)" -Token $adminToken -ExpectedStatus 204 -Body @{ reason = 'Validación E2E de alumno y sesión' }
    $null = Invoke-Api -Method Get -Path '/api/v1/auth/me' -Token $studentSessionBeforeDeletion.accessToken -ExpectedStatus 401
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/refresh' -ExpectedStatus 401 -Body @{ refreshToken = $studentSessionBeforeDeletion.refreshToken }
    $hiddenStudents = Invoke-Api -Method Get -Path "/api/v1/students?search=$suffix&page=1&pageSize=10" -Token $adminToken
    if ($hiddenStudents.totalCount -ne 0) { throw 'El alumno eliminado siguió visible en el listado operativo.' }
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($studentPhotoDocument.id)" -Token $adminToken -ExpectedStatus 404
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($studentIdentityDocument.id)" -Token $adminToken -ExpectedStatus 404
    $deletedStudents = Invoke-Api -Method Get -Path "/api/v1/deleted-records?type=Student&search=$suffix&page=1&pageSize=10" -Token $adminToken
    if (-not (@($deletedStudents.items) | Where-Object { $_.id -eq $student.id })) { throw 'El alumno no apareció en la papelera.' }
    $null = Invoke-Api -Method Post -Path "/api/v1/deleted-records/Student/$($student.id)/restore" -Token $adminToken -ExpectedStatus 204
    $null = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($studentPhotoDocument.id)" -Token $adminToken
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($studentIdentityDocument.id)" -Token $adminToken
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $studentUser.email; password = $studentPasswordReset }

    $null = Invoke-Api -Method Delete -Path "/api/v1/users/$($studentUser.id)" -Token $adminToken -ExpectedStatus 204
    $deletedAccounts = Invoke-Api -Method Get -Path "/api/v1/users?lifecycle=deleted&personType=student&search=$suffix" -Token $adminToken
    if (-not (@($deletedAccounts.items) | Where-Object { $_.id -eq $studentUser.id })) { throw 'La cuenta no apareció en eliminados.' }
    $currentAccounts = Invoke-Api -Method Get -Path "/api/v1/users?lifecycle=current&personType=student&search=$suffix" -Token $adminToken
    if (@($currentAccounts.items | Where-Object { $_.id -eq $studentUser.id }).Count -ne 0) { throw 'La cuenta eliminada siguió en el directorio activo.' }
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/login' -ExpectedStatus 401 -Body @{ email = $studentUser.email; password = $studentPasswordReset }
    $restoredAccount = Invoke-Api -Method Post -Path "/api/v1/users/$($studentUser.id)/restore" -Token $adminToken
    if ($restoredAccount.isDeleted -or $restoredAccount.isActive) { throw 'La restauración concedió acceso automáticamente o no quitó la baja.' }
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/login' -ExpectedStatus 401 -Body @{ email = $studentUser.email; password = $studentPasswordReset }
    $enabledAccount = Invoke-Api -Method Put -Path "/api/v1/users/$($studentUser.id)/access" -Token $adminToken -Body @{ isActive = $true }
    if ($enabledAccount.accessStatus -ne 'Active') { throw 'La cuenta restaurada no pudo habilitarse.' }
    $restoredSession = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{ email = $studentUser.email; password = $studentPasswordReset }
    $null = Invoke-Api -Method Delete -Path "/api/v1/users/$($studentUser.id)/permanent" -Token $restoredSession.accessToken -ExpectedStatus 403
    $null = Invoke-Api -Method Put -Path "/api/v1/users/$($studentUser.id)/access" -Token $adminToken -Body @{ isActive = $false }
    $null = Invoke-Api -Method Post -Path '/api/v1/auth/login' -ExpectedStatus 401 -Body @{ email = $studentUser.email; password = $studentPasswordReset }
    $null = Invoke-Api -Method Delete -Path "/api/v1/users/$($studentUser.id)" -Token $adminToken -ExpectedStatus 204
    $null = Invoke-Api -Method Delete -Path "/api/v1/users/$($studentUser.id)/permanent" -Token $adminToken -ExpectedStatus 204
    $null = Invoke-Api -Method Get -Path "/api/v1/users/$($studentUser.id)" -Token $adminToken -ExpectedStatus 404
    $null = Invoke-Api -Method Get -Path "/api/v1/documents/$($studentPhotoDocument.id)" -Token $adminToken -ExpectedStatus 404
    $studentAfterPurge = Invoke-Api -Method Get -Path "/api/v1/students/$($student.id)" -Token $adminToken
    if ($null -ne $studentAfterPurge.userAccountId) { throw 'La cuenta purgada quedó referenciada por el alumno.' }

    $search = Invoke-Api -Method Get -Path "/api/v1/search?term=$suffix" -Token $adminToken
    if ($search.totalCount -lt 2) { throw 'La búsqueda no devolvió cliente y alumno.' }
    $searchTypes = @($search.items | ForEach-Object { $_.resultType })
    if ('Client' -notin $searchTypes -or 'Student' -notin $searchTypes) {
        throw "La búsqueda devolvió tipos incompatibles con el frontend: $($searchTypes -join ', ')."
    }
    $audit = Invoke-Api -Method Get -Path '/api/v1/audit?page=1&pageSize=20' -Token $adminToken
    if ($audit.totalCount -lt 1) { throw 'No se generó trazabilidad.' }

    [pscustomobject]@{
        Database = $databaseName
        ApiVersion = 'v1'
        AuthenticatedProfile = 'OK'
        ProcessTypes = $processTypes.Count
        ClientFlow = 'OK'
        IncomeDeclarationFlow = 'OK'
        StudentAndEnrollmentFlow = 'OK'
        StudentAuthenticationAndIsolation = 'OK'
        MultipageScanSessionFlow = 'OK'
        S3CompatibleObjectStorageFlow = 'OK'
        CaseAssignmentFlow = 'OK'
        DocumentUploadFlow = 'OK'
        MemorialReviewPresentationFlow = 'OK'
        CourtNotificationFlow = 'OK'
        ActivityAndReportFlow = 'OK'
        SearchAndAuditFlow = 'OK'
        CrudAndContractCoverage = 'OK'
        RetentionPreviewSafety = 'OK'
        TokenRotationAndRevocation = 'OK'
        SoftDeletionRestoreAndSessionRevocation = 'OK'
        UserSuspensionRestoreAndPermanentDeletion = 'OK'
        DocumentVersionHistory = 'OK'
    }
}
finally {
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        Wait-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue
    }

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($item in $listener) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($item.OwningProcess)"
        if ($process.ExecutablePath -and $process.ExecutablePath.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $item.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }

    if ($env:Storage__Provider -eq 'S3' -and
        $env:Storage__S3__BucketName -match '^[a-z0-9][a-z0-9.-]+$' -and
        $env:Storage__S3__KeyPrefix -match '^bufete-e2e/[a-f0-9]{12}$') {
        & docker compose exec -T minio sh -c 'mc alias set e2e http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm --recursive --force "e2e/$1/$2" >/dev/null' -- $env:Storage__S3__BucketName $env:Storage__S3__KeyPrefix
        if ($LASTEXITCODE -ne 0) { Write-Warning 'No se pudo limpiar el prefijo temporal de MinIO.' }
    }

    if ($databaseCreated -and -not $KeepDatabase) {
        $existingDatabase = & docker exec $containerName psql -U $env:POSTGRES_USER -d postgres -At -c "select datname from pg_database where datname = '$databaseName';"
        if ($existingDatabase -eq $databaseName -and $databaseName -match '^bufete_juridico_e2e_[a-f0-9]{12}$') {
            & docker exec $containerName dropdb -U $env:POSTGRES_USER --force $databaseName | Out-Null
        }
    }
}
