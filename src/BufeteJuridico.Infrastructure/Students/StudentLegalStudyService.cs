using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Application.Students;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Students;

internal sealed class StudentLegalStudyService(BufeteDbContext dbContext, IDocumentService documents,
    ICurrentUser currentUser, TimeProvider timeProvider) : IStudentLegalStudyService
{
    public async Task<StudentLegalStudyDto> GetAsync(Guid studentId, CancellationToken cancellationToken)
    {
        var student = await GetStudentAsync(studentId, false, cancellationToken);
        var reviews = await dbContext.StudentLegalReviews.AsNoTracking().Where(item => item.StudentId == studentId)
            .OrderBy(item => item.ReviewDate).ThenBy(item => item.CreatedAtUtc).ToListAsync(cancellationToken);
        var closure = await dbContext.StudentPracticeClosures.AsNoTracking()
            .SingleOrDefaultAsync(item => item.StudentId == studentId, cancellationToken);
        return new StudentLegalStudyDto(reviews.Select(item => new StudentLegalReviewDto(item.Id, item.ReviewType,
            item.ReviewDate, item.Observations, item.SignedDocumentId, item.CreatedAtUtc)).ToList(),
            closure is null ? null : Map(closure, student));
    }

    public async Task<StudentLegalStudyDto> AddReviewAsync(Guid studentId, AddLegalStudyReviewRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var student = await GetStudentAsync(studentId, true, cancellationToken);
        await EnsureOpenAsync(student, cancellationToken);
        if (!Enum.IsDefined(request.ReviewType)) throw new ValidationException("Seleccione el tipo de revisión.");
        ValidateDate(request.ReviewDate, student.RegistrationDate);
        if (string.IsNullOrWhiteSpace(request.Observations) || request.Observations.Length > 4000)
            throw new ValidationException("Escriba las observaciones de la revisión (máximo 4000 caracteres).");
        await EnsurePdfAsync(studentId, request.SignedDocumentId, cancellationToken);
        dbContext.StudentLegalReviews.Add(new StudentLegalReview
        {
            StudentId = studentId, ReviewType = request.ReviewType, ReviewDate = request.ReviewDate,
            Observations = request.Observations.Trim(), SignedDocumentId = request.SignedDocumentId
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetAsync(studentId, cancellationToken);
    }

    public async Task<StudentLegalStudyDto> DeliverAsync(Guid studentId, DeliverLegalStudyRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var student = await GetStudentAsync(studentId, true, cancellationToken);
        await EnsureOpenAsync(student, cancellationToken);
        ValidateDate(request.DeliveryDate, student.RegistrationDate);
        if ((request.Notes?.Length ?? 0) > 4000) throw new ValidationException("Las notas admiten hasta 4000 caracteres.");
        var reviews = await dbContext.StudentLegalReviews.Where(item => item.StudentId == studentId).ToListAsync(cancellationToken);
        if (reviews.Count == 0) throw new ConflictException("Registre al menos una revisión firmada antes de entregar el estudio jurídico.");
        if (reviews.Any(item => item.ReviewDate > request.DeliveryDate))
            throw new ValidationException("La entrega no puede ser anterior a una revisión registrada.");
        await EnsurePdfAsync(studentId, request.FinalDocumentId, cancellationToken);
        dbContext.StudentPracticeClosures.Add(new StudentPracticeClosure
        {
            StudentId = studentId, DeliveryDate = request.DeliveryDate,
            FinalDocumentId = request.FinalDocumentId, Notes = request.Notes?.Trim() ?? string.Empty
        });
        student.IsActive = false;
        var now = timeProvider.GetUtcNow();
        var enrollments = await dbContext.EnrollmentApplications.Where(item => item.StudentId == studentId &&
            item.Status != EnrollmentStatus.Rejected && item.Status != EnrollmentStatus.Completed).ToListAsync(cancellationToken);
        foreach (var enrollment in enrollments)
        {
            enrollment.Status = EnrollmentStatus.Completed;
            enrollment.ResolvedAtUtc = now;
            enrollment.ResolvedByUserId = currentUser.UserId;
            enrollment.ResolutionNotes = "Práctica cerrada por entrega del estudio jurídico.";
        }
        var assignments = await dbContext.CaseAssignments.Where(item => item.StudentId == studentId &&
            item.Status == CaseAssignmentStatus.Active).ToListAsync(cancellationToken);
        foreach (var assignment in assignments)
        {
            assignment.Status = CaseAssignmentStatus.Completed;
            assignment.EndedAtUtc = now;
            assignment.EndReason = "Práctica cerrada por entrega del estudio jurídico.";
            dbContext.TimelineEntries.Add(new TimelineEntry
            {
                LegalCaseId = assignment.LegalCaseId, Type = TimelineEntryType.Assignment,
                Title = "Cierre de práctica del alumno", Description = $"{student.FullName}: estudio jurídico entregado; asignación finalizada.",
                OccurredAtUtc = now
            });
        }
        if (student.UserAccountId is Guid userId)
        {
            var account = await dbContext.Users.SingleAsync(item => item.Id == userId, cancellationToken);
            account.IsActive = false;
            account.SecurityStamp = Guid.NewGuid();
            var tokens = await dbContext.RefreshTokens.Where(item => item.UserId == userId && item.RevokedAtUtc == null).ToListAsync(cancellationToken);
            foreach (var token in tokens) token.RevokedAtUtc = now;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetAsync(studentId, cancellationToken);
    }

    public async Task<PagedResult<StudentPracticeClosureDto>> GetClosuresAsync(string? search, int page, int pageSize,
        CancellationToken cancellationToken)
    {
        if (!currentUser.HasPermission(Permissions.StudentsRead)) throw new ForbiddenException("No tiene permiso para consultar cierres de práctica.");
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.StudentPracticeClosures.AsNoTracking().Include(item => item.Student).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = TextNormalization.Normalize(search);
            query = query.Where(item => item.Student.NormalizedFullName.Contains(term) || item.Student.StudentCardNumber.Contains(search.Trim()));
        }
        var count = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(item => item.DeliveryDate).ThenBy(item => item.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<StudentPracticeClosureDto>(items.Select(item => Map(item, item.Student)).ToList(), page, pageSize, count);
    }

    private async Task<Student> GetStudentAsync(Guid id, bool write, CancellationToken cancellationToken)
    {
        var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");
        if (write ? !currentUser.HasPermission(Permissions.StudentsWrite) :
            !currentUser.HasPermission(Permissions.StudentsRead) &&
            !(currentUser.HasPermission(Permissions.StudentSelfRead) && student.UserAccountId == currentUser.UserId && student.IsActive))
            throw new ForbiddenException("No tiene permiso para esta operación del alumno.");
        if (write)
        {
            var now = timeProvider.GetUtcNow();
            var isAuthorizedStaff = await dbContext.Users.AsNoTracking()
                .Where(item => item.Id == currentUser.UserId && item.IsActive && !item.IsDeleted)
                .SelectMany(item => item.Roles)
                .AnyAsync(assignment => assignment.Role.IsActive &&
                    (assignment.ValidFromUtc == null || assignment.ValidFromUtc <= now) &&
                    (assignment.ValidUntilUtc == null || assignment.ValidUntilUtc > now) &&
                    (assignment.Role.NormalizedName == "ADMINISTRADOR" || assignment.Role.NormalizedName == "SECRETARIA"), cancellationToken);
            if (!isAuthorizedStaff) throw new ForbiddenException("Sólo administración o secretaría puede registrar y entregar el estudio jurídico.");
        }
        return student;
    }

    private async Task EnsureOpenAsync(Student student, CancellationToken cancellationToken)
    {
        if (!student.IsActive || await dbContext.StudentPracticeClosures.AnyAsync(item => item.StudentId == student.Id, cancellationToken))
            throw new ConflictException("La práctica del alumno está cerrada o el alumno está inactivo.");
        if (!await dbContext.EnrollmentApplications.AnyAsync(item => item.StudentId == student.Id && item.Status == EnrollmentStatus.Approved, cancellationToken))
            throw new ConflictException("La inscripción del alumno debe estar aprobada antes de registrar el estudio jurídico.");
    }

    private void ValidateDate(DateOnly date, DateOnly registrationDate)
    {
        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().ToOffset(TimeSpan.FromHours(-6)).DateTime);
        if (date < registrationDate || date > today) throw new ValidationException("La fecha debe estar entre la inscripción y hoy.");
    }

    private async Task EnsurePdfAsync(Guid studentId, Guid documentId, CancellationToken cancellationToken)
    {
        await documents.EnsureDocumentMatchesContextAsync(documentId, DocumentContextType.Student, studentId, cancellationToken);
        var document = await documents.GetMetadataAsync(documentId, cancellationToken);
        if (!string.Equals(document.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("Adjunte el documento firmado en formato PDF.");
    }

    private static StudentPracticeClosureDto Map(StudentPracticeClosure closure, Student student) =>
        new(student.Id, student.FullName, student.StudentCardNumber, closure.DeliveryDate,
            closure.FinalDocumentId, closure.Notes, closure.CreatedAtUtc);
}
