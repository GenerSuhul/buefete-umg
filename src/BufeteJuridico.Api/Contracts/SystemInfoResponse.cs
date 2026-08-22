namespace BufeteJuridico.Api.Contracts;

public sealed record SystemInfoResponse(
    string Service,
    string Version,
    DateTimeOffset UtcNow);
