using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Application.Students;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Students;

internal sealed class StudentDisciplineService(TenantRegistry registry, TenantContext tenant,
    BufeteDbContext local, IDocumentService documents, IFileStorage storage, ICurrentUser currentUser,
    TimeProvider clock) : IStudentDisciplineService
{
    private static string Key(string dpi) => ContactNormalization.Digits(dpi);
    private DateOnly Today => StudentDisciplineCalendar.Today(clock.GetUtcNow());

    private async Task<Student> RequireStudentAsync(Guid id, CancellationToken ct) =>
        await local.Students.SingleOrDefaultAsync(s => s.Id == id, ct)
        ?? throw new NotFoundException("No se encontró el alumno.");

    private async Task RequireAdministratorAsync(CancellationToken ct)
    {
        var user = await local.Users.Include(u => u.Roles).ThenInclude(r => r.Role)
            .SingleOrDefaultAsync(u => u.Id == currentUser.UserId, ct);
        if (user is null || !UserAccessRules.CanSignIn(user, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime)) ||
            !user.Roles.Any(r => r.Role.NormalizedName == "ADMINISTRADOR"))
            throw new ForbiddenException("Sólo los administradores pueden registrar o retirar amonestaciones.");
        if (user.IsPlatformAccount) await registry.RequirePlatformAsync(ct);
    }

    public async Task<IReadOnlyList<StudentDisciplineDto>> ListAsync(Guid studentId, CancellationToken ct)
    {
        if (!currentUser.HasPermission(Permissions.StudentsRead) && !currentUser.HasPermission(Permissions.StudentSelfRead))
            throw new ForbiddenException("No tiene permiso para consultar al alumno.");
        var student = await RequireStudentAsync(studentId, ct);
        if (!currentUser.HasPermission(Permissions.StudentsRead) && student.UserAccountId != currentUser.UserId)
            throw new ForbiddenException("Sólo puede consultar sus propias amonestaciones.");
        await using var central = registry.OpenCentral();
        var key = Key(student.Dpi);
        var rows = await central.StudentDisciplines.AsNoTracking().Where(x => x.Dpi == key)
            .OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<StudentDisciplineDto> CreateAsync(Guid studentId, CreateStudentDisciplineRequest request, CancellationToken ct)
    {
        await RequireAdministratorAsync(ct);
        var student = await RequireStudentAsync(studentId, ct);
        var reason = request.Reason?.Trim() ?? "";
        if (!Enum.IsDefined(request.Kind) || reason.Length is < 10 or > 2000)
            throw new ValidationException("Seleccione un tipo e indique un motivo de 10 a 2000 caracteres.");
        if (request.Kind == StudentDisciplineKind.WrittenWarning && request.DocumentId is null)
            throw new ValidationException("Adjunte la amonestación escrita firmada en PDF.");
        if (request.Kind == StudentDisciplineKind.SixMonthSuspension &&
            (request.StartsOn is null || request.EndsOn != request.StartsOn.Value.AddMonths(6)))
            throw new ValidationException("La suspensión temporal requiere inicio y finalización exactamente seis meses después.");
        if (request.Kind != StudentDisciplineKind.SixMonthSuspension && (request.StartsOn is not null || request.EndsOn is not null))
            throw new ValidationException("Sólo la suspensión temporal utiliza fechas de vigencia.");
        if (request.DocumentId is Guid documentId)
        {
            await documents.EnsureDocumentMatchesContextAsync(documentId, DocumentContextType.Student, studentId, ct);
            var metadata = await documents.GetMetadataAsync(documentId, ct);
            if (metadata.ContentType != "application/pdf") throw new ValidationException("El documento de amonestación debe ser PDF.");
        }
        var key = Key(student.Dpi);
        await using var strategyContext = registry.OpenCentral();
        return await strategyContext.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var central = registry.OpenCentral();
            await using var transaction = await central.Database.BeginTransactionAsync(ct);
            await central.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 1))", ct);
            if (request.Kind != StudentDisciplineKind.WrittenWarning &&
                await central.StudentDisciplines.AnyAsync(x => x.Dpi == key && x.RevokedAtUtc == null &&
                    (x.Kind == StudentDisciplineKind.PermanentSuspension ||
                     (x.Kind == StudentDisciplineKind.SixMonthSuspension && x.EndsOn >= Today)), ct))
                throw new ConflictException("El alumno ya tiene una suspensión vigente.");
            var entry = new StudentDiscipline { Dpi = key, StudentName = student.FullName,
                Kind = request.Kind, Reason = reason, StartsOn = request.StartsOn,
                EndsOn = request.EndsOn, DocumentId = request.DocumentId,
                SourceTenantCode = tenant.Code, IssuedByName = currentUser.Username ?? "Administrador" };
            central.StudentDisciplines.Add(entry);
            await central.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Map(entry);
        });
    }

    public async Task<StudentDisciplineDto> RevokeAsync(Guid studentId, Guid id, RevokeStudentDisciplineRequest request, CancellationToken ct)
    {
        await RequireAdministratorAsync(ct);
        var student = await RequireStudentAsync(studentId, ct);
        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length is < 10 or > 2000)
            throw new ValidationException("Indique un motivo de 10 a 2000 caracteres para retirar la amonestación.");
        var key = Key(student.Dpi);
        await using var strategyContext = registry.OpenCentral();
        return await strategyContext.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var central = registry.OpenCentral();
            await using var transaction = await central.Database.BeginTransactionAsync(ct);
            await central.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 1))", ct);
            var entry = await central.StudentDisciplines.SingleOrDefaultAsync(x => x.Id == id && x.Dpi == key, ct)
                ?? throw new NotFoundException("No se encontró la amonestación.");
            if (entry.RevokedAtUtc is not null) throw new ConflictException("La amonestación ya fue retirada.");
            entry.RevokedAtUtc = clock.GetUtcNow();
            entry.RevokedByUserId = currentUser.UserId;
            entry.RevocationReason = reason;
            await central.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Map(entry);
        });
    }

    public Task<bool> IsBlockedAsync(string dpi, CancellationToken ct) => registry.IsStudentSuspendedAsync(dpi, ct);

    public async Task<DocumentDownloadAccess> GetDocumentAsync(Guid studentId, Guid id, CancellationToken ct)
    {
        if (!currentUser.HasPermission(Permissions.StudentsRead) && !currentUser.HasPermission(Permissions.StudentSelfRead))
            throw new ForbiddenException("No tiene permiso para consultar al alumno.");
        var student = await RequireStudentAsync(studentId, ct);
        if (!currentUser.HasPermission(Permissions.StudentsRead) && student.UserAccountId != currentUser.UserId)
            throw new ForbiddenException("Sólo puede consultar sus propias amonestaciones.");
        await using var central = registry.OpenCentral();
        var discipline = await central.StudentDisciplines.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id && x.Dpi == Key(student.Dpi), ct)
            ?? throw new NotFoundException("No se encontró la amonestación.");
        if (discipline.DocumentId is not Guid documentId)
            throw new NotFoundException("Esta amonestación no tiene PDF.");
        var source = await registry.ResolveForHistoricalReadAsync(discipline.SourceTenantCode, ct);
        await using var sourceDb = registry.OpenTenant(source);
        var document = await sourceDb.Documents.AsNoTracking().SingleOrDefaultAsync(x => x.Id == documentId &&
            x.ContextType == DocumentContextType.Student && x.DeletedAtUtc == null, ct)
            ?? throw new NotFoundException("No se encontró el PDF de la amonestación.");
        var owner = await sourceDb.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == document.ContextId, ct);
        if (owner is null || Key(owner.Dpi) != discipline.Dpi || document.ContentType != "application/pdf" ||
            !document.StorageKey.StartsWith($"tenants/{source.Code}/", StringComparison.Ordinal))
            throw new ForbiddenException("El PDF no corresponde a esta amonestación.");
        return new DocumentDownloadAccess(document.OriginalFileName, document.ContentType,
            await storage.OpenReadAsync(document.StorageKey, ct), null);
    }

    public async Task EnsureNotBlockedAsync(string dpi, CancellationToken ct)
    {
        if (await IsBlockedAsync(dpi, ct))
            throw new ConflictException("El alumno tiene una suspensión global vigente. Consulte con la administración.");
    }

    private StudentDisciplineDto Map(StudentDiscipline x) => new(x.Id, x.Dpi, x.StudentName,
        x.Kind, x.Reason, x.StartsOn, x.EndsOn, x.DocumentId, x.SourceTenantCode,
        x.IssuedByName, x.CreatedAtUtc, x.RevokedAtUtc, x.RevocationReason,
        x.RevokedAtUtc is null && (x.Kind == StudentDisciplineKind.PermanentSuspension ||
        (x.Kind == StudentDisciplineKind.SixMonthSuspension && x.StartsOn <= Today && x.EndsOn >= Today)));
}
