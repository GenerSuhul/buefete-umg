namespace BufeteJuridico.Application.Common;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => TotalCount == 0
        ? 0
        : (int)Math.Ceiling((double)TotalCount / PageSize);
}

public interface ICurrentUser
{
    Guid? UserId { get; }

    string? Username { get; }

    string? TraceId { get; }

    string? IpAddress { get; }

    bool IsAuthenticated { get; }

    bool HasPermission(string permission);
}

public static class TextNormalization
{
    public static string Normalize(string value) => value.Trim().ToUpperInvariant();
}
