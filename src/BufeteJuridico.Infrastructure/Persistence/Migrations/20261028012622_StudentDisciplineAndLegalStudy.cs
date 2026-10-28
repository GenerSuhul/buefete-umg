using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;
    /// <inheritdoc />
    public partial class StudentDisciplineAndLegalStudy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "student_disciplines",
                schema: "bufete",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Dpi = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceTenantCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IssuedByName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RevokedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevokedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RevocationReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_disciplines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "student_legal_reviews",
                schema: "bufete",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ReviewDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Observations = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SignedDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_legal_reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_legal_reviews_students_StudentId",
                        column: x => x.StudentId,
                        principalSchema: "bufete",
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "student_practice_closures",
                schema: "bufete",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeliveryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    FinalDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_practice_closures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_practice_closures_students_StudentId",
                        column: x => x.StudentId,
                        principalSchema: "bufete",
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_student_disciplines_CreatedAtUtc",
                schema: "bufete",
                table: "student_disciplines",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_student_disciplines_Dpi_RevokedAtUtc",
                schema: "bufete",
                table: "student_disciplines",
                columns: new[] { "Dpi", "RevokedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_student_legal_reviews_StudentId_ReviewDate",
                schema: "bufete",
                table: "student_legal_reviews",
                columns: new[] { "StudentId", "ReviewDate" });

            migrationBuilder.CreateIndex(
                name: "IX_student_practice_closures_DeliveryDate",
                schema: "bufete",
                table: "student_practice_closures",
                column: "DeliveryDate");

            migrationBuilder.CreateIndex(
                name: "IX_student_practice_closures_StudentId",
                schema: "bufete",
                table: "student_practice_closures",
                column: "StudentId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "student_disciplines",
                schema: "bufete");

            migrationBuilder.DropTable(
                name: "student_legal_reviews",
                schema: "bufete");

            migrationBuilder.DropTable(
                name: "student_practice_closures",
                schema: "bufete");
        }
    }
