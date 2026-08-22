using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Auditing;

public sealed class AuditLog : Entity
{
    public Guid? UserId { get; set; }

    public string? Username { get; set; }

    public DateTimeOffset OccurredAtUtc { get; set; }

    public string Action { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty;

    public string EntityId { get; set; } = string.Empty;

    public string? ChangesJson { get; set; }

    public string? TraceId { get; set; }

    public string? IpAddress { get; set; }
}
