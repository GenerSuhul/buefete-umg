using System.Security.Claims;
using Asp.Versioning;
using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace BufeteJuridico.Api.Infrastructure.Authentication;

internal static class AuthenticationExtensions
{
    public static IServiceCollection AddApiPlatformSecurity(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .PostConfigure(options =>
            {
                var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                    ?? throw new InvalidOperationException("La configuración JWT es obligatoria.");
                if (string.IsNullOrWhiteSpace(jwt.Issuer) || string.IsNullOrWhiteSpace(jwt.Audience))
                    throw new InvalidOperationException("Jwt:Issuer y Jwt:Audience son obligatorios.");
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(JwtAccessTokenIssuer.GetSigningKey(jwt.SigningKey)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = ClaimTypes.Name,
                    RoleClaimType = ClaimTypes.Role
                };
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = ValidateSecurityStampAsync
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("PlatformAdmin", policy => policy.RequireAuthenticatedUser().RequireClaim("platform_admin", "true"));
            foreach (var permission in Permissions.All)
                options.AddPolicy(permission.Code, policy => policy.RequireClaim(ClaimNames.Permission, permission.Code));
        });

        services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = false;
            options.ReportApiVersions = true;
            options.ApiVersionReader = new UrlSegmentApiVersionReader();
        })
        .AddMvc()
        .AddApiExplorer(options =>
        {
            options.GroupNameFormat = "'v'VVV";
            options.SubstituteApiVersionInUrl = true;
        });

        return services;
    }

    private static async Task ValidateSecurityStampAsync(TokenValidatedContext context)
    {
        var idValue = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var stampValue = context.Principal?.FindFirstValue(ClaimNames.SecurityStamp);
        if (!Guid.TryParse(idValue, out var userId) || !Guid.TryParse(stampValue, out var securityStamp))
        {
            context.Fail("El token no contiene identidad válida.");
            return;
        }

        var dbContext = context.HttpContext.RequestServices.GetRequiredService<BufeteDbContext>();
        var tenant = context.HttpContext.RequestServices.GetRequiredService<TenantContext>();
        var tokenTenant = context.Principal?.FindFirstValue("tenant_code") ?? "peten";
        if (!string.Equals(tokenTenant, tenant.Code, StringComparison.Ordinal))
        {
            context.Fail("La sesión no pertenece a esta sede.");
            return;
        }
        var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(item => item.Id == userId, context.HttpContext.RequestAborted);
        var now = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        if (user is null ||
            user.SecurityStamp != securityStamp ||
            !UserAccessRules.CanSignIn(user, today))
        {
            context.Fail("La cuenta ya no está habilitada.");
            return;
        }
        var studentDpi = await dbContext.Students.AsNoTracking()
            .Where(student => student.UserAccountId == userId)
            .Select(student => student.Dpi)
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (studentDpi is not null && await context.HttpContext.RequestServices
            .GetRequiredService<TenantRegistry>()
            .IsStudentSuspendedAsync(studentDpi, context.HttpContext.RequestAborted))
        {
            context.Fail("La cuenta del alumno está suspendida en todas las sedes.");
            return;
        }

        var platformClaim = context.Principal?.FindFirstValue("platform_admin") == "true";
        if (platformClaim != user.IsPlatformAccount || (platformClaim &&
            !await context.HttpContext.RequestServices.GetRequiredService<TenantRegistry>()
                .IsPlatformAccountValidAsync(userId, securityStamp, context.HttpContext.RequestAborted)))
        {
            context.Fail("La cuenta de plataforma ya no está habilitada.");
            return;
        }
        // Platform privileges cannot be granted or removed through a tenant's role editor.
        if (platformClaim) return;

        var activeAssignments = await dbContext.UserRoles.AsNoTracking()
            .Where(item =>
                item.UserId == userId &&
                item.Role.IsActive &&
                (item.ValidFromUtc == null || item.ValidFromUtc <= now) &&
                (item.ValidUntilUtc == null || item.ValidUntilUtc > now))
            .Select(item => new
            {
                item.Role.Name,
                Permissions = item.Role.Permissions.Select(link => link.Permission.Code)
            })
            .ToListAsync(context.HttpContext.RequestAborted);
        var activeRoles = activeAssignments.Select(item => item.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var activePermissions = activeAssignments.SelectMany(item => item.Permissions).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var tokenRoles = context.Principal?.FindAll(ClaimTypes.Role).Select(item => item.Value).ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];
        var tokenPermissions = context.Principal?.FindAll(ClaimNames.Permission).Select(item => item.Value).ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];
        if (!tokenRoles.SetEquals(activeRoles) || !tokenPermissions.SetEquals(activePermissions))
            context.Fail("Los permisos de la sesión cambiaron. Inicie sesión nuevamente.");
    }
}
