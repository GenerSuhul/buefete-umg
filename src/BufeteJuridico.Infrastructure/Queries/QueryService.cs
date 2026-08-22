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
            .Select(item => new { item.Id, item.FullName, Secondary = item.Dpi ?? item.ReceptionNumber })
            .Take(250)
            .ToListAsync(cancellationToken);
        var students = await dbContext.Students.AsNoTracking()
            .Where(item => item.IsActive && item.NormalizedFullName.Contains(normalized))
            .Select(item => new { item.Id, item.FullName, Secondary = item.StudentCardNumber })
            .Take(250)
            .ToListAsync(cancellationToken);

        var results = new List<SearchResultDto>();
        foreach (var client in clients)
        {
            var latestCase = await dbContext.LegalCases.AsNoTracking().Include(item => item.Timeline)
                .Where(item => item.ClientId == client.Id)
                .OrderByDescending(item => item.OpenedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
            results.Add(new SearchResultDto(
                client.Id, "Cliente", client.FullName, client.Secondary, latestCase?.Id,
                latestCase?.Status.ToString(), latestCase?.Timeline.OrderByDescending(item => item.OccurredAtUtc).FirstOrDefault()?.Title));
        }

        foreach (var student in students)
        {
            var latestAssignment = await dbContext.CaseAssignments.AsNoTracking().Include(item => item.LegalCase).ThenInclude(item => item.Timeline)
                .Where(item => item.StudentId == student.Id)
                .OrderByDescending(item => item.AssignedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
            results.Add(new SearchResultDto(
                student.Id, "Alumno", student.FullName, student.Secondary, latestAssignment?.LegalCaseId,
                latestAssignment?.LegalCase.Status.ToString(), latestAssignment?.LegalCase.Timeline.OrderByDescending(item => item.OccurredAtUtc).FirstOrDefault()?.Title));
        }

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
        var results = new List<RetentionCandidateDto>();
        foreach (var legalCase in cases)
            results.Add(await MapRetentionCandidateAsync(legalCase, retentionDays, cancellationToken));
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
        var candidate = await MapRetentionCandidateAsync(legalCase, retentionDays, cancellationToken);
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

    private async Task<RetentionCandidateDto> MapRetentionCandidateAsync(
        LegalCase legalCase,
        int retentionDays,
        CancellationToken cancellationToken)
    {
        var requirementIds = await dbContext.CaseRequirements.Where(item => item.LegalCaseId == legalCase.Id).Select(item => item.Id).ToListAsync(cancellationToken);
        var timelineIds = legalCase.Timeline.Select(item => item.Id).ToList();
        var memorialIds = await dbContext.Memorials.Where(item => item.LegalCaseId == legalCase.Id).Select(item => item.Id).ToListAsync(cancellationToken);
        var documentCount = await dbContext.Documents.CountAsync(item => item.DeletedAtUtc == null && (
            (item.ContextType == DocumentContextType.LegalCase && item.ContextId == legalCase.Id) ||
            (item.ContextType == DocumentContextType.CaseRequirement && requirementIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.Timeline && timelineIds.Contains(item.ContextId)) ||
            (item.ContextType == DocumentContextType.Memorial && memorialIds.Contains(item.ContextId))), cancellationToken);
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
}
