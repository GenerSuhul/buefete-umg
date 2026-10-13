using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class GlobalClientRestrictions : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "client_restrictions",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Dpi = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                SourceTenantCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                IssuedByName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_client_restrictions", x => x.Id);
                table.CheckConstraint("CK_client_restrictions_dpi", "\"Dpi\" ~ '^[0-9]{13}$'");
            });

        migrationBuilder.CreateIndex(
            name: "IX_client_restrictions_Dpi",
            schema: "bufete",
            table: "client_restrictions",
            column: "Dpi",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "client_restrictions",
            schema: "bufete");
    }
}
