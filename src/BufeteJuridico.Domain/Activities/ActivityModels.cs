using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Activities;

public sealed class SecretariatActivity : AuditableEntity
{
    public DateTimeOffset OccurredAtUtc { get; set; }

    public string ActivityType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public Guid? ClientId { get; set; }

    public Guid? StudentId { get; set; }

    public Guid? LegalCaseId { get; set; }

    public bool IsCorrected { get; set; }

    public string? CorrectionReason { get; set; }
}
