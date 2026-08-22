using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddDashboardQueryIndexes : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateIndex(
            name: "IX_timeline_entries_OccurredAtUtc_LegalCaseId",
            schema: "bufete",
            table: "timeline_entries",
            columns: new[] { "OccurredAtUtc", "LegalCaseId" });

        migrationBuilder.CreateIndex(
            name: "IX_legal_cases_Status_ProcessTypeId",
            schema: "bufete",
            table: "legal_cases",
            columns: new[] { "Status", "ProcessTypeId" });

        migrationBuilder.CreateIndex(
            name: "IX_case_assignments_Status_StudentId_LegalCaseId",
            schema: "bufete",
            table: "case_assignments",
            columns: new[] { "Status", "StudentId", "LegalCaseId" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_timeline_entries_OccurredAtUtc_LegalCaseId",
            schema: "bufete",
            table: "timeline_entries");

        migrationBuilder.DropIndex(
            name: "IX_legal_cases_Status_ProcessTypeId",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropIndex(
            name: "IX_case_assignments_Status_StudentId_LegalCaseId",
            schema: "bufete",
            table: "case_assignments");
    }
}
