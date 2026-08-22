using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BufeteJuridico.Api.Infrastructure.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace BufeteJuridico.IntegrationTests;

public sealed class PlatformEndpointsTests : IClassFixture<PlatformApiFactory>
{
    private readonly HttpClient _client;

    public PlatformEndpointsTests(PlatformApiFactory factory)
    {
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    [Fact]
    public async Task System_endpoint_returns_service_information()
    {
        var response = await _client.GetAsync("/api/v1/system");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<SystemInfo>();

        Assert.NotNull(body);
        Assert.Equal("Bufete Jurídico UMG API", body.Service);
        Assert.False(string.IsNullOrWhiteSpace(body.Version));
    }

    [Fact]
    public async Task Liveness_endpoint_is_healthy_without_database_access()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Responses_include_baseline_security_headers()
    {
        var response = await _client.GetAsync("/api/v1/system");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.False(response.Headers.Contains("Server"));
    }

    [Fact]
    public async Task Authentication_rate_limit_is_partitioned_and_returns_problem_details()
    {
        HttpResponseMessage? response = null;
        // WebApplicationFactory applies the application configuration before
        // this test-specific source is added. Sending one request beyond the
        // production default keeps the assertion valid for both configurations.
        for (var attempt = 0; attempt < 11; attempt++)
        {
            response?.Dispose();
            response = await _client.PostAsync(
                "/api/v1/auth/login",
                new StringContent("{", System.Text.Encoding.UTF8, "application/json"));
        }

        Assert.NotNull(response);
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("Demasiados intentos", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        response.Dispose();
    }

    [Fact]
    public void Date_time_offsets_from_Guatemala_are_normalized_to_utc()
    {
        var options = new JsonSerializerOptions();
        options.Converters.Add(new UtcDateTimeOffsetJsonConverter());

        var value = JsonSerializer.Deserialize<DateTimeOffset>("\"2026-08-21T17:00:00-06:00\"", options);

        Assert.Equal(TimeSpan.Zero, value.Offset);
        Assert.Equal(23, value.Hour);
    }

    [Fact]
    public async Task Protected_endpoint_rejects_anonymous_requests()
    {
        var response = await _client.GetAsync("/api/v1/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Scanner_sessions_reject_anonymous_requests()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/scan-sessions", new { });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Dashboard_rejects_anonymous_requests()
    {
        var response = await _client.GetAsync("/api/v1/dashboard");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/system")]
    [InlineData("/api/v2/system")]
    public async Task Platform_endpoints_require_an_explicit_supported_version(string path)
    {
        var response = await _client.GetAsync(path);

        Assert.False(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task OpenApi_exposes_only_versioned_api_routes()
    {
        var response = await _client.GetAsync("/openapi/v1.json");
        var document = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("/api/v1/system", document, StringComparison.Ordinal);
        Assert.Contains("/api/v1/scan-sessions", document, StringComparison.Ordinal);
        Assert.Contains("/api/v1/Dashboard", document, StringComparison.Ordinal);
        Assert.DoesNotContain("\"/api/system\"", document, StringComparison.Ordinal);
        Assert.Contains("\"email\"", document, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"LoginRequest\":{\"properties\":{\"username\"", document, StringComparison.OrdinalIgnoreCase);
    }

    private sealed record SystemInfo(string Service, string Version, DateTimeOffset UtcNow);
}

public sealed class PlatformApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:BufeteDb"] =
                    "Host=127.0.0.1;Port=1;Database=unused;Username=unused;Password=unused",
                ["Database:ApplyMigrationsOnStartup"] = "false",
                ["Jwt:Issuer"] = "BufeteJuridicoUMG.Tests",
                ["Jwt:Audience"] = "BufeteJuridicoUMG.Tests.Client",
                ["Jwt:SigningKey"] =
                    "dGVzdC1vbmx5LXNpZ25pbmcta2V5LXdpdGgtbW9yZS10aGFuLXRoaXJ0eS10d28tYnl0ZXM=",
                ["RateLimiting:Authentication:PermitLimit"] = "1"
            });
        });
    }
}
