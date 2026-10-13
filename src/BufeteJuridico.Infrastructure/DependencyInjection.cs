using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using BufeteJuridico.Application.Administration;
using BufeteJuridico.Application.Cases;
using BufeteJuridico.Application.Catalogs;
using BufeteJuridico.Application.Clients;
using BufeteJuridico.Application.Dashboard;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Application.Operations;
using BufeteJuridico.Application.Queries;
using BufeteJuridico.Application.Students;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Administration;
using BufeteJuridico.Infrastructure.Cases;
using BufeteJuridico.Infrastructure.Catalogs;
using BufeteJuridico.Infrastructure.Clients;
using BufeteJuridico.Infrastructure.Dashboard;
using BufeteJuridico.Infrastructure.Documents;
using BufeteJuridico.Infrastructure.Identity;
using BufeteJuridico.Infrastructure.Operations;
using BufeteJuridico.Infrastructure.Persistence;
using BufeteJuridico.Infrastructure.Queries;
using BufeteJuridico.Infrastructure.Students;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BufeteJuridico.Infrastructure;

public static class DependencyInjection
{
    private const string ConnectionStringName = "BufeteDb";

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException($"La cadena de conexión '{ConnectionStringName}' no está configurada.");

        services.AddSingleton(TimeProvider.System);
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(options =>
                !string.IsNullOrWhiteSpace(options.Issuer) &&
                !string.IsNullOrWhiteSpace(options.Audience) &&
                options.SigningKey.Length >= 32 &&
                options.AccessTokenMinutes is >= 5 and <= 120 &&
                options.RefreshTokenDays is >= 1 and <= 90,
                "La configuración JWT no cumple los límites de seguridad.")
            .ValidateOnStart();
        services.AddOptions<DatabaseOptions>().Bind(configuration.GetSection(DatabaseOptions.SectionName));
        services.AddOptions<BootstrapAdminOptions>().Bind(configuration.GetSection(BootstrapAdminOptions.SectionName));
        services.AddOptions<StorageOptions>()
            .Bind(configuration.GetSection(StorageOptions.SectionName))
            .Validate(options => options.MaxFileSizeBytes > 0 && options.DownloadUrlMinutes is >= 1 and <= 60,
                "La configuración de almacenamiento contiene límites inválidos.")
            .ValidateOnStart();
        services.AddOptions<ScannerOptions>()
            .Bind(configuration.GetSection(ScannerOptions.SectionName))
            .Validate(options =>
                options.SessionMinutes > 0 && options.MaximumPages is >= 1 and <= 500 &&
                options.CleanupIntervalMinutes > 0 && options.DraftRetentionDays > 0,
                "La configuración del escáner contiene límites inválidos.")
            .ValidateOnStart();
        services.AddOptions<SmtpOptions>()
            .Bind(configuration.GetSection(SmtpOptions.SectionName))
            .Validate(options => !options.Enabled ||
                (!string.IsNullOrWhiteSpace(options.Host) && options.Port is >= 1 and <= 65535 &&
                 !string.IsNullOrWhiteSpace(options.FromAddress)),
                "SMTP habilitado requiere host, puerto y remitente válidos.")
            .ValidateOnStart();

        var storage = configuration.GetSection(StorageOptions.SectionName).Get<StorageOptions>() ?? new StorageOptions();
        ConfigureStorage(services, storage);

        services.AddScoped<TenantContext>();
        services.AddScoped<TenantRegistry>();
        services.AddScoped<ITenantManagementService>(provider => provider.GetRequiredService<TenantRegistry>());
        services.AddDbContext<BufeteDbContext>((provider, options) =>
            options.UseNpgsql(provider.GetRequiredService<TenantContext>().ConnectionString, postgresOptions =>
            {
                postgresOptions.CommandTimeout(30);
                postgresOptions.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null);
                postgresOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            }));

        services.AddScoped<IPasswordHasher<UserAccount>, PasswordHasher<UserAccount>>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IClientRestrictionService, ClientRestrictionService>();
        services.AddScoped<IStudentService, StudentService>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<ICaseService, CaseService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IScanSessionService, ScanSessionService>();
        services.AddHostedService<ScanSessionCleanupService>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        services.AddScoped<IActivityReportService, ActivityReportService>();
        services.AddScoped<IQueryService, QueryService>();
        services.AddScoped<IDeletedRecordService, DeletedRecordService>();
        services.AddScoped<IDatabaseInitializer, DatabaseInitializer>();

        var healthChecks = services.AddHealthChecks().AddDbContextCheck<BufeteDbContext>(
            name: "postgresql",
            failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Unhealthy,
            tags: ["ready"]);
        if (storage.Provider == StorageProviderType.S3)
        {
            healthChecks.AddCheck<S3StorageHealthCheck>(
                "object-storage",
                failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Unhealthy,
                tags: ["ready"]);
        }

        return services;
    }

    private static void ConfigureStorage(IServiceCollection services, StorageOptions storage)
    {
        if (storage.MaxFileSizeBytes <= 0)
            throw new InvalidOperationException("Storage:MaxFileSizeBytes debe ser mayor que cero.");

        if (storage.Provider == StorageProviderType.Local)
        {
            if (string.IsNullOrWhiteSpace(storage.RootPath))
                throw new InvalidOperationException("Storage:RootPath es obligatorio para el proveedor local.");
            services.AddScoped<IFileStorage, LocalFileStorage>();
            return;
        }

        if (storage.Provider != StorageProviderType.S3)
            throw new InvalidOperationException($"El proveedor de almacenamiento '{storage.Provider}' no es compatible.");
        if (string.IsNullOrWhiteSpace(storage.S3.BucketName) || string.IsNullOrWhiteSpace(storage.S3.Region))
            throw new InvalidOperationException("Storage:S3:BucketName y Storage:S3:Region son obligatorios.");
        if (string.IsNullOrWhiteSpace(storage.S3.AccessKey) != string.IsNullOrWhiteSpace(storage.S3.SecretKey))
            throw new InvalidOperationException("Storage:S3:AccessKey y Storage:S3:SecretKey deben configurarse juntos o dejarse vacíos para usar la identidad del entorno.");

        services.AddSingleton<IAmazonS3>(_ =>
        {
            var config = new AmazonS3Config
            {
                ForcePathStyle = storage.S3.ForcePathStyle
            };
            if (string.IsNullOrWhiteSpace(storage.S3.ServiceUrl))
            {
                config.RegionEndpoint = RegionEndpoint.GetBySystemName(storage.S3.Region);
            }
            else
            {
                config.ServiceURL = storage.S3.ServiceUrl.TrimEnd('/');
                config.AuthenticationRegion = storage.S3.Region;
                config.UseHttp = Uri.TryCreate(storage.S3.ServiceUrl, UriKind.Absolute, out var serviceUri) &&
                                 serviceUri.Scheme == Uri.UriSchemeHttp;
            }

            if (string.IsNullOrWhiteSpace(storage.S3.AccessKey))
                return new AmazonS3Client(config);

            AWSCredentials credentials = new BasicAWSCredentials(storage.S3.AccessKey, storage.S3.SecretKey);
            return new AmazonS3Client(credentials, config);
        });
        services.AddScoped<IFileStorage, S3FileStorage>();
    }
}
