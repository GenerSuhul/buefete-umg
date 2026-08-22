using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddScanSessions : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "scan_sessions",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                ContextType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                ContextId = table.Column<Guid>(type: "uuid", nullable: false),
                Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                ReplaceDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                AcquisitionProvider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                DeviceId = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                DeviceName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                ResolutionDpi = table.Column<int>(type: "integer", nullable: true),
                ColorMode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                Duplex = table.Column<bool>(type: "boolean", nullable: true),
                ExpiresAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CapturedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                StagedStorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                StagedFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                StagedContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                StagedSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                StagedSha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                PageCount = table.Column<int>(type: "integer", nullable: true),
                DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CancelledAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                FailureCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                FailureMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_scan_sessions", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_scan_sessions_CreatedByUserId_Status_ExpiresAtUtc",
            schema: "bufete",
            table: "scan_sessions",
            columns: new[] { "CreatedByUserId", "Status", "ExpiresAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_scan_sessions_DocumentId",
            schema: "bufete",
            table: "scan_sessions",
            column: "DocumentId",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "scan_sessions",
            schema: "bufete");
    }
}
