using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class PreserveStudentAccountStateOnRestore : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "UserAccountWasActiveAtDeletion",
            schema: "bufete",
            table: "students",
            type: "boolean",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "UserAccountWasActiveAtDeletion",
            schema: "bufete",
            table: "students");
    }
}
