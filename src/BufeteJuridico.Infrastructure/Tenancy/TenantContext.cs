using Microsoft.Extensions.Configuration;
using Npgsql;

namespace BufeteJuridico.Infrastructure.Tenancy;

public sealed class TenantContext(IConfiguration configuration)
{
    public string Code { get; private set; } = "peten";
    public string Name { get; private set; } = "Petén";
    public string ConnectionString { get; private set; } = configuration.GetConnectionString("BufeteDb")!;

    public void Select(string code, string name, string databaseName)
    {
        Code = code;
        Name = name;
        ConnectionString = new NpgsqlConnectionStringBuilder(configuration.GetConnectionString("BufeteDb"))
        { Database = databaseName }.ConnectionString;
    }
}
