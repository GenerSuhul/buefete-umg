using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Students;

public enum StudentDisciplineKind
{
    WrittenWarning = 1,
    SixMonthSuspension = 2,
    PermanentSuspension = 3
}

public static class StudentDisciplineCalendar
{
    // Guatemala uses UTC-06:00 year-round.
    public static DateOnly Today(DateTimeOffset now) =>
        DateOnly.FromDateTime(now.ToOffset(TimeSpan.FromHours(-6)).DateTime);
}

public sealed class StudentDiscipline : AuditableEntity
{
    public string Dpi { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public StudentDisciplineKind Kind { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateOnly? StartsOn { get; set; }
    public DateOnly? EndsOn { get; set; }
    public Guid? DocumentId { get; set; }
    public string SourceTenantCode { get; set; } = string.Empty;
    public string IssuedByName { get; set; } = string.Empty;
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public Guid? RevokedByUserId { get; set; }
    public string? RevocationReason { get; set; }
}
