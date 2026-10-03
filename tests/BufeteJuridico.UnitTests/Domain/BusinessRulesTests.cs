using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Domain.Students;

namespace BufeteJuridico.UnitTests.Domain;

public sealed class BusinessRulesTests
{
    [Theory]
    [InlineData("abcdefgh", true)]
    [InlineData("12345678", true)]
    [InlineData("a b c d e", true)]
    [InlineData("abcdefg", false)]
    [InlineData("        ", false)]
    public void Password_accepts_eight_characters_without_composition_rules(string password, bool expected)
    {
        Assert.Equal(expected, PasswordRules.IsValid(password));
    }

    [Theory]
    [InlineData(EnrollmentStatus.Draft, EnrollmentStatus.Submitted)]
    [InlineData(EnrollmentStatus.Submitted, EnrollmentStatus.Admitted)]
    [InlineData(EnrollmentStatus.Submitted, EnrollmentStatus.Approved)]
    [InlineData(EnrollmentStatus.Admitted, EnrollmentStatus.Approved)]
    [InlineData(EnrollmentStatus.UnderReview, EnrollmentStatus.Approved)]
    [InlineData(EnrollmentStatus.Approved, EnrollmentStatus.Completed)]
    public void Enrollment_allows_expected_transitions(EnrollmentStatus current, EnrollmentStatus next)
    {
        Assert.True(EnrollmentRules.CanTransition(current, next));
    }

    [Theory]
    [InlineData(EnrollmentStatus.Draft, EnrollmentStatus.Approved)]
    [InlineData(EnrollmentStatus.Rejected, EnrollmentStatus.Approved)]
    [InlineData(EnrollmentStatus.Completed, EnrollmentStatus.Submitted)]
    public void Enrollment_rejects_invalid_transitions(EnrollmentStatus current, EnrollmentStatus next)
    {
        Assert.False(EnrollmentRules.CanTransition(current, next));
    }

    [Fact]
    public void Requirement_marks_document_expired_after_maximum_age()
    {
        var status = RequirementRules.DetermineStatus(
            RequirementFulfillmentStatus.Accepted,
            new DateOnly(2026, 1, 1),
            183,
            new DateOnly(2026, 8, 14));

        Assert.Equal(RequirementFulfillmentStatus.Expired, status);
    }

    [Fact]
    public void Requirement_keeps_status_during_validity_window()
    {
        var status = RequirementRules.DetermineStatus(
            RequirementFulfillmentStatus.Accepted,
            new DateOnly(2026, 7, 1),
            183,
            new DateOnly(2026, 8, 14));

        Assert.Equal(RequirementFulfillmentStatus.Accepted, status);
    }

    [Theory]
    [InlineData(RequirementKind.Document, true, false, false, true)]
    [InlineData(RequirementKind.Document, false, false, false, false)]
    [InlineData(RequirementKind.Data, false, true, false, true)]
    [InlineData(RequirementKind.Data, false, false, false, false)]
    [InlineData(RequirementKind.Condition, false, false, true, true)]
    [InlineData(RequirementKind.Condition, false, false, false, false)]
    public void Requirement_requires_its_matching_evidence(
        RequirementKind kind,
        bool hasDocument,
        bool hasData,
        bool hasCondition,
        bool expected)
    {
        var actual = RequirementRules.HasEvidence(
            kind,
            hasDocument ? Guid.NewGuid() : null,
            hasData ? "Dato registrado" : null,
            hasCondition ? true : null);

        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(RequirementFulfillmentStatus.Accepted, false, true)]
    [InlineData(RequirementFulfillmentStatus.NotApplicable, true, true)]
    [InlineData(RequirementFulfillmentStatus.NotApplicable, false, false)]
    [InlineData(RequirementFulfillmentStatus.Pending, true, false)]
    public void Requirement_counts_only_valid_fulfillment(
        RequirementFulfillmentStatus status,
        bool isConditional,
        bool expected)
    {
        Assert.Equal(expected, RequirementRules.IsSatisfied(status, isConditional));
    }

    [Fact]
    public void Active_user_with_current_period_can_sign_in()
    {
        var user = new UserAccount
        {
            IsActive = true,
            ParticipationStartDate = new DateOnly(2026, 1, 1),
            ParticipationEndDate = new DateOnly(2026, 12, 31)
        };

        Assert.True(UserAccessRules.CanSignIn(user, new DateOnly(2026, 8, 14)));
    }

    [Fact]
    public void Logically_deleted_user_cannot_sign_in()
    {
        var user = new UserAccount { IsActive = true, IsDeleted = true };

        Assert.False(UserAccessRules.CanSignIn(user, new DateOnly(2026, 8, 14)));
    }
}
