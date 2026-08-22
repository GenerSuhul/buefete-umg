using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddIntakeAndMultipageScanning : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "LastSavedAtUtc",
            schema: "bufete",
            table: "scan_sessions",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "PageCount",
            schema: "bufete",
            table: "documents",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ClaimedAgainstPersonAddress",
            schema: "bufete",
            table: "clients",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ClaimedAgainstPersonName",
            schema: "bufete",
            table: "clients",
            type: "character varying(200)",
            maxLength: 200,
            nullable: true);

        migrationBuilder.CreateTable(
            name: "scan_pages",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ScanSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                ClientPageId = table.Column<Guid>(type: "uuid", nullable: false),
                Position = table.Column<int>(type: "integer", nullable: false),
                Source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                OriginalStorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                SourcePageNumber = table.Column<int>(type: "integer", nullable: true),
                WidthPixels = table.Column<int>(type: "integer", nullable: true),
                HeightPixels = table.Column<int>(type: "integer", nullable: true),
                RotationDegrees = table.Column<int>(type: "integer", nullable: false),
                RemovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                RemovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_scan_pages", x => x.Id);
                table.ForeignKey(
                    name: "FK_scan_pages_scan_sessions_ScanSessionId",
                    column: x => x.ScanSessionId,
                    principalSchema: "bufete",
                    principalTable: "scan_sessions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_documents_PageCount",
            schema: "bufete",
            table: "documents",
            column: "PageCount");

        migrationBuilder.CreateIndex(
            name: "IX_scan_pages_ScanSessionId_ClientPageId",
            schema: "bufete",
            table: "scan_pages",
            columns: new[] { "ScanSessionId", "ClientPageId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_scan_pages_ScanSessionId_Status_Position",
            schema: "bufete",
            table: "scan_pages",
            columns: new[] { "ScanSessionId", "Status", "Position" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "scan_pages",
            schema: "bufete");

        migrationBuilder.DropIndex(
            name: "IX_documents_PageCount",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "LastSavedAtUtc",
            schema: "bufete",
            table: "scan_sessions");

        migrationBuilder.DropColumn(
            name: "PageCount",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "ClaimedAgainstPersonAddress",
            schema: "bufete",
            table: "clients");

        migrationBuilder.DropColumn(
            name: "ClaimedAgainstPersonName",
            schema: "bufete",
            table: "clients");
    }
}
