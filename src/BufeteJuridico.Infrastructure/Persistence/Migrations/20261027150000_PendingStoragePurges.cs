using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

[DbContext(typeof(BufeteDbContext))]
[Migration("20261027150000_PendingStoragePurges")]
public sealed class PendingStoragePurges : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE bufete.pending_storage_purges (
                "StorageKey" text PRIMARY KEY,
                "EnqueuedAtUtc" timestamptz NOT NULL,
                "AttemptCount" integer NOT NULL DEFAULT 0
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("DROP TABLE bufete.pending_storage_purges;");
}
