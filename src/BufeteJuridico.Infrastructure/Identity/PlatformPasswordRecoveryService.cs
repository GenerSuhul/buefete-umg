using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Application.Operations;
using BufeteJuridico.Domain.Auditing;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Operations;
using BufeteJuridico.Infrastructure.Persistence;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Identity;

internal sealed class PlatformPasswordRecoveryService(
    BufeteDbContext dbContext,
    IPasswordHasher<UserAccount> passwordHasher,
    IEmailSender sender,
    IOptions<SmtpOptions> smtp,
    IOptions<JwtOptions> jwt,
    TenantContext tenant,
    TimeProvider clock,
    ICurrentUser currentUser) : IPlatformPasswordRecoveryService
{
    private sealed record Challenge(Guid UserId, Guid SecurityStamp, long ExpiresAtUnix, string Salt, string CodeHash);
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private const string GenericMessage = "Si corresponde a la cuenta institucional, enviamos un código al correo registrado. Vigencia: 10 minutos.";

    public async Task<PlatformPasswordRecoveryChallenge> StartAsync(PlatformPasswordRecoveryStartRequest request, CancellationToken ct)
    {
        if (tenant.Code != "peten") throw new ValidationException("Solicite la recuperación desde la sede central Petén.");
        if (!smtp.Value.Enabled) throw new ConflictException("La recuperación por correo aún no está disponible. Contacte al responsable técnico.");
        if (string.IsNullOrWhiteSpace(request.Email) || !MailAddress.TryCreate(request.Email.Trim(), out _))
            throw new ValidationException("Indique un correo electrónico válido.");
        var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(u =>
            u.NormalizedEmail == TextNormalization.Normalize(request.Email) && u.IsPlatformAccount && !u.IsDeleted && u.IsActive, ct);
        var code = RandomNumberGenerator.GetInt32(0, 100_000_000).ToString("D8");
        var salt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var challenge = new Challenge(user?.Id ?? Guid.NewGuid(), user?.SecurityStamp ?? Guid.NewGuid(),
            clock.GetUtcNow().Add(Lifetime).ToUnixTimeSeconds(), salt, HashCode(code, salt));
        if (user is not null)
        {
            try
            {
                await sender.SendAsync([user.Email], "Código de recuperación del Bufete Popular UMG",
                    $"<p>Su código de recuperación es <strong>{code}</strong>.</p><p>Vence en 10 minutos. Si no solicitó el cambio, ignore este mensaje.</p>", ct);
            }
            catch (Exception ex) when (ex is SmtpException or InvalidOperationException)
            {
                throw new ConflictException("No se pudo enviar el código. Verifique el servicio de correo e inténtelo nuevamente.");
            }
        }
        return new PlatformPasswordRecoveryChallenge(Protect(challenge), GenericMessage);
    }

    public async Task CompleteAsync(PlatformPasswordRecoveryCompleteRequest request, CancellationToken ct)
    {
        if (tenant.Code != "peten") throw new ValidationException("Complete la recuperación desde la sede central Petén.");
        if (!PasswordRules.IsValid(request.NewPassword))
            throw new ValidationException("La contraseña debe tener entre 8 y 128 caracteres.");
        if (request.Code is null || request.Code.Length != 8 || !request.Code.All(char.IsAsciiDigit))
            throw new AuthenticationException("El código de recuperación es inválido o venció.");
        var challenge = Unprotect(request.ChallengeToken);
        if (challenge is null || challenge.ExpiresAtUnix < clock.GetUtcNow().ToUnixTimeSeconds() ||
            !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(challenge.CodeHash), Convert.FromHexString(HashCode(request.Code, challenge.Salt))))
            throw new AuthenticationException("El código de recuperación es inválido o venció.");

        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);
            await dbContext.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({challenge.UserId.ToString()}, 0))", ct);
            var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == challenge.UserId && u.IsPlatformAccount && !u.IsDeleted && u.IsActive, ct);
            if (user is null || user.SecurityStamp != challenge.SecurityStamp)
                throw new AuthenticationException("El código de recuperación es inválido o ya fue utilizado.");
            user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
            user.SecurityStamp = Guid.NewGuid();
            var now = clock.GetUtcNow();
            var activeTokens = await dbContext.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAtUtc == null && t.ExpiresAtUtc > now).ToListAsync(ct);
            foreach (var token in activeTokens) { token.RevokedAtUtc = now; token.RevokedByIp = currentUser.IpAddress; }
            dbContext.AuditLogs.Add(new AuditLog
            {
                UserId = user.Id, Username = user.Username, OccurredAtUtc = now,
                Action = "PlatformPasswordRecovered", EntityType = nameof(UserAccount), EntityId = user.Id.ToString(),
                TraceId = currentUser.TraceId, IpAddress = currentUser.IpAddress
            });
            await dbContext.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        });
    }

    private byte[] Key => SHA256.HashData(Encoding.UTF8.GetBytes("bufete-platform-recovery-v1:" + jwt.Value.SigningKey));
    private string HashCode(string code, string salt) => Convert.ToHexString(HMACSHA256.HashData(Key, Encoding.UTF8.GetBytes(salt + ":" + code)));
    private string Protect(Challenge challenge)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = JsonSerializer.SerializeToUtf8Bytes(challenge);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(Key, 16);
        aes.Encrypt(nonce, plain, cipher, tag);
        return Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }
    private Challenge? Unprotect(string token)
    {
        try
        {
            var bytes = Convert.FromBase64String(token ?? "");
            if (bytes.Length <= 28 || bytes.Length > 4096) return null;
            var plain = new byte[bytes.Length - 28];
            using var aes = new AesGcm(Key, 16);
            aes.Decrypt(bytes.AsSpan(0, 12), bytes.AsSpan(28), bytes.AsSpan(12, 16), plain);
            return JsonSerializer.Deserialize<Challenge>(plain);
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException or JsonException) { return null; }
    }
}
