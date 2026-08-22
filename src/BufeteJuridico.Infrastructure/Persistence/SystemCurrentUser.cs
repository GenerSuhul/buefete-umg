using BufeteJuridico.Application.Common;

namespace BufeteJuridico.Infrastructure.Persistence;

internal sealed class SystemCurrentUser : ICurrentUser
{
    public Guid? UserId => null;

    public string? Username => "system";

    public string? TraceId => null;

    public string? IpAddress => null;

    public bool IsAuthenticated => false;

    public bool HasPermission(string permission) => false;
}
