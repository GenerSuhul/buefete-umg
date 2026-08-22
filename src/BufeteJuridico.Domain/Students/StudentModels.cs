using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Students;

public enum EnrollmentStatus
{
    Draft = 1,
    Submitted = 2,
    Admitted = 3,
    UnderReview = 4,
    Observed = 5,
    Approved = 6,
    Rejected = 7,
    Completed = 8
}

public enum PracticeModality
{
    CivilFamilyCases = 1,
    ExternalInternship = 2,
    AdHonoremSecretariat = 3
}

public enum RequirementFulfillmentStatus
{
    Pending = 1,
    Submitted = 2,
    Accepted = 3,
    Observed = 4,
    Expired = 5,
    NotApplicable = 6
}

public sealed class Student : AuditableEntity
{
    public Guid? UserAccountId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string NormalizedFullName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public int? AgeAtRegistration { get; set; }

    public string StudentCardNumber { get; set; } = string.Empty;

    public string Dpi { get; set; } = string.Empty;

    public int? Semester { get; set; }

    public string? StudyShift { get; set; }

    public string? Workplace { get; set; }

    public string? WorkPhone { get; set; }

    public string? ImmediateSupervisor { get; set; }

    public string? JobTitle { get; set; }

    public string ResidenceAddress { get; set; } = string.Empty;

    public string? MobilePhone { get; set; }

    public string? HomePhone { get; set; }

    public string Email { get; set; } = string.Empty;

    public DateOnly RegistrationDate { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<EnrollmentApplication> EnrollmentApplications { get; set; } = [];
}

public sealed class EnrollmentApplication : AuditableEntity
{
    public Guid StudentId { get; set; }

    public Student Student { get; set; } = null!;

    public PracticeModality Modality { get; set; }

    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Draft;

    public string? SiteName { get; set; }

    public string? SiteAddress { get; set; }

    public string? Shift { get; set; }

    public string? PracticeDays { get; set; }

    public TimeOnly? StartTime { get; set; }

    public TimeOnly? EndTime { get; set; }

    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public DateTimeOffset? SubmittedAtUtc { get; set; }

    public DateTimeOffset? AdmittedAtUtc { get; set; }

    public DateTimeOffset? ResolvedAtUtc { get; set; }

    public Guid? ResolvedByUserId { get; set; }

    public string? ResolutionNotes { get; set; }

    public Guid? ResolutionDocumentId { get; set; }

    public string? ClinicCardNumber { get; set; }

    public DateOnly? ClinicCardIssuedDate { get; set; }

    public DateOnly? ClinicCardExpirationDate { get; set; }

    public DateTimeOffset? ClinicCardDeliveredAtUtc { get; set; }

    public ICollection<StudentRequirement> Requirements { get; set; } = [];
}

public sealed class StudentRequirement : AuditableEntity
{
    public Guid EnrollmentApplicationId { get; set; }

    public EnrollmentApplication EnrollmentApplication { get; set; } = null!;

    public Guid RequirementDefinitionId { get; set; }

    public string RequirementLabel { get; set; } = string.Empty;

    public RequirementFulfillmentStatus Status { get; set; } = RequirementFulfillmentStatus.Pending;

    public Guid? DocumentId { get; set; }

    public string? DataValue { get; set; }

    public DateOnly? DocumentIssueDate { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset? ReviewedAtUtc { get; set; }

    public Guid? ReviewedByUserId { get; set; }
}
