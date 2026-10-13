using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Identity;

public sealed class UserAccount : AuditableEntity
{
    public string Username { get; set; } = string.Empty;

    public string NormalizedUsername { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string NormalizedEmail { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public bool IsPlatformAccount { get; set; }

    public DateOnly? ParticipationStartDate { get; set; }

    public DateOnly? ParticipationEndDate { get; set; }

    public Guid? PhotoDocumentId { get; set; }

    public int FailedLoginAttempts { get; set; }

    public DateTimeOffset? LockoutEndUtc { get; set; }

    public Guid SecurityStamp { get; set; } = Guid.NewGuid();

    public ICollection<UserRole> Roles { get; set; } = [];

    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}

public sealed class Role : AuditableEntity
{
    public string Name { get; set; } = string.Empty;

    public string NormalizedName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public bool IsSystem { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<UserRole> Users { get; set; } = [];

    public ICollection<RolePermission> Permissions { get; set; } = [];
}

public sealed class Permission : Entity
{
    public string Code { get; set; } = string.Empty;

    public string Module { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public ICollection<RolePermission> Roles { get; set; } = [];
}

public sealed class UserRole : Entity
{
    public Guid UserId { get; set; }

    public UserAccount User { get; set; } = null!;

    public Guid RoleId { get; set; }

    public Role Role { get; set; } = null!;

    public DateTimeOffset AssignedAtUtc { get; set; }

    public Guid? AssignedByUserId { get; set; }

    public DateTimeOffset? ValidFromUtc { get; set; }

    public DateTimeOffset? ValidUntilUtc { get; set; }
}

public sealed class RolePermission : Entity
{
    public Guid RoleId { get; set; }

    public Role Role { get; set; } = null!;

    public Guid PermissionId { get; set; }

    public Permission Permission { get; set; } = null!;
}

public sealed class RefreshToken : Entity
{
    public Guid UserId { get; set; }

    public UserAccount User { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }

    public string? ReplacedByTokenHash { get; set; }

    public string? CreatedByIp { get; set; }

    public string? RevokedByIp { get; set; }
}
