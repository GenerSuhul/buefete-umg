namespace BufeteJuridico.Domain.Identity;

public static class PasswordRules
{
    public const int MinimumLength = 8;
    public const int MaximumLength = 128;

    public static bool IsValid(string? password) =>
        !string.IsNullOrWhiteSpace(password) &&
        password.Length >= MinimumLength &&
        password.Length <= MaximumLength;
}
