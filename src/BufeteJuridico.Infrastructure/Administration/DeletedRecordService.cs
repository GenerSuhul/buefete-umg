using BufeteJuridico.Application.Administration;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Clients;
using BufeteJuridico.Domain.Common;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Administration;

internal sealed class DeletedRecordService(
    BufeteDbContext dbContext,
    ICurrentUser currentUser,
    TimeProvider timeProvider) : IDeletedRecordService
{
    public async Task DeleteAsync(
        DeletedRecordType type,
        Guid id,
        string? reason,
        CancellationToken cancellationToken)
    {
        var cleanedReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (cleanedReason?.Length > 500)
            throw new ValidationException("El motivo no puede exceder 500 caracteres.");

        await ExecuteInTransactionAsync(async () =>
        {
            var now = timeProvider.GetUtcNow();
            var batchId = Guid.NewGuid();
            switch (type)
            {
                case DeletedRecordType.Client:
                    await DeleteClientAsync(id, cleanedReason, now, batchId, cancellationToken);
                    break;
                case DeletedRecordType.Student:
                    await DeleteStudentAsync(id, cleanedReason, now, batchId, cancellationToken);
                    break;
                case DeletedRecordType.LegalCase:
                    await DeleteCaseAsync(id, cleanedReason, now, batchId, cancellationToken);
                    break;
                default:
                    throw new ValidationException("El tipo de registro no es válido.");
            }
        }, cancellationToken);
    }

    public async Task<PagedResult<DeletedRecordDto>> GetAsync(
        DeletedRecordType? type,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var term = search?.Trim();

        var projections = new List<DeletedProjection>();
        if (type is null or DeletedRecordType.Client)
        {
            var clients = dbContext.Clients.IgnoreQueryFilters().Where(item => item.DeletedAtUtc != null);
            if (!string.IsNullOrWhiteSpace(term))
                clients = clients.Where(item => EF.Functions.ILike(item.FullName, $"%{term}%") || EF.Functions.ILike(item.ReceptionNumber, $"%{term}%"));
            projections.AddRange(await clients.Select(item => new DeletedProjection(
                item.Id, (int)DeletedRecordType.Client, item.FullName, item.ReceptionNumber,
                item.DeletedAtUtc!.Value, item.DeletedByUserId, item.DeletionReason)).ToListAsync(cancellationToken));
        }

        if (type is null or DeletedRecordType.Student)
        {
            var students = dbContext.Students.IgnoreQueryFilters().Where(item => item.DeletedAtUtc != null);
            if (!string.IsNullOrWhiteSpace(term))
                students = students.Where(item => EF.Functions.ILike(item.FullName, $"%{term}%") || EF.Functions.ILike(item.StudentCardNumber, $"%{term}%"));
            projections.AddRange(await students.Select(item => new DeletedProjection(
                item.Id, (int)DeletedRecordType.Student, item.FullName, item.StudentCardNumber,
                item.DeletedAtUtc!.Value, item.DeletedByUserId, item.DeletionReason)).ToListAsync(cancellationToken));
        }

        if (type is null or DeletedRecordType.LegalCase)
        {
            var cases = dbContext.LegalCases.IgnoreQueryFilters().Where(item => item.DeletedAtUtc != null);
            if (!string.IsNullOrWhiteSpace(term))
                cases = cases.Where(item => EF.Functions.ILike(item.CaseNumber, $"%{term}%") || EF.Functions.ILike(item.Stage, $"%{term}%"));
            projections.AddRange(await cases.Select(item => new DeletedProjection(
                item.Id, (int)DeletedRecordType.LegalCase, item.CaseNumber, item.Stage,
                item.DeletedAtUtc!.Value, item.DeletedByUserId, item.DeletionReason)).ToListAsync(cancellationToken));
        }

        var total = projections.Count;
        projections = projections.OrderByDescending(item => item.DeletedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
        var userIds = projections.Where(item => item.DeletedByUserId.HasValue)
            .Select(item => item.DeletedByUserId!.Value).Distinct().ToList();
        var names = await dbContext.Users.AsNoTracking().Where(item => userIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.FullName, cancellationToken);
        var items = projections.Select(item => new DeletedRecordDto(
            item.Id, (DeletedRecordType)item.Type, item.Name, item.Reference, item.DeletedAtUtc,
            item.DeletedByUserId,
            item.DeletedByUserId is Guid userId && names.TryGetValue(userId, out var name) ? name : null,
            item.Reason)).ToList();
        return new PagedResult<DeletedRecordDto>(items, page, pageSize, total);
    }

    public async Task RestoreAsync(DeletedRecordType type, Guid id, CancellationToken cancellationToken)
    {
        await ExecuteInTransactionAsync(async () =>
        {
            switch (type)
            {
                case DeletedRecordType.Client:
                    await RestoreClientAsync(id, cancellationToken);
                    break;
                case DeletedRecordType.Student:
                    await RestoreStudentAsync(id, cancellationToken);
                    break;
                case DeletedRecordType.LegalCase:
                    await RestoreCaseAsync(id, cancellationToken);
                    break;
                default:
                    throw new ValidationException("El tipo de registro no es válido.");
            }
        }, cancellationToken);
    }

    private async Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            await operation();
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });
    }

    private async Task DeleteClientAsync(Guid id, string? reason, DateTimeOffset now, Guid batchId, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el cliente.");
        MarkDeleted(client, reason, now, batchId);

        var cases = await dbContext.LegalCases.Where(item => item.ClientId == id).ToListAsync(cancellationToken);
        foreach (var legalCase in cases) MarkDeleted(legalCase, "Cliente eliminado", now, batchId);
        await HideDocumentsAsync(id, cases.Select(item => item.Id).ToList(), [], null, batchId, now, cancellationToken);
    }

    private async Task DeleteStudentAsync(Guid id, string? reason, DateTimeOffset now, Guid batchId, CancellationToken cancellationToken)
    {
        var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno.");
        MarkDeleted(student, reason, now, batchId);
        student.IsActive = false;
        if (student.UserAccountId is Guid userId)
        {
            var user = await dbContext.Users.SingleAsync(item => item.Id == userId, cancellationToken);
            student.UserAccountWasActiveAtDeletion = user.IsActive;
            user.IsActive = false;
            user.SecurityStamp = Guid.NewGuid();
            await RevokeRefreshTokensAsync(userId, now, cancellationToken);
        }

        var enrollmentIds = await dbContext.EnrollmentApplications.Where(item => item.StudentId == id)
            .Select(item => item.Id).ToListAsync(cancellationToken);
        await HideDocumentsAsync(null, [], [id, .. enrollmentIds], student.UserAccountId, batchId, now, cancellationToken);
    }

    private async Task DeleteCaseAsync(Guid id, string? reason, DateTimeOffset now, Guid batchId, CancellationToken cancellationToken)
    {
        var legalCase = await dbContext.LegalCases.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        MarkDeleted(legalCase, reason, now, batchId);
        await HideDocumentsAsync(null, [id], [], null, batchId, now, cancellationToken);
    }

    private async Task RestoreClientAsync(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.IgnoreQueryFilters().SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc != null, cancellationToken)
            ?? throw new NotFoundException("No se encontró el cliente eliminado.");
        var batchId = client.DeletionBatchId;
        Restore(client);
        if (batchId is Guid batch)
        {
            var cases = await dbContext.LegalCases.IgnoreQueryFilters().Where(item => item.DeletionBatchId == batch).ToListAsync(cancellationToken);
            foreach (var legalCase in cases) Restore(legalCase);
            await RestoreDocumentsAsync(batch, cancellationToken);
        }
    }

    private async Task RestoreStudentAsync(Guid id, CancellationToken cancellationToken)
    {
        var student = await dbContext.Students.IgnoreQueryFilters().SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc != null, cancellationToken)
            ?? throw new NotFoundException("No se encontró el alumno eliminado.");
        var batchId = student.DeletionBatchId;
        Restore(student);
        student.IsActive = true;
        if (student.UserAccountId is Guid userId)
        {
            var user = await dbContext.Users.SingleAsync(item => item.Id == userId, cancellationToken);
            user.IsActive = student.UserAccountWasActiveAtDeletion ?? false;
            user.SecurityStamp = Guid.NewGuid();
            await RevokeRefreshTokensAsync(userId, timeProvider.GetUtcNow(), cancellationToken);
        }
        student.UserAccountWasActiveAtDeletion = null;
        if (batchId is Guid batch) await RestoreDocumentsAsync(batch, cancellationToken);
    }

    private async Task RestoreCaseAsync(Guid id, CancellationToken cancellationToken)
    {
        var legalCase = await dbContext.LegalCases.IgnoreQueryFilters().SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc != null, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente eliminado.");
        var clientDeleted = await dbContext.Clients.IgnoreQueryFilters().AnyAsync(
            item => item.Id == legalCase.ClientId && item.DeletedAtUtc != null, cancellationToken);
        if (clientDeleted) throw new ConflictException("Restaure primero el cliente propietario del expediente.");
        var batchId = legalCase.DeletionBatchId;
        Restore(legalCase);
        if (batchId is Guid batch) await RestoreDocumentsAsync(batch, cancellationToken);
    }

    private async Task HideDocumentsAsync(
        Guid? clientId,
        IReadOnlyCollection<Guid> caseIds,
        IReadOnlyCollection<Guid> studentContextIds,
        Guid? userAccountId,
        Guid batchId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var caseRequirementIds = caseIds.Count == 0 ? [] : await dbContext.CaseRequirements.Where(item => caseIds.Contains(item.LegalCaseId)).Select(item => item.Id).ToListAsync(cancellationToken);
        var timelineIds = caseIds.Count == 0 ? [] : await dbContext.TimelineEntries.Where(item => caseIds.Contains(item.LegalCaseId)).Select(item => item.Id).ToListAsync(cancellationToken);
        var memorialIds = caseIds.Count == 0 ? [] : await dbContext.Memorials.Where(item => caseIds.Contains(item.LegalCaseId)).Select(item => item.Id).ToListAsync(cancellationToken);
        var incomeDeclarationIds = clientId is null
            ? []
            : await dbContext.IncomeDeclarations.Where(item => item.ClientId == clientId).Select(item => item.Id).ToListAsync(cancellationToken);

        var documents = await dbContext.Documents.Where(item => item.DeletedAtUtc == null && (
                (clientId != null && item.ContextType == DocumentContextType.Client && item.ContextId == clientId) ||
                (item.ContextType == DocumentContextType.IncomeDeclaration && incomeDeclarationIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.LegalCase && caseIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.CaseRequirement && caseRequirementIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.Timeline && timelineIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.Memorial && memorialIds.Contains(item.ContextId)) ||
                ((item.ContextType == DocumentContextType.Student || item.ContextType == DocumentContextType.Enrollment) && studentContextIds.Contains(item.ContextId)) ||
                (userAccountId != null && item.ContextType == DocumentContextType.UserPhoto && item.ContextId == userAccountId)))
            .ToListAsync(cancellationToken);
        foreach (var document in documents)
        {
            document.DeletedAtUtc = now;
            document.DeletedByUserId = currentUser.UserId;
            document.DeletionBatchId = batchId;
        }
    }

    private async Task RestoreDocumentsAsync(Guid batchId, CancellationToken cancellationToken)
    {
        var documents = await dbContext.Documents.IgnoreQueryFilters()
            .Where(item => item.DeletionBatchId == batchId)
            .ToListAsync(cancellationToken);
        foreach (var document in documents)
        {
            document.DeletedAtUtc = null;
            document.DeletedByUserId = null;
            document.DeletionBatchId = null;
        }
    }

    private async Task RevokeRefreshTokensAsync(Guid userId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var tokens = await dbContext.RefreshTokens
            .Where(item => item.UserId == userId && item.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in tokens) token.RevokedAtUtc = now;
    }

    private void MarkDeleted(SoftDeletableEntity entity, string? reason, DateTimeOffset now, Guid batchId)
    {
        entity.DeletedAtUtc = now;
        entity.DeletedByUserId = currentUser.UserId;
        entity.DeletionReason = reason;
        entity.DeletionBatchId = batchId;
    }

    private static void Restore(SoftDeletableEntity entity)
    {
        entity.DeletedAtUtc = null;
        entity.DeletedByUserId = null;
        entity.DeletionReason = null;
        entity.DeletionBatchId = null;
    }

    private sealed record DeletedProjection(
        Guid Id,
        int Type,
        string Name,
        string Reference,
        DateTimeOffset DeletedAtUtc,
        Guid? DeletedByUserId,
        string? Reason);
}
