using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Students;

namespace BufeteJuridico.Application.Students;

public sealed record StudentLegalReviewDto(Guid Id, LegalStudyReviewType ReviewType, DateOnly ReviewDate,
    string Observations, Guid SignedDocumentId, DateTimeOffset CreatedAtUtc);
public sealed record StudentPracticeClosureDto(Guid StudentId, string StudentName, string StudentCardNumber,
    DateOnly DeliveryDate, Guid FinalDocumentId, string Notes, DateTimeOffset CreatedAtUtc);
public sealed record StudentLegalStudyDto(IReadOnlyList<StudentLegalReviewDto> Reviews, StudentPracticeClosureDto? Closure);
public sealed record AddLegalStudyReviewRequest(LegalStudyReviewType ReviewType, DateOnly ReviewDate,
    string Observations, Guid SignedDocumentId);
public sealed record DeliverLegalStudyRequest(DateOnly DeliveryDate, Guid FinalDocumentId, string Notes);

public interface IStudentLegalStudyService
{
    Task<StudentLegalStudyDto> GetAsync(Guid studentId, CancellationToken cancellationToken);
    Task<StudentLegalStudyDto> AddReviewAsync(Guid studentId, AddLegalStudyReviewRequest request, CancellationToken cancellationToken);
    Task<StudentLegalStudyDto> DeliverAsync(Guid studentId, DeliverLegalStudyRequest request, CancellationToken cancellationToken);
    Task<PagedResult<StudentPracticeClosureDto>> GetClosuresAsync(string? search, int page, int pageSize, CancellationToken cancellationToken);
}
