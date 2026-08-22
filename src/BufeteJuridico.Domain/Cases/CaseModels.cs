using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Clients;
using BufeteJuridico.Domain.Common;
using BufeteJuridico.Domain.Students;

namespace BufeteJuridico.Domain.Cases;

public enum LegalCaseStatus
{
    DocumentCollection = 1,
    Active = 2,
    Suspended = 3,
    Closed = 4,
    Archived = 5
}

public enum CaseAssignmentStatus
{
    Active = 1,
    Completed = 2,
    Reassigned = 3,
    Cancelled = 4
}

public enum TimelineEntryType
{
    CaseOpened = 1,
    RequirementUpdated = 2,
    Assignment = 3,
    Memorial = 4,
    MemorialReview = 5,
    Presentation = 6,
    CourtNotification = 7,
    GeneralAction = 8,
    StatusChange = 9,
    Closure = 10,
    Reopening = 11
}

public enum MemorialStatus
{
    Received = 1,
    UnderReview = 2,
    RequiresCorrection = 3,
    Corrected = 4,
    ApprovedForSignature = 5,
    Presented = 6
}

public enum ReviewOutcome
{
    RequiresChanges = 1,
    Approved = 2
}

public sealed class LegalCase : AuditableEntity
{
    public string CaseNumber { get; set; } = string.Empty;

    public Guid ClientId { get; set; }

    public Client Client { get; set; } = null!;

    public Guid ProcessTypeId { get; set; }

    public ProcessType ProcessType { get; set; } = null!;

    public LegalCaseStatus Status { get; set; } = LegalCaseStatus.DocumentCollection;

    public string Stage { get; set; } = "RecoleccionDocumental";

    public DateTimeOffset OpenedAtUtc { get; set; }

    public DateTimeOffset? ClosedAtUtc { get; set; }

    public string? ClosureReason { get; set; }

    public DateTimeOffset? RetentionStartsAtUtc { get; set; }

    public ICollection<CaseRequirement> Requirements { get; set; } = [];

    public ICollection<CaseAssignment> Assignments { get; set; } = [];

    public ICollection<Counterparty> Counterparties { get; set; } = [];

    public ICollection<TimelineEntry> Timeline { get; set; } = [];
}

public sealed class CaseRequirement : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public LegalCase LegalCase { get; set; } = null!;

    public Guid RequirementDefinitionId { get; set; }

    public string RequirementLabel { get; set; } = string.Empty;

    public RequirementKind Kind { get; set; }

    public bool IsRequired { get; set; }

    public bool IsConditional { get; set; }

    public DocumentNature DocumentNature { get; set; }

    public int? MaximumAgeDays { get; set; }

    public RequirementFulfillmentStatus Status { get; set; } = RequirementFulfillmentStatus.Pending;

    public Guid? DocumentId { get; set; }

    public string? DataValue { get; set; }

    public bool? ConditionMet { get; set; }

    public DateOnly? DocumentIssueDate { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset? ReviewedAtUtc { get; set; }

    public Guid? ReviewedByUserId { get; set; }
}

public sealed class CaseAssignment : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public LegalCase LegalCase { get; set; } = null!;

    public Guid StudentId { get; set; }

    public Student Student { get; set; } = null!;

    public bool IsPrimary { get; set; }

    public CaseAssignmentStatus Status { get; set; } = CaseAssignmentStatus.Active;

    public DateTimeOffset AssignedAtUtc { get; set; }

    public DateTimeOffset? EndedAtUtc { get; set; }

    public string? EndReason { get; set; }
}

public sealed class Counterparty : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public LegalCase LegalCase { get; set; } = null!;

    public string FullName { get; set; } = string.Empty;

    public string? Dpi { get; set; }

    public string? ResidenceAddress { get; set; }

    public string? WorkAddress { get; set; }

    public string? Phone { get; set; }

    public string? Notes { get; set; }
}

public sealed class TimelineEntry : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public LegalCase LegalCase { get; set; } = null!;

    public TimelineEntryType Type { get; set; }

    public DateTimeOffset OccurredAtUtc { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid? PerformedByStudentId { get; set; }

    public Guid? DocumentId { get; set; }
}

public sealed class Memorial : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public LegalCase LegalCase { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    public MemorialStatus Status { get; set; } = MemorialStatus.Received;

    public ICollection<MemorialVersion> Versions { get; set; } = [];
}

public sealed class MemorialVersion : AuditableEntity
{
    public Guid MemorialId { get; set; }

    public Memorial Memorial { get; set; } = null!;

    public int VersionNumber { get; set; }

    public Guid DocumentId { get; set; }

    public Guid? SubmittedByStudentId { get; set; }

    public string? Notes { get; set; }

    public ICollection<MemorialReview> Reviews { get; set; } = [];
}

public sealed class MemorialReview : AuditableEntity
{
    public Guid MemorialVersionId { get; set; }

    public MemorialVersion MemorialVersion { get; set; } = null!;

    public ReviewOutcome Outcome { get; set; }

    public string Observations { get; set; } = string.Empty;

    public Guid? ReviewedDocumentId { get; set; }

    public DateTimeOffset ReviewedAtUtc { get; set; }
}

public sealed class CasePresentation : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public Guid? MemorialId { get; set; }

    public DateTimeOffset PresentedAtUtc { get; set; }

    public string Result { get; set; } = string.Empty;

    public Guid? PresentedDocumentId { get; set; }

    public Guid? ReceiptDocumentId { get; set; }
}

public sealed class CourtNotification : AuditableEntity
{
    public Guid LegalCaseId { get; set; }

    public DateTimeOffset NotifiedAtUtc { get; set; }

    public string Description { get; set; } = string.Empty;

    public Guid DocumentId { get; set; }

    public string? NewStage { get; set; }
}
