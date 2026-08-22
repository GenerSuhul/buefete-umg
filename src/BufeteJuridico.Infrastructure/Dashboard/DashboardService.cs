using System.Globalization;
using BufeteJuridico.Application.Cases;
using BufeteJuridico.Application.Dashboard;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Dashboard;

internal sealed class DashboardService(
    BufeteDbContext dbContext,
    ICaseService caseService,
    TimeProvider timeProvider) : IDashboardService
{
    private static readonly LegalCaseStatus[] OpenStatuses =
        [LegalCaseStatus.DocumentCollection, LegalCaseStatus.Active, LegalCaseStatus.Suspended];

    public async Task<DashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var currentMonthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var seriesStart = currentMonthStart.AddMonths(-5);
        var seriesEnd = currentMonthStart.AddMonths(1);

        var activeCasesQuery = dbContext.LegalCases.AsNoTracking()
            .Where(item => OpenStatuses.Contains(item.Status));

        var activeCases = await activeCasesQuery.CountAsync(cancellationToken);
        var documentCollectionCases = await activeCasesQuery
            .CountAsync(item => item.Status == LegalCaseStatus.DocumentCollection, cancellationToken);

        var requirementCounts = await dbContext.CaseRequirements.AsNoTracking()
            .Where(item => OpenStatuses.Contains(item.LegalCase.Status) && item.ConditionMet != false)
            .GroupBy(item => 1)
            .Select(group => new
            {
                Total = group.Count(),
                Completed = group.Count(item => item.Status == RequirementFulfillmentStatus.Accepted ||
                                                item.Status == RequirementFulfillmentStatus.NotApplicable)
            })
            .SingleOrDefaultAsync(cancellationToken);
        var totalRequirements = requirementCounts?.Total ?? 0;
        var completedRequirements = requirementCounts?.Completed ?? 0;
        var pendingRequirements = totalRequirements - completedRequirements;
        var completionRate = totalRequirements == 0
            ? 0
            : (int)Math.Round(completedRequirements * 100m / totalRequirements, MidpointRounding.AwayFromZero);

        var movements = await dbContext.TimelineEntries.AsNoTracking()
            .Where(item => item.OccurredAtUtc >= seriesStart && item.OccurredAtUtc < seriesEnd)
            .Select(item => new { item.LegalCaseId, item.OccurredAtUtc })
            .ToListAsync(cancellationToken);
        var monthStarts = Enumerable.Range(0, 6).Select(index => seriesStart.AddMonths(index)).ToList();
        var caseSeries = monthStarts.Select(month => new DashboardSeriesPointDto(
            MonthLabel(month),
            movements.Where(item => item.OccurredAtUtc >= month && item.OccurredAtUtc < month.AddMonths(1))
                .Select(item => item.LegalCaseId)
                .Distinct()
                .Count())).ToList();

        var processCounts = await activeCasesQuery
            .GroupBy(item => item.ProcessType.Name)
            .Select(group => new { Label = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Label)
            .ToListAsync(cancellationToken);
        var processDistribution = BuildDistribution(processCounts.Select(item => (item.Label, item.Count)).ToList(), activeCases);

        var teamRows = await dbContext.CaseAssignments.AsNoTracking()
            .Where(item => item.Status == CaseAssignmentStatus.Active &&
                           item.Student.IsActive &&
                           OpenStatuses.Contains(item.LegalCase.Status))
            .GroupBy(item => new { item.StudentId, item.Student.FullName, item.Student.UserAccountId })
            .Select(group => new
            {
                group.Key.StudentId,
                group.Key.FullName,
                group.Key.UserAccountId,
                ActiveCaseCount = group.Select(item => item.LegalCaseId).Distinct().Count()
            })
            .OrderByDescending(item => item.ActiveCaseCount)
            .ThenBy(item => item.FullName)
            .ToListAsync(cancellationToken);
        var userIds = teamRows.Where(item => item.UserAccountId.HasValue)
            .Select(item => item.UserAccountId!.Value)
            .Distinct()
            .ToList();
        var photoMap = await dbContext.Users.AsNoTracking()
            .Where(item => userIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.PhotoDocumentId, cancellationToken);
        var practiceTeam = teamRows.Select(item => new DashboardStudentDto(
            item.StudentId,
            item.FullName,
            item.UserAccountId is Guid userId && photoMap.TryGetValue(userId, out var photo) ? photo : null,
            item.ActiveCaseCount)).ToList();

        var currentWeekStart = now.AddDays(-7);
        var previousWeekStart = now.AddDays(-14);
        var activityDates = await dbContext.SecretariatActivities.AsNoTracking()
            .Where(item => item.OccurredAtUtc >= previousWeekStart && item.OccurredAtUtc < now)
            .Select(item => item.OccurredAtUtc)
            .ToListAsync(cancellationToken);
        var weeklyActivities = activityDates.Count(item => item >= currentWeekStart);
        var previousWeekActivities = activityDates.Count(item => item < currentWeekStart);

        var recentCases = await caseService.GetCasesAsync(null, null, 1, 3, cancellationToken);

        return new DashboardDto(
            activeCases,
            documentCollectionCases,
            practiceTeam.Count,
            completedRequirements,
            pendingRequirements,
            totalRequirements,
            weeklyActivities,
            completionRate,
            PercentageChange(caseSeries[^2].Value, caseSeries[^1].Value),
            PercentageChange(previousWeekActivities, weeklyActivities),
            caseSeries,
            processDistribution,
            practiceTeam,
            recentCases.Items);
    }

    private static IReadOnlyList<DashboardDistributionDto> BuildDistribution(
        IReadOnlyList<(string Label, int Count)> counts,
        int total)
    {
        if (counts.Count == 0 || total == 0) return [];

        var visible = counts.Take(3).ToList();
        var otherCount = counts.Skip(3).Sum(item => item.Count);
        if (otherCount > 0) visible.Add(("Otros procesos", otherCount));

        var result = visible.Select(item => new DashboardDistributionDto(
            item.Label,
            (int)Math.Round(item.Count * 100m / total, MidpointRounding.AwayFromZero),
            item.Count)).ToList();
        var difference = 100 - result.Sum(item => item.Value);
        if (difference != 0)
        {
            var last = result[^1];
            result[^1] = last with { Value = last.Value + difference };
        }

        return result;
    }

    private static decimal? PercentageChange(int previous, int current) => previous == 0
        ? null
        : Math.Round((current - previous) * 100m / previous, 1, MidpointRounding.AwayFromZero);

    private static string MonthLabel(DateTimeOffset month)
    {
        var label = CultureInfo.GetCultureInfo("es-GT").DateTimeFormat
            .GetAbbreviatedMonthName(month.Month)
            .TrimEnd('.');
        return char.ToUpper(label[0], CultureInfo.GetCultureInfo("es-GT")) + label[1..];
    }
}
