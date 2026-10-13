using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure;

public static class DatabaseInitializationExtensions
{
    public static async Task InitialiseDatabaseAsync(
        this IServiceProvider services,
        CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        if (!options.ApplyMigrationsOnStartup) return;
        await InitialiseScopeAsync(scope.ServiceProvider, cancellationToken);
    }

    public static async Task MigrateAndSeedDatabaseAsync(
        this IServiceProvider services,
        CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        await InitialiseScopeAsync(scope.ServiceProvider, cancellationToken);
    }

    private static async Task InitialiseScopeAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken)
    {
        var initializer = serviceProvider.GetRequiredService<IDatabaseInitializer>();
        await initializer.InitialiseAsync(cancellationToken);
        var registry = serviceProvider.GetRequiredService<TenantRegistry>();
        await registry.InitialiseAsync(cancellationToken);
        await using var central = registry.OpenCentral();
        var tenants = await central.Tenants.AsNoTracking().Where(item => item.Code != "peten" && item.Status == "Ready").ToListAsync(cancellationToken);
        foreach (var tenant in tenants)
        {
            var connection = new Npgsql.NpgsqlConnectionStringBuilder(central.Database.GetConnectionString()) { Database = tenant.DatabaseName }.ConnectionString;
            await using var target = new BufeteDbContext(new DbContextOptionsBuilder<BufeteDbContext>().UseNpgsql(connection).Options,
                new SystemCurrentUser(), TimeProvider.System);
            await target.Database.MigrateAsync(cancellationToken);
        }
    }
}
