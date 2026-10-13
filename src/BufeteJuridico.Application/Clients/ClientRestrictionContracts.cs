using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Documents;

namespace BufeteJuridico.Application.Clients;

public sealed record ClientRestrictionStatus(bool IsRestricted, Guid? Reference, bool HasValidIdentity = true);
public sealed record CreateClientRestrictionRequest(string Dpi, string ConfirmDpi, string Reason);
public sealed record CheckClientRestrictionRequest(string Dpi);
public sealed record ClientRestrictionDto(Guid Id, string Dpi, string Reason, string SourceTenantCode, string IssuedByName, DateTimeOffset CreatedAtUtc);

public interface IClientRestrictionService
{
    Task<PagedResult<ClientRestrictionDto>> ListAsync(string? dpi, int page, int pageSize, CancellationToken ct);
    Task<ClientRestrictionDto> CreateAsync(CreateClientRestrictionRequest request, CancellationToken ct);
    Task<ClientRestrictionStatus> GetStatusAsync(string? dpi, CancellationToken ct);
    Task EnsureAllowedAsync(string? dpi, CancellationToken ct, bool required = true);
    Task EnsureCaseAllowedAsync(Guid caseId, CancellationToken ct);
    Task EnsureDocumentAllowedAsync(DocumentContextType type, Guid id, CancellationToken ct);
}
