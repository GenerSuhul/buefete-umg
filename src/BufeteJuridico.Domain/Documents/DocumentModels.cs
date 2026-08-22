using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Documents;

public enum DocumentSource
{
    Upload = 1,
    Scanner = 2,
    Generated = 3
}

public enum DocumentContextType
{
    Client = 1,
    IncomeDeclaration = 2,
    Student = 3,
    Enrollment = 4,
    LegalCase = 5,
    CaseRequirement = 6,
    Timeline = 7,
    Memorial = 8,
    Report = 9,
    UserPhoto = 10
}

public sealed class DocumentRecord : AuditableEntity
{
    public string StorageKey { get; set; } = string.Empty;

    public string OriginalFileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public DocumentSource Source { get; set; }

    public DocumentContextType ContextType { get; set; }

    public Guid ContextId { get; set; }

    public string Label { get; set; } = string.Empty;

    public int VersionNumber { get; set; } = 1;

    public Guid? PreviousVersionId { get; set; }

    public bool IsCurrent { get; set; } = true;

    public int? PageCount { get; set; }

    public DateTimeOffset? DeletedAtUtc { get; set; }

    public Guid? DeletedByUserId { get; set; }
}
