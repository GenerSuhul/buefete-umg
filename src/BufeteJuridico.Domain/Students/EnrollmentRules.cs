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
