using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddAuditAndRetentionIndexes : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateIndex(
            name: "IX_legal_cases_Status_RetentionStartsAtUtc",
            schema: "bufete",
            table: "legal_cases",
            columns: new[] { "Status", "RetentionStartsAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_audit_logs_UserId_OccurredAtUtc",
            schema: "bufete",
            table: "audit_logs",
            columns: new[] { "UserId", "OccurredAtUtc" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_legal_cases_Status_RetentionStartsAtUtc",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropIndex(
            name: "IX_audit_logs_UserId_OccurredAtUtc",
            schema: "bufete",
            table: "audit_logs");
    }
}
