using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddTrigramSearchIndexes : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_students_NormalizedFullName",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropIndex(
            name: "IX_clients_NormalizedFullName",
            schema: "bufete",
            table: "clients");

        migrationBuilder.AlterDatabase()
            .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

        migrationBuilder.CreateIndex(
            name: "IX_students_NormalizedFullName",
            schema: "bufete",
            table: "students",
            column: "NormalizedFullName",
            filter: "\"DeletedAtUtc\" IS NULL")
            .Annotation("Npgsql:IndexMethod", "gin")
            .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

        migrationBuilder.CreateIndex(
            name: "IX_clients_NormalizedFullName",
            schema: "bufete",
            table: "clients",
            column: "NormalizedFullName",
            filter: "\"DeletedAtUtc\" IS NULL")
            .Annotation("Npgsql:IndexMethod", "gin")
            .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_students_NormalizedFullName",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropIndex(
            name: "IX_clients_NormalizedFullName",
            schema: "bufete",
            table: "clients");

        migrationBuilder.AlterDatabase()
            .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,");

        migrationBuilder.CreateIndex(
            name: "IX_students_NormalizedFullName",
            schema: "bufete",
            table: "students",
            column: "NormalizedFullName");

        migrationBuilder.CreateIndex(
            name: "IX_clients_NormalizedFullName",
            schema: "bufete",
            table: "clients",
            column: "NormalizedFullName");
    }
}
