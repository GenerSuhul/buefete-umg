using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Identity;

internal sealed class UserManagementService(
    BufeteDbContext dbContext,
    IPasswordHasher<UserAccount> passwordHasher,
    ICurrentUser currentUser,
    TimeProvider timeProvider)
    : IUserManagementService
{
    public async Task<PagedResult<UserSummaryDto>> GetUsersAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        (page, pageSize) = ValidatePage(page, pageSize);
        var query = dbContext.Users.AsNoTracking().Include(item => item.Roles).ThenInclude(item => item.Role).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = TextNormalization.Normalize(search);
            query = query.Where(item =>
                item.NormalizedUsername.Contains(normalized) ||
                item.NormalizedEmail.Contains(normalized) ||
                item.FullName.ToUpper().Contains(normalized));
        }

        var total = await query.CountAsync(cancellationToken);
        var users = await query
            .OrderBy(item => item.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<UserSummaryDto>(users.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<UserSummaryDto> GetUserAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await LoadUserAsync(id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");
        return Map(user);
    }

    public async Task<UserSummaryDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken)
    {
        ValidateUserRequest(request.Username, request.Email, request.FullName, request.ParticipationStartDate, request.ParticipationEndDate);
        ValidatePassword(request.Password);

        var normalizedUsername = TextNormalization.Normalize(request.Username);
        var normalizedEmail = TextNormalization.Normalize(request.Email);

        if (await dbContext.Users.AnyAsync(item => item.NormalizedUsername == normalizedUsername, cancellationToken))
        {
            throw new ConflictException("El nombre de usuario ya está registrado.");
        }

        if (await dbContext.Users.AnyAsync(item => item.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            throw new ConflictException("El correo ya está registrado.");
        }

        var roles = await GetValidRolesAsync(request.RoleIds, cancellationToken);
        var isStudentAccount = roles.Any(item => item.NormalizedName == TextNormalization.Normalize("Alumno"));
        if (isStudentAccount && request.StudentId is null)
            throw new ValidationException("Debe vincular la cuenta del rol Alumno con un alumno registrado.");
        if (!isStudentAccount && request.StudentId is not null)
            throw new ValidationException("Sólo una cuenta con rol Alumno puede vincularse con un alumno.");
        var user = new UserAccount
        {
            Username = request.Username.Trim(),
            NormalizedUsername = normalizedUsername,
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            FullName = request.FullName.Trim(),
            IsActive = true,
            ParticipationStartDate = request.ParticipationStartDate,
            ParticipationEndDate = request.ParticipationEndDate
        };

        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        AddRoles(user, roles);
        dbContext.Users.Add(user);

        if (request.StudentId is not null)
        {
            var student = await dbContext.Students.SingleOrDefaultAsync(item => item.Id == request.StudentId, cancellationToken)
                ?? throw new NotFoundException("No se encontró el alumno que se vinculará con la cuenta.");

            if (student.UserAccountId is not null)
            {
                throw new ConflictException("El alumno ya tiene una cuenta vinculada.");
            }

            student.UserAccountId = user.Id;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    public async Task<UserSummaryDto> UpdateUserAsync(Guid id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        ValidateUserRequest("existing", request.Email, request.FullName, request.ParticipationStartDate, request.ParticipationEndDate);
        var user = await LoadUserAsync(id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");

        var normalizedEmail = TextNormalization.Normalize(request.Email);
        if (await dbContext.Users.AnyAsync(item => item.Id != id && item.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            throw new ConflictException("El correo ya está registrado.");
        }

        var roles = await GetValidRolesAsync(request.RoleIds, cancellationToken);
        user.Email = request.Email.Trim();
        user.NormalizedEmail = normalizedEmail;
        user.FullName = request.FullName.Trim();
        user.IsActive = request.IsActive && !user.IsDeleted;
        user.ParticipationStartDate = request.ParticipationStartDate;
        user.ParticipationEndDate = request.ParticipationEndDate;
        user.SecurityStamp = Guid.NewGuid();

        dbContext.UserRoles.RemoveRange(user.Roles);
        user.Roles.Clear();
        AddRoles(user, roles);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    public async Task DeactivateUserAsync(Guid id, CancellationToken cancellationToken)
    {
        if (currentUser.UserId == id)
        {
            throw new ConflictException("No puede dar de baja su propia cuenta durante la sesión activa.");
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");

        user.IsActive = false;
        user.IsDeleted = true;
        user.SecurityStamp = Guid.NewGuid();

        var now = timeProvider.GetUtcNow();
        var activeTokens = await dbContext.RefreshTokens
            .Where(item => item.UserId == id && item.RevokedAtUtc == null && item.ExpiresAtUtc > now)
            .ToListAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            token.RevokedAtUtc = now;
            token.RevokedByIp = currentUser.IpAddress;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AssignRoleAsync(
        Guid userId,
        UserRoleAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ValidFromUtc is not null && request.ValidUntilUtc is not null && request.ValidUntilUtc <= request.ValidFromUtc)
            throw new ValidationException("La vigencia final del rol debe ser posterior a la inicial.");
        var user = await dbContext.Users.Include(item => item.Roles)
            .SingleOrDefaultAsync(item => item.Id == userId && !item.IsDeleted, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario activo.");
        var role = await dbContext.Roles.SingleOrDefaultAsync(item => item.Id == request.RoleId && item.IsActive, cancellationToken)
            ?? throw new NotFoundException("No se encontró el rol activo.");
        var assignment = user.Roles.SingleOrDefault(item => item.RoleId == request.RoleId);
        if (assignment is null)
        {
            assignment = new UserRole
            {
                User = user,
                Role = role,
                AssignedAtUtc = timeProvider.GetUtcNow(),
                AssignedByUserId = currentUser.UserId
            };
            dbContext.UserRoles.Add(assignment);
        }

        assignment.ValidFromUtc = request.ValidFromUtc;
        assignment.ValidUntilUtc = request.ValidUntilUtc;
        user.SecurityStamp = Guid.NewGuid();
        await RevokeActiveTokensAsync(userId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveRoleAsync(Guid userId, Guid roleId, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.Include(item => item.Roles)
            .SingleOrDefaultAsync(item => item.Id == userId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");
        var assignment = user.Roles.SingleOrDefault(item => item.RoleId == roleId)
            ?? throw new NotFoundException("El usuario no tiene el rol indicado.");
        if (user.Roles.Count <= 1) throw new ConflictException("El usuario debe conservar al menos un rol.");
        dbContext.UserRoles.Remove(assignment);
        user.SecurityStamp = Guid.NewGuid();
        await RevokeActiveTokensAsync(userId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ChangeOwnPasswordAsync(ChangeOwnPasswordRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException("No se pudo identificar al usuario.");
        ValidatePassword(request.NewPassword);
        var user = await dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId && !item.IsDeleted, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");
        if (passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            throw new AuthenticationException("La contraseña actual es incorrecta.");
        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        user.SecurityStamp = Guid.NewGuid();
        await RevokeActiveTokensAsync(userId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<UserSummaryDto> UpdateOwnProfileAsync(UpdateOwnProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException("No se pudo identificar al usuario.");
        ValidateUserRequest("existing", request.Email, request.FullName, null, null);
        var user = await LoadUserAsync(userId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");
        var normalizedEmail = TextNormalization.Normalize(request.Email);
        if (await dbContext.Users.AnyAsync(item => item.Id != userId && item.NormalizedEmail == normalizedEmail, cancellationToken))
            throw new ConflictException("El correo ya está registrado.");

        user.FullName = request.FullName.Trim();
        user.Email = request.Email.Trim();
        user.NormalizedEmail = normalizedEmail;
        var linkedStudent = await dbContext.Students.SingleOrDefaultAsync(
            item => item.UserAccountId == userId,
            cancellationToken);
        if (linkedStudent is not null)
        {
            linkedStudent.FullName = user.FullName;
            linkedStudent.NormalizedFullName = TextNormalization.Normalize(user.FullName);
            linkedStudent.Email = user.Email;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    public async Task ResetPasswordAsync(Guid userId, ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        ValidatePassword(request.NewPassword);
        var user = await dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId && !item.IsDeleted, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");
        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        user.SecurityStamp = Guid.NewGuid();
        await RevokeActiveTokensAsync(userId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<UserSummaryDto> SetPhotoAsync(
        Guid userId,
        SetUserPhotoRequest request,
        CancellationToken cancellationToken)
    {
        var user = await LoadUserAsync(userId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario.");

        if (request.DocumentId is Guid documentId &&
            !await dbContext.Documents.AnyAsync(item =>
                item.Id == documentId &&
                item.ContextType == DocumentContextType.UserPhoto &&
                item.ContextId == userId &&
                item.IsCurrent &&
                item.DeletedAtUtc == null,
                cancellationToken))
        {
            throw new ValidationException("La fotografía debe ser un documento vigente del contexto del usuario.");
        }

        user.PhotoDocumentId = request.DocumentId;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken)
    {
        var roles = await dbContext.Roles
            .AsNoTracking()
            .Include(item => item.Permissions)
                .ThenInclude(item => item.Permission)
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);

        return roles.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken cancellationToken) =>
        await dbContext.Permissions.AsNoTracking().OrderBy(item => item.Module).ThenBy(item => item.Code)
            .Select(item => new PermissionDto(item.Code, item.Module, item.Description))
            .ToListAsync(cancellationToken);

    public async Task<RoleDto> CreateRoleAsync(CreateRoleRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ValidationException("El nombre del rol es obligatorio.");
        }

        var normalizedName = TextNormalization.Normalize(request.Name);
        if (await dbContext.Roles.AnyAsync(item => item.NormalizedName == normalizedName, cancellationToken))
        {
            throw new ConflictException("El rol ya existe.");
        }

        var permissions = await GetValidPermissionsAsync(request.PermissionCodes, cancellationToken);
        var role = new Role
        {
            Name = request.Name.Trim(),
            NormalizedName = normalizedName,
            Description = request.Description.Trim(),
            IsActive = true,
            IsSystem = false
        };

        foreach (var permission in permissions)
        {
            dbContext.RolePermissions.Add(new RolePermission { Role = role, PermissionId = permission.Id });
        }

        dbContext.Roles.Add(role);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(role);
    }

    public async Task<RoleDto> UpdateRoleAsync(Guid id, UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        var role = await dbContext.Roles
            .Include(item => item.Permissions)
                .ThenInclude(item => item.Permission)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el rol.");

        var permissions = await GetValidPermissionsAsync(request.PermissionCodes, cancellationToken);
        role.Description = request.Description.Trim();
        role.IsActive = request.IsActive;
        dbContext.RolePermissions.RemoveRange(role.Permissions);
        role.Permissions.Clear();

        foreach (var permission in permissions)
        {
            dbContext.RolePermissions.Add(new RolePermission { Role = role, PermissionId = permission.Id });
        }

        var affectedUsers = await dbContext.Users
            .Where(item => item.Roles.Any(assignment => assignment.RoleId == id))
            .ToListAsync(cancellationToken);
        foreach (var user in affectedUsers) user.SecurityStamp = Guid.NewGuid();
        await RevokeActiveTokensAsync(affectedUsers.Select(item => item.Id).ToArray(), cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(role);
    }

    private async Task<UserAccount?> LoadUserAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.Users
            .Include(item => item.Roles)
                .ThenInclude(item => item.Role)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

    private async Task<List<Role>> GetValidRolesAsync(IReadOnlyList<Guid> roleIds, CancellationToken cancellationToken)
    {
        if (roleIds.Count == 0)
        {
            throw new ValidationException("Debe asignar al menos un rol.");
        }

        var distinctIds = roleIds.Distinct().ToArray();
        var roles = await dbContext.Roles
            .Where(item => distinctIds.Contains(item.Id) && item.IsActive)
            .ToListAsync(cancellationToken);

        if (roles.Count != distinctIds.Length)
        {
            throw new ValidationException("Uno o más roles no existen o están inactivos.");
        }

        return roles;
    }

    private async Task<List<Permission>> GetValidPermissionsAsync(IReadOnlyList<string> permissionCodes, CancellationToken cancellationToken)
    {
        var codes = permissionCodes.Select(item => item.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var permissions = await dbContext.Permissions.Where(item => codes.Contains(item.Code)).ToListAsync(cancellationToken);

        if (permissions.Count != codes.Length)
        {
            throw new ValidationException("Uno o más permisos no existen.");
        }

        return permissions;
    }

    private async Task RevokeActiveTokensAsync(Guid userId, CancellationToken cancellationToken)
        => await RevokeActiveTokensAsync([userId], cancellationToken);

    private async Task RevokeActiveTokensAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count == 0) return;
        var now = timeProvider.GetUtcNow();
        var tokens = await dbContext.RefreshTokens
            .Where(item => userIds.Contains(item.UserId) && item.RevokedAtUtc == null && item.ExpiresAtUtc > now)
            .ToListAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.RevokedAtUtc = now;
            token.RevokedByIp = currentUser.IpAddress;
        }
    }

    private void AddRoles(UserAccount user, IEnumerable<Role> roles)
    {
        foreach (var role in roles)
        {
            dbContext.UserRoles.Add(new UserRole
            {
                User = user,
                RoleId = role.Id,
                AssignedAtUtc = timeProvider.GetUtcNow(),
                AssignedByUserId = currentUser.UserId
            });
        }
    }

    private static void ValidateUserRequest(string username, string email, string fullName, DateOnly? startDate, DateOnly? endDate)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(username)) errors["username"] = ["El usuario es obligatorio."];
        if (string.IsNullOrWhiteSpace(fullName)) errors["fullName"] = ["El nombre es obligatorio."];
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@', StringComparison.Ordinal)) errors["email"] = ["El correo no es válido."];
        if (startDate is not null && endDate is not null && endDate < startDate) errors["participationEndDate"] = ["La fecha final no puede ser anterior a la inicial."];
        if (errors.Count > 0) throw new ValidationException("Revise los datos del usuario.", errors);
    }

    private static void ValidatePassword(string password)
    {
        if (password.Length < 12 ||
            !password.Any(char.IsUpper) ||
            !password.Any(char.IsLower) ||
            !password.Any(char.IsDigit) ||
            !password.Any(character => !char.IsLetterOrDigit(character)))
        {
            throw new ValidationException("La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.");
        }
    }

    private static (int Page, int PageSize) ValidatePage(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));

    private static UserSummaryDto Map(UserAccount user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.FullName,
        user.IsActive,
        user.IsDeleted,
        user.ParticipationStartDate,
        user.ParticipationEndDate,
        user.PhotoDocumentId,
        user.Roles.Select(item => item.Role.Name).Order(StringComparer.OrdinalIgnoreCase).ToList());

    private static RoleDto Map(Role role) => new(
        role.Id,
        role.Name,
        role.Description,
        role.IsSystem,
        role.IsActive,
        role.Permissions.Select(item => item.Permission.Code).Order(StringComparer.OrdinalIgnoreCase).ToList());
}
