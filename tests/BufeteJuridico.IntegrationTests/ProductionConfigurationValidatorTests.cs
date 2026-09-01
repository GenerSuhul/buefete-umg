using BufeteJuridico.Api.Infrastructure.Configuration;
using Microsoft.Extensions.Configuration;

namespace BufeteJuridico.IntegrationTests;

public sealed class ProductionConfigurationValidatorTests
{
    [Fact]
    public void Production_rejects_wildcard_hosts_local_storage_and_missing_proxy()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["AllowedHosts"] = "*",
            ["Storage:Provider"] = "Local"
        });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(configuration, isDevelopment: false, migrationOnly: false));

        Assert.Contains("AllowedHosts", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Production_accepts_explicit_hosts_proxy_and_object_storage()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["AllowedHosts"] = "bufete.umg.edu.gt",
            ["ReverseProxy:KnownProxies:0"] = "10.0.0.10",
            ["Storage:Provider"] = "S3"
        });

        ProductionConfigurationValidator.Validate(configuration, isDevelopment: false, migrationOnly: false);
    }

    [Fact]
    public void Migration_command_does_not_require_http_runtime_settings()
    {
        ProductionConfigurationValidator.Validate(
            BuildConfiguration([]),
            isDevelopment: false,
            migrationOnly: true);
    }

    private static IConfiguration BuildConfiguration(IEnumerable<KeyValuePair<string, string?>> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
