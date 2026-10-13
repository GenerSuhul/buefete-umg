using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BufeteJuridico.Application.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BufeteJuridico.Api.Infrastructure.Authentication;

internal sealed class JwtAccessTokenIssuer(IOptions<JwtOptions> options, TimeProvider timeProvider) : IAccessTokenIssuer
{
    public IssuedAccessToken Issue(AccessTokenDescriptor descriptor)
    {
        var settings = options.Value;
        var now = timeProvider.GetUtcNow();
        var expires = now.AddMinutes(settings.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, descriptor.UserId.ToString()),
            new(ClaimTypes.Name, descriptor.Username),
            new(ClaimTypes.Email, descriptor.Email),
            new("full_name", descriptor.FullName),
            new("tenant_code", descriptor.TenantCode),
            new("platform_admin", descriptor.IsPlatformAdmin ? "true" : "false"),
            new(ClaimNames.SecurityStamp, descriptor.SecurityStamp.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        claims.AddRange(descriptor.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
        claims.AddRange(descriptor.Permissions.Select(permission => new Claim(ClaimNames.Permission, permission)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(GetSigningKey(settings.SigningKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: credentials);
        return new IssuedAccessToken(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public static byte[] GetSigningKey(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Jwt:SigningKey no está configurada.");
        try
        {
            var bytes = Convert.FromBase64String(value);
            if (bytes.Length < 32) throw new InvalidOperationException("Jwt:SigningKey debe contener al menos 32 bytes.");
            return bytes;
        }
        catch (FormatException)
        {
            var bytes = Encoding.UTF8.GetBytes(value);
            if (bytes.Length < 32) throw new InvalidOperationException("Jwt:SigningKey debe contener al menos 32 bytes.");
            return bytes;
        }
    }
}
