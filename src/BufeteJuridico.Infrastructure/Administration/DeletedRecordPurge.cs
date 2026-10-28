using System.Data;
using BufeteJuridico.Application.Administration;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Documents;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Administration;

internal sealed partial class DeletedRecordService
{
    private sealed record PurgePlan(
        DeletedRecordType Type,
        Guid Id,
        string Reference,
        Guid? UserAccountId,
        IReadOnlyList<Guid> CaseIds,
        IReadOnlyList<Guid> EnrollmentIds,
        IReadOnlyList<Guid> DocumentIds,
        IReadOnlyList<Guid> ScanIds,
        IReadOnlyList<string> StorageKeys,
        int DocumentCount,
        long DocumentBytes,
        string? BlockReason);

    public async Task<PurgePreviewDto> PreviewPurgeAsync(DeletedRecordType type, Guid id, CancellationToken cancellationToken)
    {
        var plan = await BuildPurgePlanAsync(type, id, cancellationToken);
        return new PurgePreviewDto(type, id, plan.Reference, plan.DocumentCount, plan.DocumentBytes, plan.BlockReason);
    }

    public async Task<PurgeResultDto> PurgeAsync(DeletedRecordType type, Guid id, string reference, CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        PurgePlan? completed = null;
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            var plan = await BuildPurgePlanAsync(type, id, cancellationToken);
            if (!string.Equals(reference, plan.Reference, StringComparison.Ordinal))
                throw new ValidationException("Escriba la referencia exacta del registro para confirmar su eliminación.");
            if (plan.BlockReason is not null) throw new ConflictException(plan.BlockReason);

            foreach (var key in plan.StorageKeys)
                await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO bufete.pending_storage_purges ("StorageKey", "EnqueuedAtUtc")
                    VALUES ({key}, now()) ON CONFLICT ("StorageKey") DO NOTHING
                    """, cancellationToken);

            await dbContext.ScanSessions.IgnoreQueryFilters().Where(item => plan.ScanIds.Contains(item.Id)).ExecuteDeleteAsync(cancellationToken);
            await dbContext.Documents.IgnoreQueryFilters().Where(item => plan.DocumentIds.Contains(item.PreviousVersionId ?? Guid.Empty))
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.PreviousVersionId, (Guid?)null), cancellationToken);
            await dbContext.Documents.IgnoreQueryFilters().Where(item => plan.DocumentIds.Contains(item.Id)).ExecuteDeleteAsync(cancellationToken);

            if (type is DeletedRecordType.LegalCase or DeletedRecordType.Client)
            {
                await dbContext.CasePresentations.IgnoreQueryFilters().Where(item => plan.CaseIds.Contains(item.LegalCaseId)).ExecuteDeleteAsync(cancellationToken);
                await dbContext.CourtNotifications.IgnoreQueryFilters().Where(item => plan.CaseIds.Contains(item.LegalCaseId)).ExecuteDeleteAsync(cancellationToken);
                await dbContext.Memorials.IgnoreQueryFilters().Where(item => plan.CaseIds.Contains(item.LegalCaseId)).ExecuteDeleteAsync(cancellationToken);
                await dbContext.CaseAssignments.IgnoreQueryFilters().Where(item => plan.CaseIds.Contains(item.LegalCaseId)).ExecuteDeleteAsync(cancellationToken);
                await dbContext.SecretariatActivities.Where(item => plan.CaseIds.Contains(item.LegalCaseId ?? Guid.Empty))
                    .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.LegalCaseId, (Guid?)null), cancellationToken);
                await dbContext.LegalCases.IgnoreQueryFilters().Where(item => plan.CaseIds.Contains(item.Id)).ExecuteDeleteAsync(cancellationToken);
            }
            if (type == DeletedRecordType.Client)
            {
                await dbContext.IncomeDeclarations.IgnoreQueryFilters().Where(item => item.ClientId == id).ExecuteDeleteAsync(cancellationToken);
                await dbContext.SecretariatActivities.Where(item => item.ClientId == id)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.ClientId, (Guid?)null), cancellationToken);
                await dbContext.Clients.IgnoreQueryFilters().Where(item => item.Id == id && item.DeletedAtUtc != null).ExecuteDeleteAsync(cancellationToken);
            }
            if (type == DeletedRecordType.Student)
            {
                await dbContext.StudentLegalReviews.IgnoreQueryFilters().Where(item => item.StudentId == id).ExecuteDeleteAsync(cancellationToken);
                await dbContext.StudentPracticeClosures.IgnoreQueryFilters().Where(item => item.StudentId == id).ExecuteDeleteAsync(cancellationToken);
                await dbContext.EnrollmentApplications.IgnoreQueryFilters().Where(item => plan.EnrollmentIds.Contains(item.Id)).ExecuteDeleteAsync(cancellationToken);
                await dbContext.SecretariatActivities.Where(item => item.StudentId == id)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.StudentId, (Guid?)null), cancellationToken);
                await dbContext.Students.IgnoreQueryFilters().Where(item => item.Id == id && item.DeletedAtUtc != null).ExecuteDeleteAsync(cancellationToken);
                if (plan.UserAccountId is Guid userAccountId)
                    await dbContext.Users.IgnoreQueryFilters().Where(item => item.Id == userAccountId && !item.IsActive && !item.IsPlatformAccount).ExecuteDeleteAsync(cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
            completed = plan;
        });
        if (completed is null) throw new InvalidOperationException("La purga no se completó.");
        var pending = await RetryPendingStorageDeletesAsync(cancellationToken);
        return new PurgeResultDto(completed.DocumentCount, completed.DocumentBytes, pending);
    }

    public async Task<int> RetryPendingStorageDeletesAsync(CancellationToken cancellationToken)
    {
        var keys = await dbContext.Database.SqlQuery<string>($"""
            SELECT "StorageKey" AS "Value" FROM bufete.pending_storage_purges
            ORDER BY "EnqueuedAtUtc" LIMIT 200
            """).ToListAsync(cancellationToken);
        foreach (var key in keys)
        {
            try
            {
                await fileStorage.DeleteAsync(key, cancellationToken);
                await dbContext.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM bufete.pending_storage_purges WHERE \"StorageKey\" = {key}", cancellationToken);
            }
            catch (OperationCanceledException) { throw; }
            catch
            {
                await dbContext.Database.ExecuteSqlInterpolatedAsync($"UPDATE bufete.pending_storage_purges SET \"AttemptCount\" = \"AttemptCount\" + 1 WHERE \"StorageKey\" = {key}", cancellationToken);
            }
        }
        return await dbContext.Database.SqlQuery<int>($"SELECT count(*)::integer AS \"Value\" FROM bufete.pending_storage_purges").SingleAsync(cancellationToken);
    }

    private async Task<PurgePlan> BuildPurgePlanAsync(DeletedRecordType type, Guid id, CancellationToken cancellationToken)
    {
        string reference;
        Guid? userAccountId = null;
        List<Guid> caseIds = [];
        List<Guid> enrollmentIds = [];
        string? blocker = null;
        if (type == DeletedRecordType.Client)
        {
            var client = await dbContext.Clients.IgnoreQueryFilters().AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc != null, cancellationToken)
                ?? throw new NotFoundException("No se encontró el usuario dado de baja.");
            reference = client.ReceptionNumber;
            var related = await dbContext.LegalCases.IgnoreQueryFilters().AsNoTracking()
                .Where(item => item.ClientId == id).Select(item => new { item.Id, item.DeletedAtUtc }).ToListAsync(cancellationToken);
            if (related.Any(item => item.DeletedAtUtc is null)) blocker = "El usuario conserva expedientes activos. Dé de baja esos expedientes antes de eliminarlo definitivamente.";
            caseIds = related.Select(item => item.Id).ToList();
        }
        else if (type == DeletedRecordType.Student)
        {
            var student = await dbContext.Students.IgnoreQueryFilters().AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc != null, cancellationToken)
                ?? throw new NotFoundException("No se encontró el alumno dado de baja.");
            reference = student.StudentCardNumber;
            userAccountId = student.UserAccountId;
            if (userAccountId is Guid accountId)
            {
                var account = await dbContext.Users.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(item => item.Id == accountId, cancellationToken);
                if (account is null || account.IsActive || account.IsPlatformAccount ||
                    await dbContext.Students.IgnoreQueryFilters().AnyAsync(item => item.Id != id && item.UserAccountId == accountId, cancellationToken))
                    blocker = "La cuenta del alumno sigue activa o está compartida. Desactive el acceso y revise la relación antes de purgar.";
            }
            var assignmentCases = await dbContext.CaseAssignments.IgnoreQueryFilters()
                .Where(item => item.StudentId == id)
                .Select(item => new { item.LegalCase.CaseNumber, item.LegalCase.DeletedAtUtc }).ToListAsync(cancellationToken);
            if (assignmentCases.Any(item => item.DeletedAtUtc is null))
                blocker = "El alumno aún aparece en un expediente activo. Cierre o dé de baja esa relación antes de purgar.";
            else if (assignmentCases.Count > 0)
                blocker = "El alumno aparece en expedientes dados de baja. Purgue primero esos expedientes para conservar íntegro el historial de cada cliente.";
            enrollmentIds = await dbContext.EnrollmentApplications.IgnoreQueryFilters().Where(item => item.StudentId == id)
                .Select(item => item.Id).ToListAsync(cancellationToken);
        }
        else if (type == DeletedRecordType.LegalCase)
        {
            var legalCase = await dbContext.LegalCases.IgnoreQueryFilters().AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc != null, cancellationToken)
                ?? throw new NotFoundException("No se encontró el expediente dado de baja.");
            reference = legalCase.CaseNumber;
            caseIds.Add(id);
        }
        else throw new ValidationException("El tipo de registro no es válido.");

        var requirementIds = await dbContext.CaseRequirements.IgnoreQueryFilters().Where(item => caseIds.Contains(item.LegalCaseId)).Select(item => item.Id).ToListAsync(cancellationToken);
        var timelineIds = await dbContext.TimelineEntries.IgnoreQueryFilters().Where(item => caseIds.Contains(item.LegalCaseId)).Select(item => item.Id).ToListAsync(cancellationToken);
        var memorialIds = await dbContext.Memorials.IgnoreQueryFilters().Where(item => caseIds.Contains(item.LegalCaseId)).Select(item => item.Id).ToListAsync(cancellationToken);
        var incomeIds = type == DeletedRecordType.Client
            ? await dbContext.IncomeDeclarations.IgnoreQueryFilters().Where(item => item.ClientId == id).Select(item => item.Id).ToListAsync(cancellationToken)
            : [];
        var documents = await dbContext.Documents.IgnoreQueryFilters().AsNoTracking().Where(item =>
            (type == DeletedRecordType.Client && item.ContextType == DocumentContextType.Client && item.ContextId == id) ||
            (item.ContextType == DocumentContextType.IncomeDeclaration && incomeIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.LegalCase && caseIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.CaseRequirement && requirementIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.Timeline && timelineIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.Memorial && memorialIds.Contains(item.ContextId)) ||
            (type == DeletedRecordType.Student && item.ContextType == DocumentContextType.Student && item.ContextId == id) ||
            (type == DeletedRecordType.Student && userAccountId != null && item.ContextType == DocumentContextType.UserPhoto && item.ContextId == userAccountId) ||
            (item.ContextType == DocumentContextType.Enrollment && enrollmentIds.Contains(item.ContextId)))
            .Select(item => new { item.Id, item.StorageKey, item.SizeBytes }).ToListAsync(cancellationToken);
        var documentIds = documents.Select(item => item.Id).ToList();
        if (await dbContext.StudentDisciplines.IgnoreQueryFilters().AnyAsync(item => item.DocumentId != null && documentIds.Contains(item.DocumentId.Value), cancellationToken))
            blocker = "Una amonestación institucional usa uno de estos documentos. Debe conservarse en todas las sedes.";
        if (await dbContext.StudentLegalReviews.IgnoreQueryFilters().AnyAsync(item => documentIds.Contains(item.SignedDocumentId) && (type != DeletedRecordType.Student || item.StudentId != id), cancellationToken) ||
            await dbContext.StudentPracticeClosures.IgnoreQueryFilters().AnyAsync(item => documentIds.Contains(item.FinalDocumentId) && (type != DeletedRecordType.Student || item.StudentId != id), cancellationToken))
            blocker = "Una revisión o cierre de práctica ajenos utiliza uno de estos documentos. Conserve ese historial.";
        if (await dbContext.Users.IgnoreQueryFilters().AnyAsync(item => (userAccountId == null || item.Id != userAccountId) && item.PhotoDocumentId != null && documentIds.Contains(item.PhotoDocumentId.Value), cancellationToken))
            blocker = "Una cuenta activa utiliza uno de estos documentos como fotografía. Retire esa relación antes de purgar.";
        if (await dbContext.Documents.IgnoreQueryFilters().AnyAsync(item => item.PreviousVersionId != null && documentIds.Contains(item.PreviousVersionId.Value) && !documentIds.Contains(item.Id), cancellationToken))
            blocker = "Una versión de documento fuera de este registro depende de sus archivos. Revise la relación antes de purgar.";

        var scans = await dbContext.ScanSessions.AsNoTracking().Include(item => item.Pages).Where(item =>
            (type == DeletedRecordType.Client && item.ContextType == DocumentContextType.Client && item.ContextId == id) ||
            (item.ContextType == DocumentContextType.IncomeDeclaration && incomeIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.LegalCase && caseIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.CaseRequirement && requirementIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.Timeline && timelineIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.Memorial && memorialIds.Contains(item.ContextId)) ||
            (type == DeletedRecordType.Student && item.ContextType == DocumentContextType.Student && item.ContextId == id) ||
            (type == DeletedRecordType.Student && userAccountId != null && item.ContextType == DocumentContextType.UserPhoto && item.ContextId == userAccountId) ||
            (item.ContextType == DocumentContextType.Enrollment && enrollmentIds.Contains(item.ContextId)))
            .ToListAsync(cancellationToken);
        var scanIds = scans.Select(item => item.Id).ToList();
        if (await dbContext.ScanSessions.AnyAsync(item =>
            !scanIds.Contains(item.Id) && ((item.DocumentId != null && documentIds.Contains(item.DocumentId.Value)) ||
            (item.ReplaceDocumentId != null && documentIds.Contains(item.ReplaceDocumentId.Value))), cancellationToken))
            blocker = "Una sesión de escaneo ajena todavía utiliza uno de estos documentos.";
        var keys = documents.Select(item => item.StorageKey)
            .Concat(scans.SelectMany(item => item.Pages.Select(page => page.OriginalStorageKey)))
            .Concat(scans.Select(item => item.StagedStorageKey))
            .Where(key => !string.IsNullOrWhiteSpace(key)).Select(key => key!)
            .Distinct(StringComparer.Ordinal).ToList();
        if (await dbContext.Documents.IgnoreQueryFilters().AnyAsync(item => !documentIds.Contains(item.Id) && keys.Contains(item.StorageKey), cancellationToken) ||
            await dbContext.ScanPages.AnyAsync(item => !scanIds.Contains(item.ScanSessionId) && keys.Contains(item.OriginalStorageKey), cancellationToken) ||
            await dbContext.ScanSessions.AnyAsync(item => !scanIds.Contains(item.Id) && item.StagedStorageKey != null && keys.Contains(item.StagedStorageKey), cancellationToken))
            blocker = "Otro registro utiliza un archivo de este elemento. Conserve el archivo hasta resolver la referencia compartida.";
        return new PurgePlan(type, id, reference, userAccountId, caseIds, enrollmentIds, documentIds, scanIds,
            keys, documents.Count, documents.Sum(item => item.SizeBytes), blocker);
    }
}
