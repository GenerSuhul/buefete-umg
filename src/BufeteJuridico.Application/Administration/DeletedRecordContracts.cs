using BufeteJuridico.Application.Common;

namespace BufeteJuridico.Application.Administration;

public enum DeletedRecordType
{
    Client = 1,
    Student = 2,
    LegalCase = 3
}

public sealed record DeleteRecordRequest(string? Reason);

public sealed record DeletedRecordDto(
    Guid Id,
    DeletedRecordType Type,
    string Name,
    string Reference,
    DateTimeOffset DeletedAtUtc,
    Guid? DeletedByUserId,
    string? DeletedByName,
    string? Reason);

public interface IDeletedRecordService
{
    Task DeleteAsync(DeletedRecordType type, Guid id, string? reason, CancellationToken cancellationToken);

    Task<PagedResult<DeletedRecordDto>> GetAsync(
        DeletedRecordType? type,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task RestoreAsync(DeletedRecordType type, Guid id, CancellationToken cancellationToken);
}
