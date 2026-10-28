using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;
    /// <inheritdoc />
    public partial class OptionalStudentEmailIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_students_Email",
                schema: "bufete",
                table: "students");

            migrationBuilder.CreateIndex(
                name: "IX_students_Email",
                schema: "bufete",
                table: "students",
                column: "Email",
                unique: true,
                filter: "\"Email\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_students_Email",
                schema: "bufete",
                table: "students");

            migrationBuilder.CreateIndex(
                name: "IX_students_Email",
                schema: "bufete",
                table: "students",
                column: "Email",
                unique: true);
        }
    }
