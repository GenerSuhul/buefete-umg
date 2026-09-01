using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

[DbContext(typeof(BufeteDbContext))]
[Migration("20260901153000_AddChangeNameRequirements")]
public partial class AddChangeNameRequirements : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE bufete.process_types
            SET "Description" = 'Requisitos básicos de identificación y respaldo.'
            WHERE "Code" = 'CAMBIO_NOMBRE';

            INSERT INTO bufete.requirement_definitions
                ("Id", "Scope", "ProcessTypeId", "Code", "Label", "Kind", "IsRequired",
                 "IsConditional", "DocumentNature", "Subject", "SortOrder", "IsActive",
                 "CreatedAtUtc", "ConcurrencyToken")
            SELECT 'ca4b1000-0000-4000-8000-000000000001'::uuid, 'Process', process."Id",
                   'DPI_SOLICITANTE', 'Copia del DPI del solicitante', 'Document', TRUE,
                   FALSE, 'Copy', 'Solicitante', 1, TRUE, CURRENT_TIMESTAMP, gen_random_uuid()
            FROM bufete.process_types AS process
            WHERE process."Code" = 'CAMBIO_NOMBRE'
              AND NOT EXISTS (
                  SELECT 1 FROM bufete.requirement_definitions AS definition
                  WHERE definition."Scope" = 'Process'
                    AND definition."ProcessTypeId" = process."Id"
                    AND definition."Code" = 'DPI_SOLICITANTE');

            INSERT INTO bufete.requirement_definitions
                ("Id", "Scope", "ProcessTypeId", "Code", "Label", "Kind", "IsRequired",
                 "IsConditional", "DocumentNature", "Subject", "SortOrder", "IsActive",
                 "CreatedAtUtc", "ConcurrencyToken")
            SELECT 'ca4b1000-0000-4000-8000-000000000002'::uuid, 'Process', process."Id",
                   'CERTIFICACION_NACIMIENTO', 'Certificación de nacimiento', 'Document', TRUE,
                   FALSE, 'Original', 'Solicitante', 2, TRUE, CURRENT_TIMESTAMP, gen_random_uuid()
            FROM bufete.process_types AS process
            WHERE process."Code" = 'CAMBIO_NOMBRE'
              AND NOT EXISTS (
                  SELECT 1 FROM bufete.requirement_definitions AS definition
                  WHERE definition."Scope" = 'Process'
                    AND definition."ProcessTypeId" = process."Id"
                    AND definition."Code" = 'CERTIFICACION_NACIMIENTO');

            INSERT INTO bufete.case_requirements
                ("Id", "LegalCaseId", "RequirementDefinitionId", "RequirementLabel", "Kind",
                 "IsRequired", "IsConditional", "DocumentNature", "Status", "CreatedAtUtc",
                 "ConcurrencyToken")
            SELECT gen_random_uuid(), legal_case."Id", definition."Id", definition."Label",
                   definition."Kind", definition."IsRequired", definition."IsConditional",
                   definition."DocumentNature", 'Pending', CURRENT_TIMESTAMP, gen_random_uuid()
            FROM bufete.legal_cases AS legal_case
            JOIN bufete.process_types AS process ON process."Id" = legal_case."ProcessTypeId"
            JOIN bufete.requirement_definitions AS definition ON definition."ProcessTypeId" = process."Id"
            WHERE process."Code" = 'CAMBIO_NOMBRE'
              AND definition."Code" IN ('DPI_SOLICITANTE', 'CERTIFICACION_NACIMIENTO')
              AND NOT EXISTS (
                  SELECT 1 FROM bufete.case_requirements AS requirement
                  WHERE requirement."LegalCaseId" = legal_case."Id"
                    AND requirement."RequirementDefinitionId" = definition."Id");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM bufete.case_requirements
            WHERE "RequirementDefinitionId" IN (
                'ca4b1000-0000-4000-8000-000000000001'::uuid,
                'ca4b1000-0000-4000-8000-000000000002'::uuid);

            DELETE FROM bufete.requirement_definitions
            WHERE "Id" IN (
                'ca4b1000-0000-4000-8000-000000000001'::uuid,
                'ca4b1000-0000-4000-8000-000000000002'::uuid);

            UPDATE bufete.process_types
            SET "Description" = 'Tipo confirmado; requisitos pendientes de entrega.'
            WHERE "Code" = 'CAMBIO_NOMBRE';
            """);
    }
}
