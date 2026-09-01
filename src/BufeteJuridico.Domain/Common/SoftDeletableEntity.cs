namespace BufeteJuridico.Domain.Common;

public abstract class SoftDeletableEntity : AuditableEntity
{
    public DateTimeOffset? DeletedAtUtc { get; set; }

    public Guid? DeletedByUserId { get; set; }

    public string? DeletionReason { get; set; }

    public Guid? DeletionBatchId { get; set; }
}
