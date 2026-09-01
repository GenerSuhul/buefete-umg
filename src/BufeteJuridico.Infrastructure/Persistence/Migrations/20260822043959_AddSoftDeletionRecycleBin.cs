using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddSoftDeletionRecycleBin : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "DeletedAtUtc",
            schema: "bufete",
            table: "students",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletedByUserId",
            schema: "bufete",
            table: "students",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "students",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "DeletionReason",
            schema: "bufete",
            table: "students",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "DeletedAtUtc",
            schema: "bufete",
            table: "legal_cases",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletedByUserId",
            schema: "bufete",
            table: "legal_cases",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "legal_cases",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "DeletionReason",
            schema: "bufete",
            table: "legal_cases",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "documents",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "DeletedAtUtc",
            schema: "bufete",
            table: "clients",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletedByUserId",
            schema: "bufete",
            table: "clients",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "clients",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "DeletionReason",
            schema: "bufete",
            table: "clients",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_students_DeletedAtUtc",
            schema: "bufete",
            table: "students",
            column: "DeletedAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_legal_cases_DeletedAtUtc",
            schema: "bufete",
            table: "legal_cases",
            column: "DeletedAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_documents_DeletionBatchId",
            schema: "bufete",
            table: "documents",
            column: "DeletionBatchId");

        migrationBuilder.CreateIndex(
            name: "IX_clients_DeletedAtUtc",
            schema: "bufete",
            table: "clients",
            column: "DeletedAtUtc");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_students_DeletedAtUtc",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropIndex(
            name: "IX_legal_cases_DeletedAtUtc",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropIndex(
            name: "IX_documents_DeletionBatchId",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropIndex(
            name: "IX_clients_DeletedAtUtc",
            schema: "bufete",
            table: "clients");

        migrationBuilder.DropColumn(
            name: "DeletedAtUtc",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropColumn(
            name: "DeletedByUserId",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropColumn(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropColumn(
            name: "DeletionReason",
            schema: "bufete",
            table: "students");

        migrationBuilder.DropColumn(
            name: "DeletedAtUtc",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropColumn(
            name: "DeletedByUserId",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropColumn(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropColumn(
            name: "DeletionReason",
            schema: "bufete",
            table: "legal_cases");

        migrationBuilder.DropColumn(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "DeletedAtUtc",
            schema: "bufete",
            table: "clients");

        migrationBuilder.DropColumn(
            name: "DeletedByUserId",
            schema: "bufete",
            table: "clients");

        migrationBuilder.DropColumn(
            name: "DeletionBatchId",
            schema: "bufete",
            table: "clients");

        migrationBuilder.DropColumn(
            name: "DeletionReason",
            schema: "bufete",
            table: "clients");
    }
}
