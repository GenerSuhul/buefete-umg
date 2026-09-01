using Microsoft.Extensions.Configuration;

namespace BufeteJuridico.Api.Infrastructure.Configuration;

public static class ProductionConfigurationValidator
{
    public static void Validate(
        IConfiguration configuration,
        bool isDevelopment,
        bool migrationOnly)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        if (isDevelopment || migrationOnly) return;

        var allowedHosts = (configuration["AllowedHosts"] ?? string.Empty)
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (allowedHosts.Length == 0 || allowedHosts.Contains("*", StringComparer.Ordinal))
            throw new InvalidOperationException("AllowedHosts debe contener los dominios explícitos de producción.");

        var knownProxies = configuration
            .GetSection("ReverseProxy:KnownProxies")
            .Get<string[]>() ?? [];
        if (knownProxies.Length == 0)
            throw new InvalidOperationException("ReverseProxy:KnownProxies debe identificar el proxy de producción.");

        if (!string.Equals(configuration["Storage:Provider"], "S3", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Producción requiere almacenamiento de objetos S3 compatible.");
    }
}
