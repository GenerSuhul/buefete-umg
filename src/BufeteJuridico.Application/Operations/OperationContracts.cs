using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Activities;
using BufeteJuridico.Domain.Reports;

namespace BufeteJuridico.Application.Operations;

public sealed record ActivityDto(
    Guid Id,
    DateTimeOffset OccurredAtUtc,
    string ActivityType,
    string Description,
    Guid? ClientId,
    Guid? StudentId,
    Guid? LegalCaseId,
    bool IsCorrected,
    string? CorrectionReason,
    Guid? CreatedByUserId);

public sealed record SaveActivityRequest(
    DateTimeOffset OccurredAtUtc,
    string ActivityType,
    string Description,
    Guid? ClientId,
    Guid? StudentId,
    Guid? LegalCaseId,
    string? CorrectionReason);

public sealed record WeeklyReportDto(
    Guid Id,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    WeeklyReportStatus Status,
    string PrintableHtml,
    DateTimeOffset? ReviewedAtUtc,
    Guid? ReviewedByUserId,
    DateTimeOffset? SentAtUtc,
    Guid? SentByUserId,
    int ActivityCount,
    IReadOnlyList<EmailDeliveryDto> Deliveries);

public sealed record EmailDeliveryDto(
    Guid Id,
    string Recipients,
    string Subject,
    EmailDeliveryStatus Status,
    DateTimeOffset AttemptedAtUtc,
    string? ErrorMessage);

public sealed record SendReportRequest(
    IReadOnlyList<string> Recipients,
    string Subject,
    string? Message);

public interface IActivityReportService
{
    Task<PagedResult<ActivityDto>> GetActivitiesAsync(DateTimeOffset? from, DateTimeOffset? to, Guid? userId, int page, int pageSize, CancellationToken cancellationToken);

    Task<ActivityDto> CreateActivityAsync(SaveActivityRequest request, CancellationToken cancellationToken);

    Task<ActivityDto> CorrectActivityAsync(Guid id, SaveActivityRequest request, CancellationToken cancellationToken);

    Task<WeeklyReportDto> GenerateWeeklyReportAsync(DateOnly start, DateOnly end, CancellationToken cancellationToken);

    Task<IReadOnlyList<WeeklyReportDto>> GetReportsAsync(CancellationToken cancellationToken);

    Task<WeeklyReportDto> GetReportAsync(Guid id, CancellationToken cancellationToken);

    Task<WeeklyReportDto> ReviewReportAsync(Guid id, CancellationToken cancellationToken);

    Task<WeeklyReportDto> SendReportAsync(Guid id, SendReportRequest request, CancellationToken cancellationToken);
}

public interface IEmailSender
{
    Task SendAsync(IReadOnlyList<string> recipients, string subject, string htmlBody, CancellationToken cancellationToken);
}
