using BufeteJuridico.Domain.Catalogs;

namespace BufeteJuridico.Domain.Students;

public static class EnrollmentRules
{
    public static bool CanTransition(EnrollmentStatus current, EnrollmentStatus next) =>
        current == next || (current, next) switch
        {
            (EnrollmentStatus.Draft, EnrollmentStatus.Submitted) => true,
            (EnrollmentStatus.Submitted, EnrollmentStatus.Admitted) => true,
            (EnrollmentStatus.Submitted, EnrollmentStatus.UnderReview) => true,
            (EnrollmentStatus.Submitted, EnrollmentStatus.Observed) => true,
            (EnrollmentStatus.Submitted, EnrollmentStatus.Approved) => true,
            (EnrollmentStatus.Submitted, EnrollmentStatus.Rejected) => true,
            (EnrollmentStatus.Admitted, EnrollmentStatus.UnderReview) => true,
            (EnrollmentStatus.Admitted, EnrollmentStatus.Observed) => true,
            (EnrollmentStatus.Admitted, EnrollmentStatus.Approved) => true,
            (EnrollmentStatus.Admitted, EnrollmentStatus.Rejected) => true,
            (EnrollmentStatus.UnderReview, EnrollmentStatus.Observed) => true,
            (EnrollmentStatus.Observed, EnrollmentStatus.UnderReview) => true,
            (EnrollmentStatus.UnderReview, EnrollmentStatus.Approved) => true,
            (EnrollmentStatus.UnderReview, EnrollmentStatus.Rejected) => true,
            (EnrollmentStatus.Approved, EnrollmentStatus.Completed) => true,
            _ => false
        };
}

public static class RequirementRules
{
    public static bool IsSatisfied(
        RequirementFulfillmentStatus status,
        bool isConditional) =>
        status == RequirementFulfillmentStatus.Accepted ||
        (isConditional && status == RequirementFulfillmentStatus.NotApplicable);

    public static bool RequiresEvidence(RequirementFulfillmentStatus status) =>
        status is RequirementFulfillmentStatus.Submitted or
            RequirementFulfillmentStatus.Accepted or
            RequirementFulfillmentStatus.Observed or
            RequirementFulfillmentStatus.Expired;

    public static bool HasEvidence(
        RequirementKind kind,
        Guid? documentId,
        string? dataValue,
        bool? conditionMet = null) =>
        kind switch
        {
            RequirementKind.Document => documentId is not null,
            RequirementKind.Data => !string.IsNullOrWhiteSpace(dataValue),
            RequirementKind.Condition => conditionMet is not null,
            _ => false
        };

    public static RequirementFulfillmentStatus DetermineStatus(
        RequirementFulfillmentStatus requestedStatus,
        DateOnly? documentIssueDate,
        int? maximumAgeDays,
        DateOnly today)
    {
        if (documentIssueDate is not null && maximumAgeDays is not null &&
            documentIssueDate.Value.AddDays(maximumAgeDays.Value) < today)
        {
            return RequirementFulfillmentStatus.Expired;
        }

        return requestedStatus;
    }
}
