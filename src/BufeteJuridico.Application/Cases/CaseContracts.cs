using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Students;

namespace BufeteJuridico.Application.Cases;

public sealed record CaseSummaryDto(
    Guid Id,
    string CaseNumber,
    Guid ClientId,
    string ClientName,
    Guid ProcessTypeId,
    string ProcessTypeName,
    LegalCaseStatus Status,
    string Stage,
    DateTimeOffset OpenedAtUtc,
    DateTimeOffset? ClosedAtUtc,
    TimelineEntryDto? LastStep,
    IReadOnlyList<CaseAssignmentDto> Assignments,
    Guid ConcurrencyToken);

public sealed record CaseDetailDto(
    CaseSummaryDto Summary,
    IReadOnlyList<CaseRequirementDto> Requirements,
    IReadOnlyList<CounterpartyDto> Counterparties,
    IReadOnlyList<TimelineEntryDto> Timeline,
    IReadOnlyList<MemorialDto> Memorials,
    IReadOnlyList<CasePresentationDto> Presentations,
    IReadOnlyList<CourtNotificationDto> CourtNotifications);

public sealed record CaseRequirementDto(
    Guid Id,
    Guid RequirementDefinitionId,
    string Label,
    bool IsRequired,
    bool IsConditional,
    RequirementFulfillmentStatus Status,
    Guid? DocumentId,
    string? DataValue,
    bool? ConditionMet,
    DateOnly? DocumentIssueDate,
    string? Notes,
    bool IsExpired);

public sealed record CaseAssignmentDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    Guid? StudentPhotoDocumentId,
    bool IsPrimary,
    CaseAssignmentStatus Status,
    DateTimeOffset AssignedAtUtc,
    DateTimeOffset? EndedAtUtc,
    string? EndReason);

public sealed record CounterpartyDto(
    Guid Id,
    string FullName,
    string? Dpi,
    string? ResidenceAddress,
    string? WorkAddress,
    string? Phone,
    string? Notes);

public sealed record TimelineEntryDto(
    Guid Id,
    TimelineEntryType Type,
    DateTimeOffset OccurredAtUtc,
    string Title,
    string? Description,
    Guid? PerformedByStudentId,
    Guid? DocumentId,
    Guid? CreatedByUserId);

public sealed record MemorialDto(
    Guid Id,
    string Title,
    MemorialStatus Status,
    IReadOnlyList<MemorialVersionDto> Versions);

public sealed record MemorialVersionDto(
    Guid Id,
    int VersionNumber,
    Guid DocumentId,
    Guid? SubmittedByStudentId,
    string? Notes,
    IReadOnlyList<MemorialReviewDto> Reviews);

public sealed record MemorialReviewDto(
    Guid Id,
    ReviewOutcome Outcome,
    string Observations,
    Guid? ReviewedDocumentId,
    DateTimeOffset ReviewedAtUtc,
    Guid? ReviewedByUserId);

public sealed record CasePresentationDto(
    Guid Id,
    Guid MemorialId,
    string MemorialTitle,
    Guid MemorialVersionId,
    DateTimeOffset PresentedAtUtc,
    string Result,
    Guid? PresentedDocumentId,
    Guid? ReceiptDocumentId,
    Guid? CreatedByUserId);

public sealed record CourtNotificationDto(
    Guid Id,
    DateTimeOffset NotifiedAtUtc,
    string Description,
    Guid DocumentId,
    string? NewStage,
    Guid? CreatedByUserId);

public sealed record OpenCaseRequest(
    Guid ClientId,
    Guid ProcessTypeId,
    string? InitialStage,
    IReadOnlyList<SaveCounterpartyRequest>? Counterparties);

public sealed record UpdateCaseRequest(
    LegalCaseStatus Status,
    string Stage,
    Guid ConcurrencyToken);

public sealed record SaveCounterpartyRequest(
    string FullName,
    string? Dpi,
    string? ResidenceAddress,
    string? WorkAddress,
    string? Phone,
    string? Notes);

public sealed record UpdateCaseRequirementRequest(
    RequirementFulfillmentStatus Status,
    Guid? DocumentId,
    string? DataValue,
    bool? ConditionMet,
    DateOnly? DocumentIssueDate,
    string? Notes);

public sealed record AssignStudentRequest(Guid StudentId, bool IsPrimary);

public sealed record EndAssignmentRequest(CaseAssignmentStatus Status, string Reason);

public sealed record AddTimelineEntryRequest(
    TimelineEntryType Type,
    DateTimeOffset OccurredAtUtc,
    string Title,
    string? Description,
    Guid? PerformedByStudentId,
    Guid? DocumentId,
    string? NewStage,
    LegalCaseStatus? NewStatus);

public sealed record CreateMemorialRequest(
    string Title,
    Guid DocumentId,
    Guid? SubmittedByStudentId,
    string? Notes);

public sealed record AddMemorialVersionRequest(
    Guid DocumentId,
    Guid? SubmittedByStudentId,
    string? Notes);

public sealed record ReviewMemorialRequest(
    Guid VersionId,
    ReviewOutcome Outcome,
    string Observations,
    Guid? ReviewedDocumentId);

public sealed record PresentMemorialRequest(
    DateTimeOffset PresentedAtUtc,
    string Result,
    Guid? PresentedDocumentId,
    Guid? ReceiptDocumentId);

public sealed record AddCourtNotificationRequest(
    DateTimeOffset NotifiedAtUtc,
    string Description,
    Guid DocumentId,
    string? NewStage);

public sealed record CloseCaseRequest(DateTimeOffset ClosedAtUtc, string Reason);

public interface ICaseService
{
    Task<PagedResult<CaseSummaryDto>> GetCasesAsync(string? search, LegalCaseStatus? status, int page, int pageSize, CancellationToken cancellationToken);

    Task<CaseDetailDto> GetCaseAsync(Guid id, CancellationToken cancellationToken);

    Task<CaseDetailDto> OpenCaseAsync(OpenCaseRequest request, CancellationToken cancellationToken);

    Task<CaseDetailDto> UpdateCaseAsync(Guid id, UpdateCaseRequest request, CancellationToken cancellationToken);

    Task<CaseRequirementDto> UpdateRequirementAsync(Guid caseId, Guid requirementId, UpdateCaseRequirementRequest request, CancellationToken cancellationToken);

    Task<CaseAssignmentDto> AssignStudentAsync(Guid caseId, AssignStudentRequest request, CancellationToken cancellationToken);

    Task<CounterpartyDto> SaveCounterpartyAsync(Guid caseId, Guid? counterpartyId, SaveCounterpartyRequest request, CancellationToken cancellationToken);

    Task EndAssignmentAsync(Guid caseId, Guid assignmentId, EndAssignmentRequest request, CancellationToken cancellationToken);

    Task<TimelineEntryDto> AddTimelineEntryAsync(Guid caseId, AddTimelineEntryRequest request, CancellationToken cancellationToken);

    Task<MemorialDto> CreateMemorialAsync(Guid caseId, CreateMemorialRequest request, CancellationToken cancellationToken);

    Task<MemorialDto> AddMemorialVersionAsync(Guid caseId, Guid memorialId, AddMemorialVersionRequest request, CancellationToken cancellationToken);

    Task<MemorialDto> ReviewMemorialAsync(Guid caseId, Guid memorialId, ReviewMemorialRequest request, CancellationToken cancellationToken);

    Task PresentMemorialAsync(Guid caseId, Guid memorialId, PresentMemorialRequest request, CancellationToken cancellationToken);

    Task AddCourtNotificationAsync(Guid caseId, AddCourtNotificationRequest request, CancellationToken cancellationToken);

    Task CloseCaseAsync(Guid caseId, CloseCaseRequest request, CancellationToken cancellationToken);

    Task ReopenCaseAsync(Guid caseId, string reason, CancellationToken cancellationToken);
}
