using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Students;

public enum LegalStudyReviewType
{
    FirstReview = 1,
    SecondReview = 2,
    WrittenSubmission = 3
}

public sealed class StudentLegalReview : AuditableEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public LegalStudyReviewType ReviewType { get; set; }
    public DateOnly ReviewDate { get; set; }
    public string Observations { get; set; } = string.Empty;
    public Guid SignedDocumentId { get; set; }
}

public sealed class StudentPracticeClosure : AuditableEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public DateOnly DeliveryDate { get; set; }
    public Guid FinalDocumentId { get; set; }
    public string Notes { get; set; } = string.Empty;
}
