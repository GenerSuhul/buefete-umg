using BufeteJuridico.Application.Documents;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using BufeteJuridico.Infrastructure.Tenancy;
using BufeteJuridico.Domain.Identity;

namespace BufeteJuridico.Infrastructure.Documents;

internal sealed class ScanSessionCleanupService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScannerOptions> options,
    TimeProvider timeProvider,
    ILogger<ScanSessionCleanupService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Clamp(options.Value.CleanupIntervalMinutes, 1, 1440));
        using var timer = new PeriodicTimer(interval, timeProvider);

        do
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "No se pudieron limpiar las sesiones de escaneo expiradas.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task CleanupAsync(CancellationToken cancellationToken)
    {
        await using var registryScope = scopeFactory.CreateAsyncScope();
        await using var central = registryScope.ServiceProvider.GetRequiredService<TenantRegistry>().OpenCentral();
        var tenants = await central.Tenants.AsNoTracking().Where(item => item.Status == "Ready").ToListAsync(cancellationToken);
        foreach (var tenant in tenants)
        {
            try { await CleanupTenantAsync(tenant, cancellationToken); }
            catch (Exception exception) when (exception is not OperationCanceledException)
            { logger.LogError(exception, "No se pudo limpiar las sesiones de la sede {TenantCode}.", tenant.Code); }
        }
    }

    private async Task CleanupTenantAsync(Tenant tenant, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Select(tenant.Code, tenant.Name, tenant.DatabaseName);
        var dbContext = scope.ServiceProvider.GetRequiredService<BufeteDbContext>();
        var fileStorage = scope.ServiceProvider.GetRequiredService<IFileStorage>();
        var now = timeProvider.GetUtcNow();
        var sessions = await dbContext.ScanSessions
            .Include(item => item.Pages)
            .Where(item =>
                ((item.Status == ScanSessionStatus.Created || item.Status == ScanSessionStatus.Captured) && item.ExpiresAtUtc <= now) ||
                ((item.Status == ScanSessionStatus.Completed || item.Status == ScanSessionStatus.Cancelled || item.Status == ScanSessionStatus.Failed || item.Status == ScanSessionStatus.Expired) &&
                 (item.StagedStorageKey != null || item.Pages.Any(page => page.OriginalStorageKey != ""))))
            .OrderBy(item => item.ExpiresAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        foreach (var session in sessions.Where(item => item.Status is ScanSessionStatus.Created or ScanSessionStatus.Captured))
            session.Status = ScanSessionStatus.Expired;
        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var session in sessions.Where(item => !string.IsNullOrWhiteSpace(item.StagedStorageKey)))
        {
            try
            {
                await fileStorage.DeleteAsync(session.StagedStorageKey!, cancellationToken);
                session.StagedStorageKey = null;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "No se pudo limpiar el objeto temporal principal de la sesión {ScanSessionId}. Se reintentará.", session.Id);
            }
        }

        foreach (var session in sessions.Where(item => item.Status is ScanSessionStatus.Completed or ScanSessionStatus.Cancelled or ScanSessionStatus.Failed or ScanSessionStatus.Expired))
        {
            foreach (var storageKey in session.Pages.Select(page => page.OriginalStorageKey).Where(key => !string.IsNullOrWhiteSpace(key)).Distinct())
            {
                try
                {
                    await fileStorage.DeleteAsync(storageKey, cancellationToken);
                    foreach (var page in session.Pages.Where(page => page.OriginalStorageKey == storageKey))
                        page.OriginalStorageKey = string.Empty;
                }
                catch (Exception exception)
                {
                    logger.LogWarning(exception, "No se pudo limpiar el objeto temporal {StorageKey} de la sesión {ScanSessionId}. Se reintentará.", storageKey, session.Id);
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
