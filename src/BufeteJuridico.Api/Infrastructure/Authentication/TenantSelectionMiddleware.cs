using BufeteJuridico.Infrastructure.Tenancy;

namespace BufeteJuridico.Api.Infrastructure.Authentication;

internal sealed class TenantSelectionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext http, TenantRegistry registry, TenantContext context)
    {
        var needsTenant = http.Request.Headers.ContainsKey("Authorization") ||
            http.Request.Path.Value?.EndsWith("/auth/login", StringComparison.Ordinal) == true ||
            http.Request.Path.Value?.EndsWith("/auth/refresh", StringComparison.Ordinal) == true;
        if (http.Request.Path.StartsWithSegments("/api") && needsTenant)
        {
            var code = http.Request.Headers["X-Sede-Code"].FirstOrDefault()?.Trim().ToLowerInvariant() ?? "peten";
            var tenant = await registry.ResolveAsync(code, http.RequestAborted);
            context.Select(tenant.Code, tenant.Name, tenant.DatabaseName);
        }
        await next(http);
    }
}
