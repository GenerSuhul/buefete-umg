using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BufeteJuridico.Infrastructure.Persistence;

public sealed class BufeteDbContextFactory : IDesignTimeDbContextFactory<BufeteDbContext>
{
    public BufeteDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__BufeteDb");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings__BufeteDb no está configurada. Ejecute el comando mediante scripts/database-update.ps1.");
        }

        var options = new DbContextOptionsBuilder<BufeteDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new BufeteDbContext(options, new SystemCurrentUser(), TimeProvider.System);
    }
}
