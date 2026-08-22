using System.Security.Cryptography;
using System.Text;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Domain.Auditing;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Identity;

internal sealed class AuthenticationService(
    BufeteDbContext dbContext,
    IPasswordHasher<UserAccount> passwordHasher,
    IAccessTokenIssuer accessTokenIssuer,
    IOptions<JwtOptions> jwtOptions,
    ICurrentUser currentUser,
    TimeProvider timeProvider)
    : IAuthenticationService
{
    private const int MaximumFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public async Task<TokenResponse> LoginAsync(
        LoginRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new AuthenticationException("Usuario o contraseña incorrectos.");
        }

        var normalizedEmail = TextNormalization.Normalize(request.Email);
        var user = await LoadUserAsync(normalizedEmail, cancellationToken);
        var now = timeProvider.GetUtcNow();

        if (user is null || !UserAccessRules.CanSignIn(user, DateOnly.FromDateTime(now.UtcDateTime)))
        {
            throw new AuthenticationException("Usuario o contraseña incorrectos.");
        }

        if (user.LockoutEndUtc > now)
        {
            throw new AuthenticationException("La cuenta está bloqueada temporalmente.");
        }

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);

        if (verification == PasswordVerificationResult.Failed)
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= MaximumFailedAttempts)
            {
                user.LockoutEndUtc = now.Add(LockoutDuration);
                user.FailedLoginAttempts = 0;
            }

            AddAuthenticationAudit("LoginFailed", user, ipAddress);
            await dbContext.SaveChangesAsync(cancellationToken);
            throw new AuthenticationException("Usuario o contraseña incorrectos.");
        }

        user.FailedLoginAttempts = 0;
        user.LockoutEndUtc = null;

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        }

        var response = await IssueTokenPairAsync(user, ipAddress, cancellationToken);
        AddAuthenticationAudit("LoginSucceeded", user, ipAddress);
        await dbContext.SaveChangesAsync(cancellationToken);

        return response;
    }

    public async Task<TokenResponse> RefreshAsync(
        RefreshRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(request.RefreshToken);
        var now = timeProvider.GetUtcNow();
        var refreshToken = await dbContext.RefreshTokens
            .Include(item => item.User)
                .ThenInclude(item => item.Roles)
                    .ThenInclude(item => item.Role)
                        .ThenInclude(item => item.Permissions)
                            .ThenInclude(item => item.Permission)
            .SingleOrDefaultAsync(item => item.TokenHash == tokenHash, cancellationToken)
            ?? throw new AuthenticationException("El token de renovación no es válido.");

        if (refreshToken.RevokedAtUtc is not null || refreshToken.ExpiresAtUtc <= now ||
            !UserAccessRules.CanSignIn(refreshToken.User, DateOnly.FromDateTime(now.UtcDateTime)))
        {
            throw new AuthenticationException("El token de renovación expiró o fue revocado.");
        }

        refreshToken.RevokedAtUtc = now;
        refreshToken.RevokedByIp = ipAddress;

        var response = await IssueTokenPairAsync(refreshToken.User, ipAddress, cancellationToken);
        refreshToken.ReplacedByTokenHash = HashToken(response.RefreshToken);
        AddAuthenticationAudit("TokenRefreshed", refreshToken.User, ipAddress);
        await dbContext.SaveChangesAsync(cancellationToken);

        return response;
    }

    public async Task RevokeAsync(
        RefreshRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(request.RefreshToken);
        var refreshToken = await dbContext.RefreshTokens
            .Include(item => item.User)
            .SingleOrDefaultAsync(item => item.TokenHash == tokenHash, cancellationToken)
            ?? throw new NotFoundException("No se encontró el token de renovación.");

        if (currentUser.UserId != refreshToken.UserId)
        {
            throw new ForbiddenException("No puede revocar una sesión perteneciente a otro usuario.");
        }

        if (refreshToken.RevokedAtUtc is null)
        {
            refreshToken.RevokedAtUtc = timeProvider.GetUtcNow();
            refreshToken.RevokedByIp = ipAddress;
            AddAuthenticationAudit("TokenRevoked", refreshToken.User, ipAddress);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<UserAccount?> LoadUserAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        await dbContext.Users
            .Include(item => item.Roles)
                .ThenInclude(item => item.Role)
                    .ThenInclude(item => item.Permissions)
                        .ThenInclude(item => item.Permission)
            .SingleOrDefaultAsync(item => item.NormalizedEmail == normalizedEmail, cancellationToken);

    private async Task<TokenResponse> IssueTokenPairAsync(
        UserAccount user,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var activeUserRoles = user.Roles
            .Where(item =>
                item.Role.IsActive &&
                (item.ValidFromUtc is null || item.ValidFromUtc <= now) &&
                (item.ValidUntilUtc is null || item.ValidUntilUtc > now))
            .ToList();

        var roles = activeUserRoles
            .Select(item => item.Role.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var permissions = activeUserRoles
            .SelectMany(item => item.Role.Permissions)
            .Select(item => item.Permission.Code)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var accessToken = accessTokenIssuer.Issue(new AccessTokenDescriptor(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.SecurityStamp,
            roles,
            permissions));

        var rawRefreshToken = GenerateRefreshToken();
        var refreshExpiry = now.AddDays(jwtOptions.Value.RefreshTokenDays);

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefreshToken),
            CreatedAtUtc = now,
            ExpiresAtUtc = refreshExpiry,
            CreatedByIp = ipAddress
        });

        await RemoveExpiredTokensAsync(user.Id, now, cancellationToken);

        return new TokenResponse(
            accessToken.Value,
            accessToken.ExpiresAtUtc,
            rawRefreshToken,
            refreshExpiry,
            new AuthenticatedUserDto(
                user.Id,
                user.Username,
                user.Email,
                user.FullName,
                user.PhotoDocumentId,
                roles,
                permissions));
    }

    private async Task RemoveExpiredTokensAsync(Guid userId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var expiredTokens = await dbContext.RefreshTokens
            .Where(item => item.UserId == userId && item.ExpiresAtUtc < now.AddDays(-30))
            .ToListAsync(cancellationToken);

        dbContext.RefreshTokens.RemoveRange(expiredTokens);
    }

    private void AddAuthenticationAudit(string action, UserAccount user, string? ipAddress)
    {
        dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            Username = user.Username,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Action = action,
            EntityType = nameof(UserAccount),
            EntityId = user.Id.ToString(),
            TraceId = currentUser.TraceId,
            IpAddress = ipAddress
        });
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string HashToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new AuthenticationException("El token de renovación es obligatorio.");
        }

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }
}
