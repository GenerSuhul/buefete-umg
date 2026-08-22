using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

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
    }
}
