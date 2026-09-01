using BufeteJuridico.Domain.Activities;
using BufeteJuridico.Domain.Auditing;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Clients;
using BufeteJuridico.Domain.Common;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Domain.Reports;
using BufeteJuridico.Domain.Students;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Persistence;

internal static class ModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pg_trgm");
        ConfigureIdentity(modelBuilder);
        ConfigureDocuments(modelBuilder);
        ConfigureClients(modelBuilder);
        ConfigureStudents(modelBuilder);
        ConfigureCatalogs(modelBuilder);
        ConfigureCases(modelBuilder);
        ConfigureOperations(modelBuilder);
        ConfigureAudit(modelBuilder);

        modelBuilder.Entity<Client>().HasQueryFilter(item => item.DeletedAtUtc == null);
        modelBuilder.Entity<Student>().HasQueryFilter(item => item.DeletedAtUtc == null);
        modelBuilder.Entity<LegalCase>().HasQueryFilter(item => item.DeletedAtUtc == null);
        modelBuilder.Entity<IncomeDeclaration>().HasQueryFilter(item => item.Client.DeletedAtUtc == null);
        modelBuilder.Entity<EnrollmentApplication>().HasQueryFilter(item => item.Student.DeletedAtUtc == null);
        modelBuilder.Entity<StudentRequirement>().HasQueryFilter(item => item.EnrollmentApplication.Student.DeletedAtUtc == null);
        modelBuilder.Entity<CaseRequirement>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<CaseAssignment>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null && item.Student.DeletedAtUtc == null);
        modelBuilder.Entity<Counterparty>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<TimelineEntry>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<Memorial>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<MemorialVersion>().HasQueryFilter(item => item.Memorial.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<MemorialReview>().HasQueryFilter(item => item.MemorialVersion.Memorial.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<CasePresentation>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null);
        modelBuilder.Entity<CourtNotification>().HasQueryFilter(item => item.LegalCase.DeletedAtUtc == null);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(AuditableEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .Property(nameof(AuditableEntity.ConcurrencyToken))
                    .IsConcurrencyToken();
            }
        }
    }

    private static void ConfigureIdentity(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserAccount>(entity =>
        {
            entity.ToTable("users");
            entity.Property(item => item.Username).HasMaxLength(80);
            entity.Property(item => item.NormalizedUsername).HasMaxLength(80);
            entity.Property(item => item.Email).HasMaxLength(254);
            entity.Property(item => item.NormalizedEmail).HasMaxLength(254);
            entity.Property(item => item.FullName).HasMaxLength(200);
            entity.Property(item => item.PasswordHash).HasMaxLength(1000);
            entity.HasIndex(item => item.NormalizedUsername).IsUnique();
            entity.HasIndex(item => item.NormalizedEmail).IsUnique();
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.Property(item => item.Name).HasMaxLength(80);
            entity.Property(item => item.NormalizedName).HasMaxLength(80);
            entity.Property(item => item.Description).HasMaxLength(300);
            entity.HasIndex(item => item.NormalizedName).IsUnique();
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("permissions");
            entity.Property(item => item.Code).HasMaxLength(120);
            entity.Property(item => item.Module).HasMaxLength(80);
            entity.Property(item => item.Description).HasMaxLength(300);
            entity.HasIndex(item => item.Code).IsUnique();
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("user_roles");
            entity.HasIndex(item => new { item.UserId, item.RoleId }).IsUnique();
            entity.HasOne(item => item.User).WithMany(item => item.Roles).HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Role).WithMany(item => item.Users).HasForeignKey(item => item.RoleId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("role_permissions");
            entity.HasIndex(item => new { item.RoleId, item.PermissionId }).IsUnique();
            entity.HasOne(item => item.Role).WithMany(item => item.Permissions).HasForeignKey(item => item.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Permission).WithMany(item => item.Roles).HasForeignKey(item => item.PermissionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.Property(item => item.TokenHash).HasMaxLength(128);
            entity.Property(item => item.CreatedByIp).HasMaxLength(64);
            entity.Property(item => item.RevokedByIp).HasMaxLength(64);
            entity.HasIndex(item => item.TokenHash).IsUnique();
            entity.HasIndex(item => new { item.UserId, item.ExpiresAtUtc });
            entity.HasOne(item => item.User).WithMany(item => item.RefreshTokens).HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureDocuments(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DocumentRecord>(entity =>
        {
            entity.ToTable("documents");
            entity.Property(item => item.StorageKey).HasMaxLength(500);
            entity.Property(item => item.OriginalFileName).HasMaxLength(255);
            entity.Property(item => item.ContentType).HasMaxLength(120);
            entity.Property(item => item.Sha256).HasMaxLength(64);
            entity.Property(item => item.Label).HasMaxLength(200);
            entity.Property(item => item.Source).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.ContextType).HasConversion<string>().HasMaxLength(50);
            entity.HasIndex(item => item.StorageKey).IsUnique();
            entity.HasIndex(item => new { item.ContextType, item.ContextId, item.Label, item.IsCurrent });
            entity.HasIndex(item => new { item.ContextType, item.ContextId, item.Label })
                .IsUnique()
                .HasFilter("\"IsCurrent\" = TRUE AND \"DeletedAtUtc\" IS NULL AND \"ContextType\" = 'CaseRequirement'");
            entity.HasIndex(item => item.Sha256);
            entity.HasIndex(item => item.PageCount);
            entity.HasIndex(item => item.DeletionBatchId);
            entity.HasOne<DocumentRecord>().WithMany().HasForeignKey(item => item.PreviousVersionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ScanSession>(entity =>
        {
            entity.ToTable("scan_sessions");
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.ContextType).HasConversion<string>().HasMaxLength(50);
            entity.Property(item => item.Label).HasMaxLength(200);
            entity.Property(item => item.AcquisitionProvider).HasMaxLength(50);
            entity.Property(item => item.DeviceId).HasMaxLength(250);
            entity.Property(item => item.DeviceName).HasMaxLength(250);
            entity.Property(item => item.ColorMode).HasMaxLength(40);
            entity.Property(item => item.StagedStorageKey).HasMaxLength(500);
            entity.Property(item => item.StagedFileName).HasMaxLength(255);
            entity.Property(item => item.StagedContentType).HasMaxLength(120);
            entity.Property(item => item.StagedSha256).HasMaxLength(64);
            entity.Property(item => item.FailureCode).HasMaxLength(80);
            entity.Property(item => item.FailureMessage).HasMaxLength(1000);
            entity.HasIndex(item => new { item.CreatedByUserId, item.Status, item.ExpiresAtUtc });
            entity.HasIndex(item => item.DocumentId).IsUnique();
            entity.HasMany(item => item.Pages).WithOne(item => item.ScanSession).HasForeignKey(item => item.ScanSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ScanPage>(entity =>
        {
            entity.ToTable("scan_pages");
            entity.Property(item => item.Source).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.OriginalStorageKey).HasMaxLength(500);
            entity.Property(item => item.OriginalFileName).HasMaxLength(255);
            entity.Property(item => item.ContentType).HasMaxLength(120);
            entity.Property(item => item.Sha256).HasMaxLength(64);
            entity.HasIndex(item => new { item.ScanSessionId, item.ClientPageId }).IsUnique();
            entity.HasIndex(item => new { item.ScanSessionId, item.Status, item.Position });
        });
    }

    private static void ConfigureClients(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Client>(entity =>
        {
            entity.ToTable("clients");
            entity.Property(item => item.ReceptionNumber).HasMaxLength(40);
            entity.Property(item => item.FullName).HasMaxLength(200);
            entity.Property(item => item.NormalizedFullName).HasMaxLength(200);
            entity.Property(item => item.Dpi).HasMaxLength(30);
            entity.Property(item => item.ResidenceAddress).HasMaxLength(500);
            entity.Property(item => item.AssistanceRequested).HasMaxLength(1000);
            entity.Property(item => item.ClaimedAgainstPersonName).HasMaxLength(200);
            entity.Property(item => item.ClaimedAgainstPersonAddress).HasMaxLength(500);
            entity.Property(item => item.SalaryAmount).HasPrecision(14, 2);
            entity.Property(item => item.DeletionReason).HasMaxLength(500);
            entity.HasIndex(item => item.ReceptionNumber).IsUnique();
            entity.HasIndex(item => item.NormalizedFullName)
                .HasMethod("gin")
                .HasOperators("gin_trgm_ops")
                .HasFilter("\"DeletedAtUtc\" IS NULL");
            entity.HasIndex(item => item.Dpi).IsUnique();
            entity.HasIndex(item => item.DeletedAtUtc);
        });

        modelBuilder.Entity<IncomeDeclaration>(entity =>
        {
            entity.ToTable("income_declarations");
            entity.Property(item => item.FullName).HasMaxLength(200);
            entity.Property(item => item.ResidenceAddress).HasMaxLength(500);
            entity.Property(item => item.SalaryAmount).HasPrecision(14, 2);
            entity.HasOne(item => item.Client).WithMany(item => item.IncomeDeclarations).HasForeignKey(item => item.ClientId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureStudents(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Student>(entity =>
        {
            entity.ToTable("students");
            entity.Property(item => item.FullName).HasMaxLength(200);
            entity.Property(item => item.NormalizedFullName).HasMaxLength(200);
            entity.Property(item => item.StudentCardNumber).HasMaxLength(50);
            entity.Property(item => item.Dpi).HasMaxLength(30);
            entity.Property(item => item.Email).HasMaxLength(254);
            entity.Property(item => item.DeletionReason).HasMaxLength(500);
            entity.HasIndex(item => item.NormalizedFullName)
                .HasMethod("gin")
                .HasOperators("gin_trgm_ops")
                .HasFilter("\"DeletedAtUtc\" IS NULL");
            entity.HasIndex(item => item.StudentCardNumber).IsUnique();
            entity.HasIndex(item => item.Dpi).IsUnique();
            entity.HasIndex(item => item.Email).IsUnique();
            entity.HasIndex(item => item.UserAccountId).IsUnique();
            entity.HasIndex(item => item.DeletedAtUtc);
            entity.HasOne<UserAccount>().WithMany().HasForeignKey(item => item.UserAccountId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<EnrollmentApplication>(entity =>
        {
            entity.ToTable("enrollment_applications");
            entity.Property(item => item.Modality).HasConversion<string>().HasMaxLength(50);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasOne(item => item.Student).WithMany(item => item.EnrollmentApplications).HasForeignKey(item => item.StudentId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StudentRequirement>(entity =>
        {
            entity.ToTable("student_requirements");
            entity.Property(item => item.RequirementLabel).HasMaxLength(250);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(item => new { item.EnrollmentApplicationId, item.RequirementDefinitionId }).IsUnique();
            entity.HasOne(item => item.EnrollmentApplication).WithMany(item => item.Requirements).HasForeignKey(item => item.EnrollmentApplicationId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureCatalogs(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProcessType>(entity =>
        {
            entity.ToTable("process_types");
            entity.Property(item => item.Code).HasMaxLength(80);
            entity.Property(item => item.Name).HasMaxLength(250);
            entity.Property(item => item.Description).HasMaxLength(1000);
            entity.HasIndex(item => item.Code).IsUnique();
            entity.HasIndex(item => item.Name).IsUnique();
        });

        modelBuilder.Entity<RequirementDefinition>(entity =>
        {
            entity.ToTable("requirement_definitions");
            entity.Property(item => item.Scope).HasConversion<string>().HasMaxLength(40);
            entity.Property(item => item.Code).HasMaxLength(100);
            entity.Property(item => item.Label).HasMaxLength(300);
            entity.Property(item => item.Kind).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.DocumentNature).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(item => new { item.Scope, item.ProcessTypeId, item.Code }).IsUnique();
            entity.HasOne(item => item.ProcessType).WithMany(item => item.Requirements).HasForeignKey(item => item.ProcessTypeId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureCases(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LegalCase>(entity =>
        {
            entity.ToTable("legal_cases");
            entity.Property(item => item.CaseNumber).HasMaxLength(50);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(40);
            entity.Property(item => item.Stage).HasMaxLength(120);
            entity.Property(item => item.DeletionReason).HasMaxLength(500);
            entity.HasIndex(item => item.CaseNumber).IsUnique();
            entity.HasIndex(item => new { item.ClientId, item.Status });
            entity.HasIndex(item => new { item.Status, item.ProcessTypeId });
            entity.HasIndex(item => new { item.Status, item.RetentionStartsAtUtc });
            entity.HasIndex(item => item.DeletedAtUtc);
            entity.HasOne(item => item.Client).WithMany().HasForeignKey(item => item.ClientId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.ProcessType).WithMany().HasForeignKey(item => item.ProcessTypeId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CaseRequirement>(entity =>
        {
            entity.ToTable("case_requirements");
            entity.Property(item => item.RequirementLabel).HasMaxLength(300);
            entity.Property(item => item.Kind).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.DocumentNature).HasConversion<string>().HasMaxLength(30);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(item => new { item.LegalCaseId, item.RequirementDefinitionId }).IsUnique();
            entity.HasOne(item => item.LegalCase).WithMany(item => item.Requirements).HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CaseAssignment>(entity =>
        {
            entity.ToTable("case_assignments");
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(item => new { item.LegalCaseId, item.StudentId, item.Status });
            entity.HasIndex(item => new { item.Status, item.StudentId, item.LegalCaseId });
            entity.HasOne(item => item.LegalCase).WithMany(item => item.Assignments).HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.Student).WithMany().HasForeignKey(item => item.StudentId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Counterparty>(entity =>
        {
            entity.ToTable("counterparties");
            entity.Property(item => item.FullName).HasMaxLength(200);
            entity.Property(item => item.Dpi).HasMaxLength(30);
            entity.HasOne(item => item.LegalCase).WithMany(item => item.Counterparties).HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TimelineEntry>(entity =>
        {
            entity.ToTable("timeline_entries");
            entity.Property(item => item.Type).HasConversion<string>().HasMaxLength(40);
            entity.Property(item => item.Title).HasMaxLength(250);
            entity.HasIndex(item => new { item.LegalCaseId, item.OccurredAtUtc });
            entity.HasIndex(item => new { item.OccurredAtUtc, item.LegalCaseId });
            entity.HasOne(item => item.LegalCase).WithMany(item => item.Timeline).HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Memorial>(entity =>
        {
            entity.ToTable("memorials");
            entity.Property(item => item.Title).HasMaxLength(250);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(40);
            entity.HasOne(item => item.LegalCase).WithMany().HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MemorialVersion>(entity =>
        {
            entity.ToTable("memorial_versions");
            entity.HasIndex(item => new { item.MemorialId, item.VersionNumber }).IsUnique();
            entity.HasOne(item => item.Memorial).WithMany(item => item.Versions).HasForeignKey(item => item.MemorialId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MemorialReview>(entity =>
        {
            entity.ToTable("memorial_reviews");
            entity.Property(item => item.Outcome).HasConversion<string>().HasMaxLength(30);
            entity.HasOne(item => item.MemorialVersion).WithMany(item => item.Reviews).HasForeignKey(item => item.MemorialVersionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CasePresentation>(entity =>
        {
            entity.ToTable("case_presentations");
            entity.Property(item => item.Result).HasMaxLength(500);
            entity.HasIndex(item => new { item.LegalCaseId, item.PresentedAtUtc });
            entity.HasIndex(item => item.MemorialVersionId);
            entity.HasOne(item => item.LegalCase).WithMany().HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.Memorial).WithMany().HasForeignKey(item => item.MemorialId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.MemorialVersion).WithMany().HasForeignKey(item => item.MemorialVersionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CourtNotification>(entity =>
        {
            entity.ToTable("court_notifications");
            entity.HasIndex(item => new { item.LegalCaseId, item.NotifiedAtUtc });
            entity.HasOne(item => item.LegalCase).WithMany().HasForeignKey(item => item.LegalCaseId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureOperations(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SecretariatActivity>(entity =>
        {
            entity.ToTable("secretariat_activities");
            entity.Property(item => item.ActivityType).HasMaxLength(120);
            entity.HasIndex(item => item.OccurredAtUtc);
            entity.HasIndex(item => item.CreatedByUserId);
        });

        modelBuilder.Entity<WeeklyReport>(entity =>
        {
            entity.ToTable("weekly_reports");
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(item => new { item.PeriodStart, item.PeriodEnd }).IsUnique();
        });

        modelBuilder.Entity<ReportActivity>(entity =>
        {
            entity.ToTable("report_activities");
            entity.HasIndex(item => new { item.WeeklyReportId, item.SecretariatActivityId }).IsUnique();
            entity.HasOne(item => item.WeeklyReport).WithMany(item => item.Activities).HasForeignKey(item => item.WeeklyReportId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<SecretariatActivity>().WithMany().HasForeignKey(item => item.SecretariatActivityId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<EmailDelivery>(entity =>
        {
            entity.ToTable("email_deliveries");
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasOne(item => item.WeeklyReport).WithMany(item => item.Deliveries).HasForeignKey(item => item.WeeklyReportId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureAudit(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.Property(item => item.Username).HasMaxLength(80);
            entity.Property(item => item.Action).HasMaxLength(40);
            entity.Property(item => item.EntityType).HasMaxLength(120);
            entity.Property(item => item.EntityId).HasMaxLength(80);
            entity.Property(item => item.TraceId).HasMaxLength(100);
            entity.Property(item => item.IpAddress).HasMaxLength(64);
            entity.HasIndex(item => item.OccurredAtUtc);
            entity.HasIndex(item => item.UserId);
            entity.HasIndex(item => new { item.UserId, item.OccurredAtUtc });
            entity.HasIndex(item => new { item.EntityType, item.EntityId });
        });
    }
}
