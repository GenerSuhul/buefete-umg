using BufeteJuridico.Application.Cases;

namespace BufeteJuridico.Application.Dashboard;

public sealed record DashboardSeriesPointDto(string Label, int Value);

public sealed record DashboardDistributionDto(string Label, int Value, int Count);

public sealed record DashboardStudentDto(
    Guid StudentId,
    string FullName,
    Guid? PhotoDocumentId,
    int ActiveCaseCount);

public sealed record DashboardDto(
    int ActiveCases,
    int DocumentCollectionCases,
    int ActiveStudents,
    int CompletedRequirements,
    int PendingRequirements,
    int TotalRequirements,
    int WeeklyActivities,
    int CompletionRate,
    decimal? CaseMovementChangePercentage,
    decimal? WeeklyActivityChangePercentage,
    IReadOnlyList<DashboardSeriesPointDto> CaseSeries,
    IReadOnlyList<DashboardDistributionDto> ProcessDistribution,
    IReadOnlyList<DashboardStudentDto> PracticeTeam,
    IReadOnlyList<CaseSummaryDto> RecentCases);

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(CancellationToken cancellationToken);
}
