using BufeteJuridico.Application.Common;

namespace BufeteJuridico.Application.Queries;

public sealed record SearchResultDto(
    Guid Id,
    string ResultType,
    string DisplayName,
    string? SecondaryText,
    Guid? RelatedCaseId,
    string? CaseStatus,
    string? LastStep);

public sealed record AuditLogDto(
    Guid Id,
    Guid? UserId,
    string? Username,
    DateTimeOffset OccurredAtUtc,
    string Action,
    string EntityType,
    string EntityId,
    string? ChangesJson,
    string? TraceId,
    string? IpAddress);

public sealed record RetentionCandidateDto(
    Guid CaseId,
    string CaseNumber,
    string ClientName,
    DateTimeOffset RetentionStartsAtUtc,
    DateTimeOffset EligibleAtUtc,
    int DocumentCount,
    int TimelineEntryCount,
    string Reason);

public sealed record RetentionPreviewDto(
    RetentionCandidateDto Candidate,
    IReadOnlyList<string> AffectedData,
    bool ExecutionBlocked,
    string BlockReason);

public interface IQueryService
{
    Task<PagedResult<SearchResultDto>> SearchAsync(string term, int page, int pageSize, CancellationToken cancellationToken);

    Task<PagedResult<AuditLogDto>> GetAuditAsync(Guid? userId, string? entityType, Guid? entityId, DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken cancellationToken);

    Task<PagedResult<RetentionCandidateDto>> GetRetentionCandidatesAsync(DateTimeOffset asOfUtc, int retentionDays, int page, int pageSize, CancellationToken cancellationToken);

    Task<RetentionPreviewDto> GetRetentionPreviewAsync(Guid caseId, DateTimeOffset asOfUtc, int retentionDays, CancellationToken cancellationToken);
}
