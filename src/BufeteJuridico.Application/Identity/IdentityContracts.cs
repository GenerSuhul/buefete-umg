using BufeteJuridico.Application.Common;

namespace BufeteJuridico.Application.Identity;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string SigningKey { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 15;

    public int RefreshTokenDays { get; set; } = 7;
}

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record AuthenticatedUserDto(
    Guid Id,
    string Username,
    string Email,
    string FullName,
    Guid? PhotoDocumentId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);

public sealed record TokenResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAtUtc,
    AuthenticatedUserDto User);

public sealed record AccessTokenDescriptor(
    Guid UserId,
    string Username,
    string Email,
    string FullName,
    Guid SecurityStamp,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);

public sealed record IssuedAccessToken(string Value, DateTimeOffset ExpiresAtUtc);

public interface IAccessTokenIssuer
{
    IssuedAccessToken Issue(AccessTokenDescriptor descriptor);
}

public interface IAuthenticationService
{
    Task<TokenResponse> LoginAsync(LoginRequest request, string? ipAddress, CancellationToken cancellationToken);

    Task<TokenResponse> RefreshAsync(RefreshRequest request, string? ipAddress, CancellationToken cancellationToken);

    Task RevokeAsync(RefreshRequest request, string? ipAddress, CancellationToken cancellationToken);
}

public sealed record UserSummaryDto(
    Guid Id,
    string Username,
    string Email,
    string FullName,
    bool IsActive,
    bool IsDeleted,
    DateOnly? ParticipationStartDate,
    DateOnly? ParticipationEndDate,
    Guid? PhotoDocumentId,
    IReadOnlyList<string> Roles,
    string AccessStatus);

public sealed record SetUserPhotoRequest(Guid? DocumentId);

public sealed record CreateUserRequest(
    string Username,
    string Email,
    string FullName,
    string Password,
    DateOnly? ParticipationStartDate,
    DateOnly? ParticipationEndDate,
    IReadOnlyList<Guid> RoleIds,
    Guid? StudentId);

public sealed record UpdateUserRequest(
    string Email,
    string FullName,
    bool IsActive,
    DateOnly? ParticipationStartDate,
    DateOnly? ParticipationEndDate,
    IReadOnlyList<Guid> RoleIds);

public sealed record RoleDto(
    Guid Id,
    string Name,
    string Description,
    bool IsSystem,
    bool IsActive,
    IReadOnlyList<string> Permissions);

public sealed record CreateRoleRequest(
    string Name,
    string Description,
    IReadOnlyList<string> PermissionCodes);

public sealed record UpdateRoleRequest(
    string Description,
    bool IsActive,
    IReadOnlyList<string> PermissionCodes);

public sealed record PermissionDto(string Code, string Module, string Description);

public sealed record UserRoleAssignmentRequest(
    Guid RoleId,
    DateTimeOffset? ValidFromUtc,
    DateTimeOffset? ValidUntilUtc);

public sealed record ChangeOwnPasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UpdateOwnProfileRequest(string FullName, string Email);

public sealed record ResetPasswordRequest(string NewPassword);

public sealed record SetUserAccessRequest(bool IsActive);

public interface IUserManagementService
{
    Task<PagedResult<UserSummaryDto>> GetUsersAsync(string? search, string? lifecycle, string? personType, int page, int pageSize, CancellationToken cancellationToken);

    Task<UserSummaryDto> GetUserAsync(Guid id, CancellationToken cancellationToken);

    Task<UserSummaryDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken);

    Task<UserSummaryDto> UpdateUserAsync(Guid id, UpdateUserRequest request, CancellationToken cancellationToken);

    Task DeactivateUserAsync(Guid id, CancellationToken cancellationToken);

    Task<UserSummaryDto> SetAccessAsync(Guid id, SetUserAccessRequest request, CancellationToken cancellationToken);

    Task<UserSummaryDto> RestoreUserAsync(Guid id, CancellationToken cancellationToken);

    Task PurgeUserAsync(Guid id, CancellationToken cancellationToken);

    Task AssignRoleAsync(Guid userId, UserRoleAssignmentRequest request, CancellationToken cancellationToken);

    Task RemoveRoleAsync(Guid userId, Guid roleId, CancellationToken cancellationToken);

    Task ChangeOwnPasswordAsync(ChangeOwnPasswordRequest request, CancellationToken cancellationToken);

    Task<UserSummaryDto> UpdateOwnProfileAsync(UpdateOwnProfileRequest request, CancellationToken cancellationToken);

    Task ResetPasswordAsync(Guid userId, ResetPasswordRequest request, CancellationToken cancellationToken);

    Task<UserSummaryDto> SetPhotoAsync(Guid userId, SetUserPhotoRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken);

    Task<RoleDto> CreateRoleAsync(CreateRoleRequest request, CancellationToken cancellationToken);

    Task<RoleDto> UpdateRoleAsync(Guid id, UpdateRoleRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken cancellationToken);
}
