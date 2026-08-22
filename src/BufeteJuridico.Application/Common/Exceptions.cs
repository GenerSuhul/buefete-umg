namespace BufeteJuridico.Application.Common;

public abstract class ApplicationExceptionBase(string message) : Exception(message);

public sealed class NotFoundException(string message) : ApplicationExceptionBase(message);

public sealed class ConflictException(string message) : ApplicationExceptionBase(message);

public sealed class ForbiddenException(string message) : ApplicationExceptionBase(message);

public sealed class ValidationException(
    string message,
    IReadOnlyDictionary<string, string[]>? errors = null)
    : ApplicationExceptionBase(message)
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } =
        errors ?? new Dictionary<string, string[]>();
}

public sealed class AuthenticationException(string message) : ApplicationExceptionBase(message);
