using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BufeteJuridico.Api.Infrastructure.Auditing;
using BufeteJuridico.Api.Infrastructure.Authentication;
using BufeteJuridico.Api.Infrastructure.Configuration;
using BufeteJuridico.Api.Infrastructure.Errors;
using BufeteJuridico.Api.Infrastructure.HealthChecks;
using BufeteJuridico.Api.Infrastructure.OpenApi;
using BufeteJuridico.Api.Infrastructure.Serialization;
using BufeteJuridico.Application;
using BufeteJuridico.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;

DevelopmentEnvironmentLoader.LoadIfAvailable();
var builder = WebApplication.CreateBuilder(args);
var migrationOnly = args.Contains("--migrate", StringComparer.OrdinalIgnoreCase);
ProductionConfigurationValidator.Validate(
    builder.Configuration,
    builder.Environment.IsDevelopment(),
    migrationOnly);
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

builder.Services
    .AddControllers(options => options.SuppressAsyncSuffixInActionNames = false)
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeOffsetJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
    options.AddOperationTransformer<BearerSecurityRequirementTransformer>();
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddApiPlatformSecurity(builder.Configuration);
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var authenticationPermitLimit = builder.Configuration.GetValue("RateLimiting:Authentication:PermitLimit", 10);
var authenticationWindowSeconds = builder.Configuration.GetValue("RateLimiting:Authentication:WindowSeconds", 60);
if (authenticationPermitLimit <= 0 || authenticationWindowSeconds <= 0)
    throw new InvalidOperationException("La configuración de límite de autenticación debe ser mayor que cero.");

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";
        var problem = JsonSerializer.Serialize(new
        {
            type = "https://httpstatuses.com/429",
            title = "Demasiados intentos.",
            status = StatusCodes.Status429TooManyRequests,
            detail = "Espere un momento antes de intentar nuevamente.",
            traceId = context.HttpContext.TraceIdentifier
        });
        await context.HttpContext.Response.WriteAsync(problem, cancellationToken);
    };
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = authenticationPermitLimit,
            Window = TimeSpan.FromSeconds(authenticationWindowSeconds),
            QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            AutoReplenishment = true
        }));
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length == 0) throw new InvalidOperationException("Cors:AllowedOrigins debe contener al menos un origen.");
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var value in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [])
    {
        if (!IPAddress.TryParse(value, out var address))
            throw new InvalidOperationException($"ReverseProxy:KnownProxies contiene una dirección inválida: {value}");
        options.KnownProxies.Add(address);
    }
});

var app = builder.Build();
if (migrationOnly)
{
    await app.Services.MigrateAndSeedDatabaseAsync(app.Lifetime.ApplicationStopping);
    return;
}
await app.Services.InitialiseDatabaseAsync(app.Lifetime.ApplicationStopping);

app.UseExceptionHandler();
app.UseForwardedHeaders();
app.UseResponseCompression();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["X-Permitted-Cross-Domain-Policies"] = "none";
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.Pragma = "no-cache";
    }
    await next(context);
});
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<RequestAuditMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = HealthCheckResponseWriter.WriteAsync
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = HealthCheckResponseWriter.WriteAsync
});

app.Run();

public partial class Program;
