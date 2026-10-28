using BufeteJuridico.Domain.Students;

namespace BufeteJuridico.Application.Students;

using BufeteJuridico.Application.Documents;

public sealed record StudentDisciplineDto(Guid Id, string Dpi, string StudentName,
    StudentDisciplineKind Kind, string Reason, DateOnly? StartsOn, DateOnly? EndsOn,
    Guid? DocumentId, string SourceTenantCode, string IssuedByName,
    DateTimeOffset CreatedAtUtc, DateTimeOffset? RevokedAtUtc, string? RevocationReason,
    bool IsBlocking);

public sealed record CreateStudentDisciplineRequest(StudentDisciplineKind Kind,
    string Reason, DateOnly? StartsOn, DateOnly? EndsOn, Guid? DocumentId);

public sealed record RevokeStudentDisciplineRequest(string Reason);

public interface IStudentDisciplineService
{
    Task<IReadOnlyList<StudentDisciplineDto>> ListAsync(Guid studentId, CancellationToken ct);
    Task<StudentDisciplineDto> CreateAsync(Guid studentId, CreateStudentDisciplineRequest request, CancellationToken ct);
    Task<StudentDisciplineDto> RevokeAsync(Guid studentId, Guid id, RevokeStudentDisciplineRequest request, CancellationToken ct);
    Task EnsureNotBlockedAsync(string dpi, CancellationToken ct);
    Task<bool> IsBlockedAsync(string dpi, CancellationToken ct);
    Task<DocumentDownloadAccess> GetDocumentAsync(Guid studentId, Guid id, CancellationToken ct);
}
