using System.Security.Claims;
using Asp.Versioning;
using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Persistence;
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
        var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(item => item.Id == userId, context.HttpContext.RequestAborted);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (user is null ||
            user.SecurityStamp != securityStamp ||
            !UserAccessRules.CanSignIn(user, today))
        {
            context.Fail("La cuenta ya no está habilitada.");
        }
    }
}
