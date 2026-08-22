using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Reports;

public enum WeeklyReportStatus
{
    Draft = 1,
    Reviewed = 2,
    Sent = 3,
    SendFailed = 4
}

public enum EmailDeliveryStatus
{
    Pending = 1,
    Sent = 2,
    Failed = 3
}

public sealed class WeeklyReport : AuditableEntity
{
    public DateOnly PeriodStart { get; set; }

    public DateOnly PeriodEnd { get; set; }

    public WeeklyReportStatus Status { get; set; } = WeeklyReportStatus.Draft;

    public string PrintableHtml { get; set; } = string.Empty;

    public DateTimeOffset? ReviewedAtUtc { get; set; }

    public Guid? ReviewedByUserId { get; set; }

    public DateTimeOffset? SentAtUtc { get; set; }

    public Guid? SentByUserId { get; set; }

    public ICollection<ReportActivity> Activities { get; set; } = [];

    public ICollection<EmailDelivery> Deliveries { get; set; } = [];
}

public sealed class ReportActivity : Entity
{
    public Guid WeeklyReportId { get; set; }

    public WeeklyReport WeeklyReport { get; set; } = null!;

    public Guid SecretariatActivityId { get; set; }
}

public sealed class EmailDelivery : Entity
{
    public Guid WeeklyReportId { get; set; }

    public WeeklyReport WeeklyReport { get; set; } = null!;

    public string Recipients { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public EmailDeliveryStatus Status { get; set; }

    public DateTimeOffset AttemptedAtUtc { get; set; }

    public string? ErrorMessage { get; set; }
}
