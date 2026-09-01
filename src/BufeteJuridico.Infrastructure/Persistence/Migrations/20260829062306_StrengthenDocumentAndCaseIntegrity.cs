using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class StrengthenDocumentAndCaseIntegrity : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "MemorialVersionId",
            schema: "bufete",
            table: "case_presentations",
            type: "uuid",
            nullable: true);

        migrationBuilder.Sql(
            """
                UPDATE bufete.case_presentations AS presentation
                SET "MemorialVersionId" = (
                    SELECT version."Id"
                    FROM bufete.memorial_versions AS version
                    WHERE version."MemorialId" = presentation."MemorialId"
                    ORDER BY version."VersionNumber" DESC
                    LIMIT 1
                );

                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM bufete.case_presentations WHERE "MemorialVersionId" IS NULL) THEN
                        RAISE EXCEPTION 'No se puede vincular una presentación existente con una versión de memorial.';
                    END IF;
                END $$;
                """);

        migrationBuilder.AlterColumn<Guid>(
            name: "MemorialVersionId",
            schema: "bufete",
            table: "case_presentations",
            type: "uuid",
            nullable: false,
            oldClrType: typeof(Guid),
            oldType: "uuid",
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_report_activities_SecretariatActivityId",
            schema: "bufete",
            table: "report_activities",
            column: "SecretariatActivityId");

        migrationBuilder.CreateIndex(
            name: "IX_documents_ContextType_ContextId_Label",
            schema: "bufete",
            table: "documents",
            columns: new[] { "ContextType", "ContextId", "Label" },
            unique: true,
            filter: "\"IsCurrent\" = TRUE AND \"DeletedAtUtc\" IS NULL AND \"ContextType\" = 'CaseRequirement'");

        migrationBuilder.CreateIndex(
            name: "IX_documents_PreviousVersionId",
            schema: "bufete",
            table: "documents",
            column: "PreviousVersionId");

        migrationBuilder.CreateIndex(
            name: "IX_case_presentations_MemorialId",
            schema: "bufete",
            table: "case_presentations",
            column: "MemorialId");

        migrationBuilder.CreateIndex(
            name: "IX_case_presentations_MemorialVersionId",
            schema: "bufete",
            table: "case_presentations",
            column: "MemorialVersionId");

        migrationBuilder.AddForeignKey(
            name: "FK_case_presentations_legal_cases_LegalCaseId",
            schema: "bufete",
            table: "case_presentations",
            column: "LegalCaseId",
            principalSchema: "bufete",
            principalTable: "legal_cases",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_case_presentations_memorial_versions_MemorialVersionId",
            schema: "bufete",
            table: "case_presentations",
            column: "MemorialVersionId",
            principalSchema: "bufete",
            principalTable: "memorial_versions",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_case_presentations_memorials_MemorialId",
            schema: "bufete",
            table: "case_presentations",
            column: "MemorialId",
            principalSchema: "bufete",
            principalTable: "memorials",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_court_notifications_legal_cases_LegalCaseId",
            schema: "bufete",
            table: "court_notifications",
            column: "LegalCaseId",
            principalSchema: "bufete",
            principalTable: "legal_cases",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_documents_documents_PreviousVersionId",
            schema: "bufete",
            table: "documents",
            column: "PreviousVersionId",
            principalSchema: "bufete",
            principalTable: "documents",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_report_activities_secretariat_activities_SecretariatActivit~",
            schema: "bufete",
            table: "report_activities",
            column: "SecretariatActivityId",
            principalSchema: "bufete",
            principalTable: "secretariat_activities",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_students_users_UserAccountId",
            schema: "bufete",
            table: "students",
            column: "UserAccountId",
            principalSchema: "bufete",
            principalTable: "users",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_case_presentations_legal_cases_LegalCaseId",
            schema: "bufete",
            table: "case_presentations");

        migrationBuilder.DropForeignKey(
            name: "FK_case_presentations_memorial_versions_MemorialVersionId",
            schema: "bufete",
            table: "case_presentations");

        migrationBuilder.DropForeignKey(
            name: "FK_case_presentations_memorials_MemorialId",
            schema: "bufete",
            table: "case_presentations");

        migrationBuilder.DropForeignKey(
            name: "FK_court_notifications_legal_cases_LegalCaseId",
            schema: "bufete",
            table: "court_notifications");

        migrationBuilder.DropForeignKey(
            name: "FK_documents_documents_PreviousVersionId",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropForeignKey(
            name: "FK_report_activities_secretariat_activities_SecretariatActivit~",
            schema: "bufete",
            table: "report_activities");

        migrationBuilder.DropForeignKey(
            name: "FK_students_users_UserAccountId",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropIndex(
            name: "IX_report_activities_SecretariatActivityId",
            schema: "bufete",
            table: "report_activities");

        migrationBuilder.DropIndex(
            name: "IX_documents_ContextType_ContextId_Label",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropIndex(
            name: "IX_documents_PreviousVersionId",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropIndex(
            name: "IX_case_presentations_MemorialId",
            schema: "bufete",
            table: "case_presentations");

        migrationBuilder.DropIndex(
            name: "IX_case_presentations_MemorialVersionId",
            schema: "bufete",
            table: "case_presentations");

        migrationBuilder.DropColumn(
            name: "MemorialVersionId",
            schema: "bufete",
            table: "case_presentations");
    }
}
