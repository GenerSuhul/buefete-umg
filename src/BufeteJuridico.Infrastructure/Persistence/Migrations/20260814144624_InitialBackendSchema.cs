using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BufeteJuridico.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class InitialBackendSchema : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "bufete");

        migrationBuilder.CreateTable(
            name: "audit_logs",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<Guid>(type: "uuid", nullable: true),
                Username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                EntityType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                EntityId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                ChangesJson = table.Column<string>(type: "text", nullable: true),
                TraceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_audit_logs", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "case_presentations",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                MemorialId = table.Column<Guid>(type: "uuid", nullable: true),
                PresentedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Result = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                PresentedDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                ReceiptDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_case_presentations", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "clients",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ReceptionNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                NormalizedFullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                BirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                AgeAtReception = table.Column<int>(type: "integer", nullable: true),
                BirthPlace = table.Column<string>(type: "text", nullable: true),
                Nationality = table.Column<string>(type: "text", nullable: true),
                Sex = table.Column<string>(type: "text", nullable: true),
                MaritalStatus = table.Column<string>(type: "text", nullable: true),
                Dpi = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                ResidenceAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                Education = table.Column<string>(type: "text", nullable: true),
                Occupation = table.Column<string>(type: "text", nullable: true),
                Workplace = table.Column<string>(type: "text", nullable: true),
                WorkAddress = table.Column<string>(type: "text", nullable: true),
                WorkPhone = table.Column<string>(type: "text", nullable: true),
                Phone = table.Column<string>(type: "text", nullable: true),
                MobilePhone = table.Column<string>(type: "text", nullable: true),
                SalaryAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                SalaryFrequency = table.Column<string>(type: "text", nullable: true),
                ChildrenCount = table.Column<int>(type: "integer", nullable: false),
                AssistanceRequested = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                ReceptionPlace = table.Column<string>(type: "text", nullable: false),
                ReceptionDate = table.Column<DateOnly>(type: "date", nullable: false),
                SignatureDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_clients", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "court_notifications",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                NotifiedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Description = table.Column<string>(type: "text", nullable: false),
                DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                NewStage = table.Column<string>(type: "text", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_court_notifications", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "documents",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                Source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                ContextType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                ContextId = table.Column<Guid>(type: "uuid", nullable: false),
                Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                VersionNumber = table.Column<int>(type: "integer", nullable: false),
                PreviousVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                IsCurrent = table.Column<bool>(type: "boolean", nullable: false),
                DeletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                DeletedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_documents", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "permissions",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                Module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_permissions", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "process_types",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                Name = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_process_types", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "roles",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                NormalizedName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_roles", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "secretariat_activities",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ActivityType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                Description = table.Column<string>(type: "text", nullable: false),
                ClientId = table.Column<Guid>(type: "uuid", nullable: true),
                StudentId = table.Column<Guid>(type: "uuid", nullable: true),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: true),
                IsCorrected = table.Column<bool>(type: "boolean", nullable: false),
                CorrectionReason = table.Column<string>(type: "text", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_secretariat_activities", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "students",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                NormalizedFullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                BirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                AgeAtRegistration = table.Column<int>(type: "integer", nullable: true),
                StudentCardNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                Dpi = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                Semester = table.Column<int>(type: "integer", nullable: true),
                StudyShift = table.Column<string>(type: "text", nullable: true),
                Workplace = table.Column<string>(type: "text", nullable: true),
                WorkPhone = table.Column<string>(type: "text", nullable: true),
                ImmediateSupervisor = table.Column<string>(type: "text", nullable: true),
                JobTitle = table.Column<string>(type: "text", nullable: true),
                ResidenceAddress = table.Column<string>(type: "text", nullable: false),
                MobilePhone = table.Column<string>(type: "text", nullable: true),
                HomePhone = table.Column<string>(type: "text", nullable: true),
                Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                RegistrationDate = table.Column<DateOnly>(type: "date", nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_students", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "users",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                NormalizedUsername = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                NormalizedEmail = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                PasswordHash = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                ParticipationStartDate = table.Column<DateOnly>(type: "date", nullable: true),
                ParticipationEndDate = table.Column<DateOnly>(type: "date", nullable: true),
                PhotoDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                FailedLoginAttempts = table.Column<int>(type: "integer", nullable: false),
                LockoutEndUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                SecurityStamp = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_users", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "weekly_reports",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                PeriodEnd = table.Column<DateOnly>(type: "date", nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                PrintableHtml = table.Column<string>(type: "text", nullable: false),
                ReviewedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                SentAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                SentByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_weekly_reports", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "income_declarations",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                DeclaredAge = table.Column<int>(type: "integer", nullable: true),
                MaritalStatus = table.Column<string>(type: "text", nullable: true),
                Sex = table.Column<string>(type: "text", nullable: true),
                Dpi = table.Column<string>(type: "text", nullable: true),
                Occupation = table.Column<string>(type: "text", nullable: true),
                Nationality = table.Column<string>(type: "text", nullable: true),
                ResidenceAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                Phone = table.Column<string>(type: "text", nullable: true),
                MobilePhone = table.Column<string>(type: "text", nullable: true),
                Workplace = table.Column<string>(type: "text", nullable: true),
                WorkAddress = table.Column<string>(type: "text", nullable: true),
                SalaryAmount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                SalaryFrequency = table.Column<string>(type: "text", nullable: true),
                Place = table.Column<string>(type: "text", nullable: false),
                DeclarationDate = table.Column<DateOnly>(type: "date", nullable: false),
                DeclaresLimitedResources = table.Column<bool>(type: "boolean", nullable: false),
                GeneratedDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                SignedDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_income_declarations", x => x.Id);
                table.ForeignKey(
                    name: "FK_income_declarations_clients_ClientId",
                    column: x => x.ClientId,
                    principalSchema: "bufete",
                    principalTable: "clients",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "legal_cases",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CaseNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                ProcessTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                Stage = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                OpenedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ClosedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ClosureReason = table.Column<string>(type: "text", nullable: true),
                RetentionStartsAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_legal_cases", x => x.Id);
                table.ForeignKey(
                    name: "FK_legal_cases_clients_ClientId",
                    column: x => x.ClientId,
                    principalSchema: "bufete",
                    principalTable: "clients",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_legal_cases_process_types_ProcessTypeId",
                    column: x => x.ProcessTypeId,
                    principalSchema: "bufete",
                    principalTable: "process_types",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "requirement_definitions",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Scope = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                ProcessTypeId = table.Column<Guid>(type: "uuid", nullable: true),
                Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                Label = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                IsConditional = table.Column<bool>(type: "boolean", nullable: false),
                ConditionDescription = table.Column<string>(type: "text", nullable: true),
                DocumentNature = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                MaximumAgeDays = table.Column<int>(type: "integer", nullable: true),
                Subject = table.Column<string>(type: "text", nullable: true),
                Instructions = table.Column<string>(type: "text", nullable: true),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_requirement_definitions", x => x.Id);
                table.ForeignKey(
                    name: "FK_requirement_definitions_process_types_ProcessTypeId",
                    column: x => x.ProcessTypeId,
                    principalSchema: "bufete",
                    principalTable: "process_types",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "role_permissions",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                PermissionId = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_role_permissions", x => x.Id);
                table.ForeignKey(
                    name: "FK_role_permissions_permissions_PermissionId",
                    column: x => x.PermissionId,
                    principalSchema: "bufete",
                    principalTable: "permissions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_role_permissions_roles_RoleId",
                    column: x => x.RoleId,
                    principalSchema: "bufete",
                    principalTable: "roles",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "enrollment_applications",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                Modality = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                SiteName = table.Column<string>(type: "text", nullable: true),
                SiteAddress = table.Column<string>(type: "text", nullable: true),
                Shift = table.Column<string>(type: "text", nullable: true),
                PracticeDays = table.Column<string>(type: "text", nullable: true),
                StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                StartDate = table.Column<DateOnly>(type: "date", nullable: true),
                EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                SubmittedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                AdmittedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ResolvedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ResolutionNotes = table.Column<string>(type: "text", nullable: true),
                ResolutionDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                ClinicCardNumber = table.Column<string>(type: "text", nullable: true),
                ClinicCardIssuedDate = table.Column<DateOnly>(type: "date", nullable: true),
                ClinicCardExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                ClinicCardDeliveredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_enrollment_applications", x => x.Id);
                table.ForeignKey(
                    name: "FK_enrollment_applications_students_StudentId",
                    column: x => x.StudentId,
                    principalSchema: "bufete",
                    principalTable: "students",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "refresh_tokens",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<Guid>(type: "uuid", nullable: false),
                TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ExpiresAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RevokedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ReplacedByTokenHash = table.Column<string>(type: "text", nullable: true),
                CreatedByIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                RevokedByIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_refresh_tokens", x => x.Id);
                table.ForeignKey(
                    name: "FK_refresh_tokens_users_UserId",
                    column: x => x.UserId,
                    principalSchema: "bufete",
                    principalTable: "users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "user_roles",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<Guid>(type: "uuid", nullable: false),
                RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                AssignedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                AssignedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ValidFromUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ValidUntilUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_roles", x => x.Id);
                table.ForeignKey(
                    name: "FK_user_roles_roles_RoleId",
                    column: x => x.RoleId,
                    principalSchema: "bufete",
                    principalTable: "roles",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_user_roles_users_UserId",
                    column: x => x.UserId,
                    principalSchema: "bufete",
                    principalTable: "users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "email_deliveries",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                WeeklyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                Recipients = table.Column<string>(type: "text", nullable: false),
                Subject = table.Column<string>(type: "text", nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                AttemptedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ErrorMessage = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_email_deliveries", x => x.Id);
                table.ForeignKey(
                    name: "FK_email_deliveries_weekly_reports_WeeklyReportId",
                    column: x => x.WeeklyReportId,
                    principalSchema: "bufete",
                    principalTable: "weekly_reports",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "report_activities",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                WeeklyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                SecretariatActivityId = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_report_activities", x => x.Id);
                table.ForeignKey(
                    name: "FK_report_activities_weekly_reports_WeeklyReportId",
                    column: x => x.WeeklyReportId,
                    principalSchema: "bufete",
                    principalTable: "weekly_reports",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "case_assignments",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                AssignedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                EndedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                EndReason = table.Column<string>(type: "text", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_case_assignments", x => x.Id);
                table.ForeignKey(
                    name: "FK_case_assignments_legal_cases_LegalCaseId",
                    column: x => x.LegalCaseId,
                    principalSchema: "bufete",
                    principalTable: "legal_cases",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_case_assignments_students_StudentId",
                    column: x => x.StudentId,
                    principalSchema: "bufete",
                    principalTable: "students",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "case_requirements",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                RequirementDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                RequirementLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                IsConditional = table.Column<bool>(type: "boolean", nullable: false),
                DocumentNature = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                MaximumAgeDays = table.Column<int>(type: "integer", nullable: true),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                DataValue = table.Column<string>(type: "text", nullable: true),
                ConditionMet = table.Column<bool>(type: "boolean", nullable: true),
                DocumentIssueDate = table.Column<DateOnly>(type: "date", nullable: true),
                Notes = table.Column<string>(type: "text", nullable: true),
                ReviewedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_case_requirements", x => x.Id);
                table.ForeignKey(
                    name: "FK_case_requirements_legal_cases_LegalCaseId",
                    column: x => x.LegalCaseId,
                    principalSchema: "bufete",
                    principalTable: "legal_cases",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "counterparties",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                Dpi = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                ResidenceAddress = table.Column<string>(type: "text", nullable: true),
                WorkAddress = table.Column<string>(type: "text", nullable: true),
                Phone = table.Column<string>(type: "text", nullable: true),
                Notes = table.Column<string>(type: "text", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_counterparties", x => x.Id);
                table.ForeignKey(
                    name: "FK_counterparties_legal_cases_LegalCaseId",
                    column: x => x.LegalCaseId,
                    principalSchema: "bufete",
                    principalTable: "legal_cases",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "memorials",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_memorials", x => x.Id);
                table.ForeignKey(
                    name: "FK_memorials_legal_cases_LegalCaseId",
                    column: x => x.LegalCaseId,
                    principalSchema: "bufete",
                    principalTable: "legal_cases",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "timeline_entries",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                LegalCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                Description = table.Column<string>(type: "text", nullable: true),
                PerformedByStudentId = table.Column<Guid>(type: "uuid", nullable: true),
                DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_timeline_entries", x => x.Id);
                table.ForeignKey(
                    name: "FK_timeline_entries_legal_cases_LegalCaseId",
                    column: x => x.LegalCaseId,
                    principalSchema: "bufete",
                    principalTable: "legal_cases",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "student_requirements",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EnrollmentApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                RequirementDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                RequirementLabel = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                DataValue = table.Column<string>(type: "text", nullable: true),
                DocumentIssueDate = table.Column<DateOnly>(type: "date", nullable: true),
                Notes = table.Column<string>(type: "text", nullable: true),
                ReviewedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_student_requirements", x => x.Id);
                table.ForeignKey(
                    name: "FK_student_requirements_enrollment_applications_EnrollmentAppl~",
                    column: x => x.EnrollmentApplicationId,
                    principalSchema: "bufete",
                    principalTable: "enrollment_applications",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "memorial_versions",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                MemorialId = table.Column<Guid>(type: "uuid", nullable: false),
                VersionNumber = table.Column<int>(type: "integer", nullable: false),
                DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                SubmittedByStudentId = table.Column<Guid>(type: "uuid", nullable: true),
                Notes = table.Column<string>(type: "text", nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_memorial_versions", x => x.Id);
                table.ForeignKey(
                    name: "FK_memorial_versions_memorials_MemorialId",
                    column: x => x.MemorialId,
                    principalSchema: "bufete",
                    principalTable: "memorials",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "memorial_reviews",
            schema: "bufete",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                MemorialVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                Outcome = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                Observations = table.Column<string>(type: "text", nullable: false),
                ReviewedDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                ReviewedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ConcurrencyToken = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_memorial_reviews", x => x.Id);
                table.ForeignKey(
                    name: "FK_memorial_reviews_memorial_versions_MemorialVersionId",
                    column: x => x.MemorialVersionId,
                    principalSchema: "bufete",
                    principalTable: "memorial_versions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_audit_logs_EntityType_EntityId",
            schema: "bufete",
            table: "audit_logs",
            columns: new[] { "EntityType", "EntityId" });

        migrationBuilder.CreateIndex(
            name: "IX_audit_logs_OccurredAtUtc",
            schema: "bufete",
            table: "audit_logs",
            column: "OccurredAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_audit_logs_UserId",
            schema: "bufete",
            table: "audit_logs",
            column: "UserId");

        migrationBuilder.CreateIndex(
            name: "IX_case_assignments_LegalCaseId_StudentId_Status",
            schema: "bufete",
            table: "case_assignments",
            columns: new[] { "LegalCaseId", "StudentId", "Status" });

        migrationBuilder.CreateIndex(
            name: "IX_case_assignments_StudentId",
            schema: "bufete",
            table: "case_assignments",
            column: "StudentId");

        migrationBuilder.CreateIndex(
            name: "IX_case_presentations_LegalCaseId_PresentedAtUtc",
            schema: "bufete",
            table: "case_presentations",
            columns: new[] { "LegalCaseId", "PresentedAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_case_requirements_LegalCaseId_RequirementDefinitionId",
            schema: "bufete",
            table: "case_requirements",
            columns: new[] { "LegalCaseId", "RequirementDefinitionId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_clients_Dpi",
            schema: "bufete",
            table: "clients",
            column: "Dpi",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_clients_NormalizedFullName",
            schema: "bufete",
            table: "clients",
            column: "NormalizedFullName");

        migrationBuilder.CreateIndex(
            name: "IX_clients_ReceptionNumber",
            schema: "bufete",
            table: "clients",
            column: "ReceptionNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_counterparties_LegalCaseId",
            schema: "bufete",
            table: "counterparties",
            column: "LegalCaseId");

        migrationBuilder.CreateIndex(
            name: "IX_court_notifications_LegalCaseId_NotifiedAtUtc",
            schema: "bufete",
            table: "court_notifications",
            columns: new[] { "LegalCaseId", "NotifiedAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_documents_ContextType_ContextId_Label_IsCurrent",
            schema: "bufete",
            table: "documents",
            columns: new[] { "ContextType", "ContextId", "Label", "IsCurrent" });

        migrationBuilder.CreateIndex(
            name: "IX_documents_Sha256",
            schema: "bufete",
            table: "documents",
            column: "Sha256");

        migrationBuilder.CreateIndex(
            name: "IX_documents_StorageKey",
            schema: "bufete",
            table: "documents",
            column: "StorageKey",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_email_deliveries_WeeklyReportId",
            schema: "bufete",
            table: "email_deliveries",
            column: "WeeklyReportId");

        migrationBuilder.CreateIndex(
            name: "IX_enrollment_applications_StudentId",
            schema: "bufete",
            table: "enrollment_applications",
            column: "StudentId");

        migrationBuilder.CreateIndex(
            name: "IX_income_declarations_ClientId",
            schema: "bufete",
            table: "income_declarations",
            column: "ClientId");

        migrationBuilder.CreateIndex(
            name: "IX_legal_cases_CaseNumber",
            schema: "bufete",
            table: "legal_cases",
            column: "CaseNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_legal_cases_ClientId_Status",
            schema: "bufete",
            table: "legal_cases",
            columns: new[] { "ClientId", "Status" });

        migrationBuilder.CreateIndex(
            name: "IX_legal_cases_ProcessTypeId",
            schema: "bufete",
            table: "legal_cases",
            column: "ProcessTypeId");

        migrationBuilder.CreateIndex(
            name: "IX_memorial_reviews_MemorialVersionId",
            schema: "bufete",
            table: "memorial_reviews",
            column: "MemorialVersionId");

        migrationBuilder.CreateIndex(
            name: "IX_memorial_versions_MemorialId_VersionNumber",
            schema: "bufete",
            table: "memorial_versions",
            columns: new[] { "MemorialId", "VersionNumber" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_memorials_LegalCaseId",
            schema: "bufete",
            table: "memorials",
            column: "LegalCaseId");

        migrationBuilder.CreateIndex(
            name: "IX_permissions_Code",
            schema: "bufete",
            table: "permissions",
            column: "Code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_process_types_Code",
            schema: "bufete",
            table: "process_types",
            column: "Code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_process_types_Name",
            schema: "bufete",
            table: "process_types",
            column: "Name",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_refresh_tokens_TokenHash",
            schema: "bufete",
            table: "refresh_tokens",
            column: "TokenHash",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_refresh_tokens_UserId_ExpiresAtUtc",
            schema: "bufete",
            table: "refresh_tokens",
            columns: new[] { "UserId", "ExpiresAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_report_activities_WeeklyReportId_SecretariatActivityId",
            schema: "bufete",
            table: "report_activities",
            columns: new[] { "WeeklyReportId", "SecretariatActivityId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_requirement_definitions_ProcessTypeId",
            schema: "bufete",
            table: "requirement_definitions",
            column: "ProcessTypeId");

        migrationBuilder.CreateIndex(
            name: "IX_requirement_definitions_Scope_ProcessTypeId_Code",
            schema: "bufete",
            table: "requirement_definitions",
            columns: new[] { "Scope", "ProcessTypeId", "Code" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_role_permissions_PermissionId",
            schema: "bufete",
            table: "role_permissions",
            column: "PermissionId");

        migrationBuilder.CreateIndex(
            name: "IX_role_permissions_RoleId_PermissionId",
            schema: "bufete",
            table: "role_permissions",
            columns: new[] { "RoleId", "PermissionId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_roles_NormalizedName",
            schema: "bufete",
            table: "roles",
            column: "NormalizedName",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_secretariat_activities_CreatedByUserId",
            schema: "bufete",
            table: "secretariat_activities",
            column: "CreatedByUserId");

        migrationBuilder.CreateIndex(
            name: "IX_secretariat_activities_OccurredAtUtc",
            schema: "bufete",
            table: "secretariat_activities",
            column: "OccurredAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_student_requirements_EnrollmentApplicationId_RequirementDef~",
            schema: "bufete",
            table: "student_requirements",
            columns: new[] { "EnrollmentApplicationId", "RequirementDefinitionId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_students_Dpi",
            schema: "bufete",
            table: "students",
            column: "Dpi",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_students_Email",
            schema: "bufete",
            table: "students",
            column: "Email",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_students_NormalizedFullName",
            schema: "bufete",
            table: "students",
            column: "NormalizedFullName");

        migrationBuilder.CreateIndex(
            name: "IX_students_StudentCardNumber",
            schema: "bufete",
            table: "students",
            column: "StudentCardNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_students_UserAccountId",
            schema: "bufete",
            table: "students",
            column: "UserAccountId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_timeline_entries_LegalCaseId_OccurredAtUtc",
            schema: "bufete",
            table: "timeline_entries",
            columns: new[] { "LegalCaseId", "OccurredAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_user_roles_RoleId",
            schema: "bufete",
            table: "user_roles",
            column: "RoleId");

        migrationBuilder.CreateIndex(
            name: "IX_user_roles_UserId_RoleId",
            schema: "bufete",
            table: "user_roles",
            columns: new[] { "UserId", "RoleId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_users_NormalizedEmail",
            schema: "bufete",
            table: "users",
            column: "NormalizedEmail",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_users_NormalizedUsername",
            schema: "bufete",
            table: "users",
            column: "NormalizedUsername",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_weekly_reports_PeriodStart_PeriodEnd",
            schema: "bufete",
            table: "weekly_reports",
            columns: new[] { "PeriodStart", "PeriodEnd" },
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "audit_logs",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "case_assignments",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "case_presentations",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "case_requirements",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "counterparties",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "court_notifications",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "documents",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "email_deliveries",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "income_declarations",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "memorial_reviews",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "refresh_tokens",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "report_activities",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "requirement_definitions",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "role_permissions",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "secretariat_activities",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "student_requirements",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "timeline_entries",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "user_roles",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "memorial_versions",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "weekly_reports",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "permissions",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "enrollment_applications",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "roles",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "users",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "memorials",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "students",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "legal_cases",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "clients",
            schema: "bufete");

        migrationBuilder.DropTable(
            name: "process_types",
            schema: "bufete");
    }
}
