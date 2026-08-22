using System.Security.Claims;
using BufeteJuridico.Application.Common;

namespace BufeteJuridico.Api.Infrastructure.Authentication;

internal sealed class HttpCurrentUser(IHttpContextAccessor contextAccessor) : ICurrentUser
{
    private HttpContext? Context => contextAccessor.HttpContext;

    public Guid? UserId => Guid.TryParse(
        Context?.User.FindFirstValue(ClaimTypes.NameIdentifier),
        out var id)
        ? id
        : null;

    public string? Username => Context?.User.FindFirstValue(ClaimTypes.Name);

    public string? TraceId => Context?.TraceIdentifier;

    public string? IpAddress => Context?.Connection.RemoteIpAddress?.ToString();

    public bool IsAuthenticated => Context?.User.Identity?.IsAuthenticated == true;

    public bool HasPermission(string permission) =>
        Context?.User.Claims.Any(claim =>
            claim.Type == ClaimNames.Permission &&
            string.Equals(claim.Value, permission, StringComparison.OrdinalIgnoreCase)) == true;
}
