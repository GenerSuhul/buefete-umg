using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Application.Students;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Students;

internal sealed class StudentService(
    BufeteDbContext dbContext,
    IUserManagementService userManagementService,
    ICurrentUser currentUser,
    TimeProvider timeProvider)
    : IStudentService
{
    public async Task<PagedResult<StudentDto>> GetStudentsAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        (page, pageSize) = (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));
        var query = dbContext.Students.AsNoTracking().AsQueryable();

        if (!currentUser.HasPermission(Permissions.StudentsRead))
        {
            if (!currentUser.HasPermission(Permissions.StudentSelfRead) || currentUser.UserId is null)
                throw new ForbiddenException("No tiene permiso para consultar alumnos.");
            query = query.Where(item => item.UserAccountId == currentUser.UserId && item.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = TextNormalization.Normalize(search);
            query = query.Where(item =>
                item.NormalizedFullName.Contains(normalized) ||
                item.StudentCardNumber.Contains(search.Trim()) ||
                item.Dpi.Contains(search.Trim()));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(item => item.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var photos = await GetPhotoMapAsync(items, cancellationToken);

        return new PagedResult<StudentDto>(items.Select(item => Map(item, Photo(item, photos))).ToList(), page, pageSize, total);
    }

    public async Task<StudentDto> GetStudentAsync(Guid id, CancellationToken cancellationToken)
    {
        await EnsureCanReadStudentAsync(id, cancellationToken);

        var student = await dbContext.Students.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");
        var photos = await GetPhotoMapAsync([student], cancellationToken);
        return Map(student, Photo(student, photos));
    }

    public async Task<StudentProfileDto> GetStudentProfileAsync(Guid id, CancellationToken cancellationToken)
    {
        await EnsureCanReadStudentAsync(id, cancellationToken);
        var student = await dbContext.Students.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");
        var enrollments = await dbContext.EnrollmentApplications.AsNoTracking()
            .Include(item => item.Requirements)
            .Where(item => item.StudentId == id)
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var assignments = await dbContext.CaseAssignments.AsNoTracking()
            .Include(item => item.LegalCase).ThenInclude(item => item.Client)
            .Include(item => item.LegalCase).ThenInclude(item => item.ProcessType)
            .Include(item => item.LegalCase).ThenInclude(item => item.Timeline)
            .Where(item => item.StudentId == id)
            .OrderByDescending(item => item.AssignedAtUtc)
            .ToListAsync(cancellationToken);
        var cases = assignments.Select(item =>
        {
            var lastStep = item.LegalCase.Timeline.OrderByDescending(step => step.OccurredAtUtc).FirstOrDefault();
            return new StudentCaseDto(
                item.LegalCaseId,
                item.LegalCase.CaseNumber,
                item.LegalCase.Client.FullName,
                item.LegalCase.ProcessType.Name,
                item.LegalCase.Status.ToString(),
                item.LegalCase.Stage,
                item.IsPrimary,
                lastStep?.Title,
                lastStep?.OccurredAtUtc);
        }).ToList();
        var photos = await GetPhotoMapAsync([student], cancellationToken);
        return new StudentProfileDto(Map(student, Photo(student, photos)), enrollments.Select(Map).ToList(), cases);
    }

    public async Task<StudentDto> CreateStudentAsync(SaveStudentRequest request, CancellationToken cancellationToken)
    {
        ValidateStudent(request);
        await EnsureUniqueStudentDataAsync(null, request, cancellationToken);

        var student = new Student();
        Apply(student, request);
        dbContext.Students.Add(student);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(student);
    }

    public async Task<StudentRegistrationDto> RegisterStudentAsync(
        RegisterStudentRequest request,
        CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            var student = await CreateStudentAsync(request.Student, cancellationToken);
            var enrollment = await CreateEnrollmentAsync(student.Id, request.Enrollment, cancellationToken);
            var access = await ProvisionAccessAsync(student.Id, request.Access, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new StudentRegistrationDto(
                student with { UserAccountId = access.UserAccountId },
                enrollment,
                access);
        });
    }

    public async Task<StudentAccessDto> ProvisionAccessAsync(
        Guid studentId,
        StudentAccessRequest request,
        CancellationToken cancellationToken)
    {
        var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == studentId && item.IsActive, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");
        if (student.UserAccountId is not null)
            throw new ConflictException("El alumno ya tiene acceso al sistema.");

        var studentRole = await dbContext.Roles.AsNoTracking().SingleOrDefaultAsync(
            item => item.NormalizedName == TextNormalization.Normalize("Alumno") && item.IsActive,
            cancellationToken)
            ?? throw new ConflictException("El rol Alumno no está disponible.");

        var user = await userManagementService.CreateUserAsync(new CreateUserRequest(
            student.Email,
            student.Email,
            student.FullName,
            request.Password,
            request.ParticipationStartDate,
            request.ParticipationEndDate,
            [studentRole.Id],
            student.Id), cancellationToken);

        return new StudentAccessDto(user.Id, user.Username, user.Email, user.IsActive);
    }

    public async Task<StudentDto> UpdateStudentAsync(Guid id, SaveStudentRequest request, CancellationToken cancellationToken)
    {
        ValidateStudent(request);
        var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");

        await EnsureUniqueStudentDataAsync(id, request, cancellationToken);
        Apply(student, request);
        if (student.UserAccountId is Guid userAccountId)
        {
            var user = await dbContext.Users.SingleAsync(item => item.Id == userAccountId, cancellationToken);
            var normalizedEmail = TextNormalization.Normalize(request.Email);
            if (await dbContext.Users.AnyAsync(item => item.Id != userAccountId && item.NormalizedEmail == normalizedEmail, cancellationToken))
                throw new ConflictException("El correo ya pertenece a otra cuenta de acceso.");
            user.Email = request.Email.Trim();
            user.NormalizedEmail = normalizedEmail;
            user.Username = request.Email.Trim();
            user.NormalizedUsername = normalizedEmail;
            user.FullName = request.FullName.Trim();
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(student);
    }

    public async Task<StudentDto> SetStudentActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken)
    {
        var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");

        if (!isActive && await dbContext.CaseAssignments.AnyAsync(item =>
                item.StudentId == id && item.Status == CaseAssignmentStatus.Active,
            cancellationToken))
            throw new ConflictException("No se puede dar de baja al alumno mientras tenga casos activos asignados.");

        student.IsActive = isActive;
        if (student.UserAccountId is Guid userAccountId)
        {
            var user = await dbContext.Users.SingleAsync(item => item.Id == userAccountId, cancellationToken);
            user.IsActive = isActive;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(student);
    }

    public async Task<EnrollmentApplicationDto> CreateEnrollmentAsync(
        Guid studentId,
        CreateEnrollmentRequest request,
        CancellationToken cancellationToken)
    {
        var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == studentId && item.IsActive, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");

        if (request.StartDate is not null && request.EndDate is not null && request.EndDate < request.StartDate)
        {
            throw new ValidationException("La fecha final de práctica no puede ser anterior a la inicial.");
        }

        var hasOpenApplication = await dbContext.EnrollmentApplications.AnyAsync(item =>
            item.StudentId == studentId &&
            item.Status != EnrollmentStatus.Rejected &&
            item.Status != EnrollmentStatus.Completed,
            cancellationToken);

        if (hasOpenApplication)
        {
            throw new ConflictException("El alumno ya tiene una solicitud de inscripción activa.");
        }

        var definitions = await dbContext.RequirementDefinitions
            .Where(item => item.Scope == RequirementScope.StudentEnrollment && item.IsActive)
            .OrderBy(item => item.SortOrder)
            .ToListAsync(cancellationToken);

        if (request.InitialStatus is not EnrollmentStatus.Draft and not EnrollmentStatus.Submitted)
            throw new ValidationException("Al crear la inscripción el estado inicial debe ser Borrador o Presentada.");

        var now = timeProvider.GetUtcNow();

        var enrollment = new EnrollmentApplication
        {
            Student = student,
            Modality = request.Modality,
            Status = request.InitialStatus,
            SiteName = Clean(request.SiteName),
            SiteAddress = Clean(request.SiteAddress),
            Shift = Clean(request.Shift),
            PracticeDays = Clean(request.PracticeDays),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            SubmittedAtUtc = request.InitialStatus == EnrollmentStatus.Submitted ? now : null
        };

        foreach (var definition in definitions)
        {
            enrollment.Requirements.Add(new StudentRequirement
            {
                RequirementDefinitionId = definition.Id,
                RequirementLabel = definition.Label,
                Status = RequirementFulfillmentStatus.Pending
            });
        }

        dbContext.EnrollmentApplications.Add(enrollment);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(enrollment);
    }

    public async Task<EnrollmentApplicationDto> ChangeEnrollmentStatusAsync(
        Guid enrollmentId,
        ChangeEnrollmentStatusRequest request,
        CancellationToken cancellationToken)
    {
        var enrollment = await LoadEnrollmentAsync(enrollmentId, cancellationToken);
        if (!EnrollmentRules.CanTransition(enrollment.Status, request.Status))
        {
            throw new ConflictException($"No se permite cambiar la inscripción de {enrollment.Status} a {request.Status}.");
        }

        if (request.Status == EnrollmentStatus.Approved)
        {
            var pendingRequired = await dbContext.StudentRequirements
                .Join(
                    dbContext.RequirementDefinitions,
                    requirement => requirement.RequirementDefinitionId,
                    definition => definition.Id,
                    (requirement, definition) => new { requirement, definition })
                .AnyAsync(item =>
                    item.requirement.EnrollmentApplicationId == enrollmentId &&
                    item.definition.IsRequired &&
                    item.requirement.Status != RequirementFulfillmentStatus.Accepted,
                    cancellationToken);

            if (pendingRequired)
            {
                throw new ConflictException("No se puede aprobar la inscripción con requisitos obligatorios pendientes.");
            }
        }

        enrollment.Status = request.Status;
        enrollment.ResolutionNotes = Clean(request.ResolutionNotes);
        enrollment.ResolutionDocumentId = request.ResolutionDocumentId;
        var now = timeProvider.GetUtcNow();

        if (request.Status == EnrollmentStatus.Submitted) enrollment.SubmittedAtUtc = now;
        if (request.Status == EnrollmentStatus.Admitted) enrollment.AdmittedAtUtc = now;
        if (request.Status is EnrollmentStatus.Approved or EnrollmentStatus.Rejected)
        {
            enrollment.ResolvedAtUtc = now;
            enrollment.ResolvedByUserId = currentUser.UserId;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(enrollment);
    }

    public async Task<EnrollmentApplicationDto> IssueClinicCardAsync(
        Guid enrollmentId,
        IssueClinicCardRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CardNumber))
        {
            throw new ValidationException("El número de carné es obligatorio.");
        }

        var enrollment = await LoadEnrollmentAsync(enrollmentId, cancellationToken);
        if (enrollment.Status != EnrollmentStatus.Approved)
        {
            throw new ConflictException("Solo se puede emitir carné para una inscripción aprobada.");
        }

        if (request.ExpirationDate < request.IssuedDate)
        {
            throw new ValidationException("La fecha de vencimiento del carné no puede ser anterior a su emisión.");
        }

        if (await dbContext.EnrollmentApplications.AnyAsync(item =>
                item.Id != enrollmentId && item.ClinicCardNumber == request.CardNumber.Trim(),
            cancellationToken))
        {
            throw new ConflictException("El número de carné ya está registrado.");
        }

        enrollment.ClinicCardNumber = request.CardNumber.Trim();
        enrollment.ClinicCardIssuedDate = request.IssuedDate;
        enrollment.ClinicCardExpirationDate = request.ExpirationDate;
        enrollment.ClinicCardDeliveredAtUtc = request.MarkDelivered ? timeProvider.GetUtcNow() : null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(enrollment);
    }

    public async Task<EnrollmentApplicationDto> UpdateRequirementAsync(
        Guid enrollmentId,
        Guid requirementId,
        UpdateStudentRequirementRequest request,
        CancellationToken cancellationToken)
    {
        var enrollment = await LoadEnrollmentAsync(enrollmentId, cancellationToken);
        var requirement = enrollment.Requirements.SingleOrDefault(item => item.Id == requirementId)
            ?? throw new NotFoundException("No se encontró el requisito de inscripción.");
        var definition = await dbContext.RequirementDefinitions.AsNoTracking()
            .SingleAsync(item => item.Id == requirement.RequirementDefinitionId, cancellationToken);

        requirement.Status = RequirementRules.DetermineStatus(
            request.Status,
            request.DocumentIssueDate,
            definition.MaximumAgeDays,
            DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime));
        requirement.DocumentId = request.DocumentId;
        requirement.DataValue = Clean(request.DataValue);
        requirement.DocumentIssueDate = request.DocumentIssueDate;
        requirement.Notes = Clean(request.Notes);
        requirement.ReviewedAtUtc = timeProvider.GetUtcNow();
        requirement.ReviewedByUserId = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(enrollment);
    }

    private async Task<EnrollmentApplication> LoadEnrollmentAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.EnrollmentApplications
            .Include(item => item.Requirements)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
        ?? throw new NotFoundException("No se encontró la solicitud de inscripción.");

    private async Task EnsureCanReadStudentAsync(Guid id, CancellationToken cancellationToken)
    {
        if (currentUser.HasPermission(Permissions.StudentsRead)) return;
        if (!currentUser.HasPermission(Permissions.StudentSelfRead) || currentUser.UserId is null ||
            !await dbContext.Students.AnyAsync(item => item.Id == id && item.UserAccountId == currentUser.UserId, cancellationToken))
            throw new ForbiddenException("Solo puede consultar su propio perfil de alumno.");
    }

    private async Task EnsureUniqueStudentDataAsync(Guid? id, SaveStudentRequest request, CancellationToken cancellationToken)
    {
        if (await dbContext.Students.AnyAsync(item => item.Id != id && item.StudentCardNumber == request.StudentCardNumber.Trim(), cancellationToken))
            throw new ConflictException("El carné universitario ya está registrado.");
        if (await dbContext.Students.AnyAsync(item => item.Id != id && item.Dpi == request.Dpi.Trim(), cancellationToken))
            throw new ConflictException("El DPI del alumno ya está registrado.");
        if (await dbContext.Students.AnyAsync(item => item.Id != id && item.Email == request.Email.Trim(), cancellationToken))
            throw new ConflictException("El correo del alumno ya está registrado.");
    }

    private static void ValidateStudent(SaveStudentRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.FullName)) errors["fullName"] = ["El nombre es obligatorio."];
        if (string.IsNullOrWhiteSpace(request.StudentCardNumber)) errors["studentCardNumber"] = ["El carné es obligatorio."];
        if (string.IsNullOrWhiteSpace(request.Dpi)) errors["dpi"] = ["El DPI es obligatorio."];
        if (string.IsNullOrWhiteSpace(request.ResidenceAddress)) errors["residenceAddress"] = ["La residencia es obligatoria."];
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@', StringComparison.Ordinal)) errors["email"] = ["El correo no es válido."];
        if (request.Semester <= 0) errors["semester"] = ["El semestre debe ser mayor que cero."];
        if (errors.Count > 0) throw new ValidationException("Revise los datos del alumno.", errors);
    }

    private static void Apply(Student student, SaveStudentRequest request)
    {
        student.FullName = request.FullName.Trim();
        student.NormalizedFullName = TextNormalization.Normalize(request.FullName);
        student.BirthDate = request.BirthDate;
        student.AgeAtRegistration = request.AgeAtRegistration;
        student.StudentCardNumber = request.StudentCardNumber.Trim();
        student.Dpi = request.Dpi.Trim();
        student.Semester = request.Semester;
        student.StudyShift = Clean(request.StudyShift);
        student.Workplace = Clean(request.Workplace);
        student.WorkPhone = Clean(request.WorkPhone);
        student.ImmediateSupervisor = Clean(request.ImmediateSupervisor);
        student.JobTitle = Clean(request.JobTitle);
        student.ResidenceAddress = request.ResidenceAddress.Trim();
        student.MobilePhone = Clean(request.MobilePhone);
        student.HomePhone = Clean(request.HomePhone);
        student.Email = request.Email.Trim();
        student.RegistrationDate = request.RegistrationDate;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private async Task<Dictionary<Guid, Guid?>> GetPhotoMapAsync(IEnumerable<Student> students, CancellationToken cancellationToken)
    {
        var userIds = students.Where(item => item.UserAccountId.HasValue).Select(item => item.UserAccountId!.Value).Distinct().ToList();
        return await dbContext.Users.AsNoTracking().Where(item => userIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.PhotoDocumentId, cancellationToken);
    }

    private static Guid? Photo(Student student, IReadOnlyDictionary<Guid, Guid?> photos) =>
        student.UserAccountId is Guid userId && photos.TryGetValue(userId, out var photo) ? photo : null;

    private static StudentDto Map(Student item, Guid? photoDocumentId = null) => new(
        item.Id,
        item.UserAccountId,
        photoDocumentId,
        item.FullName,
        item.BirthDate,
        item.AgeAtRegistration,
        item.StudentCardNumber,
        item.Dpi,
        item.Semester,
        item.StudyShift,
        item.Workplace,
        item.WorkPhone,
        item.ImmediateSupervisor,
        item.JobTitle,
        item.ResidenceAddress,
        item.MobilePhone,
        item.HomePhone,
        item.Email,
        item.RegistrationDate,
        item.IsActive);

    private static EnrollmentApplicationDto Map(EnrollmentApplication item) => new(
        item.Id,
        item.StudentId,
        item.Modality,
        item.Status,
        item.SiteName,
        item.SiteAddress,
        item.Shift,
        item.PracticeDays,
        item.StartTime,
        item.EndTime,
        item.StartDate,
        item.EndDate,
        item.SubmittedAtUtc,
        item.AdmittedAtUtc,
        item.ResolvedAtUtc,
        item.ResolutionNotes,
        item.ResolutionDocumentId,
        item.ClinicCardNumber,
        item.ClinicCardIssuedDate,
        item.ClinicCardExpirationDate,
        item.ClinicCardDeliveredAtUtc,
        item.Requirements.OrderBy(requirement => requirement.RequirementLabel).Select(Map).ToList());

    private static StudentRequirementDto Map(StudentRequirement item) => new(
        item.Id,
        item.RequirementDefinitionId,
        item.RequirementLabel,
        item.Status,
        item.DocumentId,
        item.DataValue,
        item.DocumentIssueDate,
        item.Notes);
}
