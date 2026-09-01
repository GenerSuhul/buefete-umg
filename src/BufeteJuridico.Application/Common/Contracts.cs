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

public static class ContactNormalization
{
    public static string Digits(string? value) =>
        string.Concat((value ?? string.Empty).Where(char.IsDigit));

    public static string? Cui(string? value)
    {
        var digits = Digits(value);
        if (digits.Length == 0) return null;
        return digits.Length == 13
            ? $"{digits[..4]} {digits.Substring(4, 5)} {digits.Substring(9, 4)}"
            : value?.Trim();
    }

    public static string? GuatemalaPhone(string? value)
    {
        var digits = Digits(value);
        if (digits.Length == 0) return null;
        if (digits.Length == 11 && digits.StartsWith("502", StringComparison.Ordinal))
            return $"+502 {digits.Substring(3, 4)} {digits.Substring(7, 4)}";
        return digits.Length == 8
            ? $"{digits[..4]} {digits[4..]}"
            : value?.Trim();
    }

    public static bool IsValidCui(string? value, bool required = true)
    {
        var digits = Digits(value);
        return (!required && digits.Length == 0) || digits.Length == 13;
    }

    public static bool IsValidGuatemalaPhone(string? value)
    {
        var digits = Digits(value);
        return digits.Length == 0 || digits.Length == 8 ||
            (digits.Length == 11 && digits.StartsWith("502", StringComparison.Ordinal));
    }
}
