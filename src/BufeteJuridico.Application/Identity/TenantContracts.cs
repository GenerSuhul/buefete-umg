namespace BufeteJuridico.Application.Identity;

public sealed record TenantDto(string Code, string Name, string Status, bool IsActive);
public sealed record CreateTenantRequest(string Code, string Name, string AdministratorName, string AdministratorEmail, string AdministratorPassword);
public sealed record UpdateTenantRequest(string Name, bool IsActive);

public interface ITenantManagementService
{
    Task<IReadOnlyList<TenantDto>> ListAsync(CancellationToken cancellationToken);
    Task<TenantDto> CreateAsync(CreateTenantRequest request, CancellationToken cancellationToken);
    Task<TenantDto> UpdateAsync(string code, UpdateTenantRequest request, CancellationToken cancellationToken);
    Task<TokenResponse> SwitchAsync(string code, CancellationToken cancellationToken);
}
