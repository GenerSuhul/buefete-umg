using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Queries;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Queries;

internal sealed class QueryService(BufeteDbContext dbContext) : IQueryService
{
    public async Task<PagedResult<SearchResultDto>> SearchAsync(
        string term,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(term) || term.Trim().Length < 2)
            throw new ValidationException("La búsqueda debe contener al menos dos caracteres.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var normalized = TextNormalization.Normalize(term);

        var clients = await dbContext.Clients.AsNoTracking()
            .Where(item => item.IsActive && item.NormalizedFullName.Contains(normalized))
            .OrderBy(item => item.NormalizedFullName)
            .ThenBy(item => item.Id)
            .Select(item => new { item.Id, item.FullName, Secondary = item.Dpi ?? item.ReceptionNumber })
            .Take(250)
            .ToListAsync(cancellationToken);
        var students = await dbContext.Students.AsNoTracking()
            .Where(item => item.IsActive && item.NormalizedFullName.Contains(normalized))
            .OrderBy(item => item.NormalizedFullName)
            .ThenBy(item => item.Id)
            .Select(item => new { item.Id, item.FullName, Secondary = item.StudentCardNumber })
            .Take(250)
            .ToListAsync(cancellationToken);

        var clientIds = clients.Select(item => item.Id).ToList();
        var latestClientCases = clientIds.Count == 0
            ? []
            : await dbContext.LegalCases.AsNoTracking()
                .Where(item => clientIds.Contains(item.ClientId))
                .GroupBy(item => item.ClientId)
                .Select(group => group
                    .OrderByDescending(item => item.OpenedAtUtc)
                    .Select(item => new SearchCaseSnapshot(
                        group.Key,
                        item.Id,
                        item.Status,
                        item.Timeline
                            .OrderByDescending(entry => entry.OccurredAtUtc)
                            .Select(entry => entry.Title)
                            .FirstOrDefault()))
                    .First())
                .ToListAsync(cancellationToken);
        var clientCaseMap = latestClientCases.ToDictionary(item => item.OwnerId);

        var studentIds = students.Select(item => item.Id).ToList();
        var latestStudentCases = studentIds.Count == 0
            ? []
            : await dbContext.CaseAssignments.AsNoTracking()
                .Where(item => studentIds.Contains(item.StudentId))
                .GroupBy(item => item.StudentId)
                .Select(group => group
                    .OrderByDescending(item => item.AssignedAtUtc)
                    .Select(item => new SearchCaseSnapshot(
                        group.Key,
                        item.LegalCaseId,
                        item.LegalCase.Status,
                        item.LegalCase.Timeline
                            .OrderByDescending(entry => entry.OccurredAtUtc)
                            .Select(entry => entry.Title)
                            .FirstOrDefault()))
                    .First())
                .ToListAsync(cancellationToken);
        var studentCaseMap = latestStudentCases.ToDictionary(item => item.OwnerId);

        var results = clients.Select(client =>
            {
                clientCaseMap.TryGetValue(client.Id, out var latestCase);
                return new SearchResultDto(
                    client.Id, "Client", client.FullName, client.Secondary, latestCase?.CaseId,
                    latestCase?.Status.ToString(), latestCase?.LastStep);
            })
            .Concat(students.Select(student =>
            {
                studentCaseMap.TryGetValue(student.Id, out var latestCase);
                return new SearchResultDto(
                    student.Id, "Student", student.FullName, student.Secondary, latestCase?.CaseId,
                    latestCase?.Status.ToString(), latestCase?.LastStep);
            }))
            .ToList();

        var ordered = results.OrderBy(item => item.DisplayName).ThenBy(item => item.ResultType).ToList();
        return new PagedResult<SearchResultDto>(
            ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList(), page, pageSize, ordered.Count);
    }

    public async Task<PagedResult<AuditLogDto>> GetAuditAsync(
        Guid? userId,
        string? entityType,
        Guid? entityId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var query = dbContext.AuditLogs.AsNoTracking().AsQueryable();
        if (userId is not null) query = query.Where(item => item.UserId == userId);
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(item => item.EntityType == entityType.Trim());
        if (entityId is not null) query = query.Where(item => item.EntityId == entityId.ToString());
        if (from is not null) query = query.Where(item => item.OccurredAtUtc >= from);
        if (to is not null) query = query.Where(item => item.OccurredAtUtc <= to);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(item => item.OccurredAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(item => new AuditLogDto(
                item.Id, item.UserId, item.Username, item.OccurredAtUtc, item.Action, item.EntityType,
                item.EntityId, item.ChangesJson, item.TraceId, item.IpAddress))
            .ToListAsync(cancellationToken);
        return new PagedResult<AuditLogDto>(items, page, pageSize, total);
    }

    public async Task<PagedResult<RetentionCandidateDto>> GetRetentionCandidatesAsync(
        DateTimeOffset asOfUtc,
        int retentionDays,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        ValidateRetentionDays(retentionDays);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var cutoff = asOfUtc.AddDays(-retentionDays);
        var query = dbContext.LegalCases.AsNoTracking().Include(item => item.Client).Include(item => item.Timeline)
            .Where(item => item.Status == LegalCaseStatus.Closed && item.RetentionStartsAtUtc != null && item.RetentionStartsAtUtc <= cutoff);
        var total = await query.CountAsync(cancellationToken);
        var cases = await query.OrderBy(item => item.RetentionStartsAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var documentCounts = await GetRetentionDocumentCountsAsync(
            cases.Select(item => item.Id).ToList(),
            cancellationToken);
        var results = cases
            .Select(legalCase => MapRetentionCandidate(
                legalCase,
                retentionDays,
                documentCounts.GetValueOrDefault(legalCase.Id)))
            .ToList();
        return new PagedResult<RetentionCandidateDto>(results, page, pageSize, total);
    }

    public async Task<RetentionPreviewDto> GetRetentionPreviewAsync(
        Guid caseId,
        DateTimeOffset asOfUtc,
        int retentionDays,
        CancellationToken cancellationToken)
    {
        ValidateRetentionDays(retentionDays);
        var legalCase = await dbContext.LegalCases.AsNoTracking().Include(item => item.Client).Include(item => item.Timeline)
            .SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        if (legalCase.Status != LegalCaseStatus.Closed || legalCase.RetentionStartsAtUtc is null || legalCase.RetentionStartsAtUtc.Value.AddDays(retentionDays) > asOfUtc)
            throw new ConflictException("El expediente todavía no es candidato a retención.");
        var documentCounts = await GetRetentionDocumentCountsAsync([legalCase.Id], cancellationToken);
        var candidate = MapRetentionCandidate(
            legalCase,
            retentionDays,
            documentCounts.GetValueOrDefault(legalCase.Id));
        return new RetentionPreviewDto(
            candidate,
            [
                "Metadatos del expediente judicial",
                $"{candidate.DocumentCount} documentos vinculados directa o indirectamente",
                $"{candidate.TimelineEntryCount} actuaciones cronológicas",
                "Asignaciones de alumnos, memoriales, revisiones, notificaciones y presentaciones"
            ],
            true,
            "La depuración física está bloqueada hasta que la institución apruebe por escrito la política de conservación y el alcance legal.");
    }

    private async Task<Dictionary<Guid, int>> GetRetentionDocumentCountsAsync(
        IReadOnlyCollection<Guid> caseIds,
        CancellationToken cancellationToken)
    {
        if (caseIds.Count == 0) return [];

        var requirementOwners = await dbContext.CaseRequirements.AsNoTracking()
            .Where(item => caseIds.Contains(item.LegalCaseId))
            .Select(item => new RetentionContextOwner(item.Id, item.LegalCaseId))
            .ToListAsync(cancellationToken);
        var timelineOwners = await dbContext.TimelineEntries.AsNoTracking()
            .Where(item => caseIds.Contains(item.LegalCaseId))
            .Select(item => new RetentionContextOwner(item.Id, item.LegalCaseId))
            .ToListAsync(cancellationToken);
        var memorialOwners = await dbContext.Memorials.AsNoTracking()
            .Where(item => caseIds.Contains(item.LegalCaseId))
            .Select(item => new RetentionContextOwner(item.Id, item.LegalCaseId))
            .ToListAsync(cancellationToken);

        var requirementMap = requirementOwners.ToDictionary(item => item.ContextId, item => item.CaseId);
        var timelineMap = timelineOwners.ToDictionary(item => item.ContextId, item => item.CaseId);
        var memorialMap = memorialOwners.ToDictionary(item => item.ContextId, item => item.CaseId);
        var requirementIds = requirementMap.Keys.ToList();
        var timelineIds = timelineMap.Keys.ToList();
        var memorialIds = memorialMap.Keys.ToList();

        var documentGroups = await dbContext.Documents.AsNoTracking()
            .Where(item => item.DeletedAtUtc == null && (
                (item.ContextType == DocumentContextType.LegalCase && caseIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.CaseRequirement && requirementIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.Timeline && timelineIds.Contains(item.ContextId)) ||
                (item.ContextType == DocumentContextType.Memorial && memorialIds.Contains(item.ContextId))))
            .GroupBy(item => new { item.ContextType, item.ContextId })
            .Select(group => new RetentionContextCount(group.Key.ContextType, group.Key.ContextId, group.Count()))
            .ToListAsync(cancellationToken);

        var counts = caseIds.ToDictionary(id => id, _ => 0);
        foreach (var group in documentGroups)
        {
            var caseId = group.ContextType switch
            {
                DocumentContextType.LegalCase => group.ContextId,
                DocumentContextType.CaseRequirement => requirementMap.GetValueOrDefault(group.ContextId),
                DocumentContextType.Timeline => timelineMap.GetValueOrDefault(group.ContextId),
                DocumentContextType.Memorial => memorialMap.GetValueOrDefault(group.ContextId),
                _ => Guid.Empty
            };
            if (caseId != Guid.Empty) counts[caseId] += group.Count;
        }

        return counts;
    }

    private static RetentionCandidateDto MapRetentionCandidate(
        LegalCase legalCase,
        int retentionDays,
        int documentCount)
    {
        var starts = legalCase.RetentionStartsAtUtc!.Value;
        return new RetentionCandidateDto(
            legalCase.Id, legalCase.CaseNumber, legalCase.Client.FullName, starts, starts.AddDays(retentionDays),
            documentCount, legalCase.Timeline.Count, $"Expediente cerrado con plazo preliminar de {retentionDays} días cumplido.");
    }

    private static void ValidateRetentionDays(int retentionDays)
    {
        if (retentionDays < 30 || retentionDays > 3650)
            throw new ValidationException("El período de retención debe estar entre 30 y 3650 días.");
    }

    private sealed record SearchCaseSnapshot(
        Guid OwnerId,
        Guid CaseId,
        LegalCaseStatus Status,
        string? LastStep);

    private sealed record RetentionContextOwner(Guid ContextId, Guid CaseId);

    private sealed record RetentionContextCount(
        DocumentContextType ContextType,
        Guid ContextId,
        int Count);
}
