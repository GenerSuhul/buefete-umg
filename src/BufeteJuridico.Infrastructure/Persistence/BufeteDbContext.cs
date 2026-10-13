using System.Text.Json;
using BufeteJuridico.Application.Common;
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
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace BufeteJuridico.Infrastructure.Persistence;

public sealed class BufeteDbContext(
    DbContextOptions<BufeteDbContext> options,
    ICurrentUser currentUser,
    TimeProvider timeProvider)
    : DbContext(options)
{
    public DbSet<UserAccount> Users => Set<UserAccount>();

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<Permission> Permissions => Set<Permission>();

    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<DocumentRecord> Documents => Set<DocumentRecord>();

    public DbSet<ScanSession> ScanSessions => Set<ScanSession>();

    public DbSet<ScanPage> ScanPages => Set<ScanPage>();

    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientRestriction> ClientRestrictions => Set<ClientRestriction>();

    public DbSet<IncomeDeclaration> IncomeDeclarations => Set<IncomeDeclaration>();

    public DbSet<Student> Students => Set<Student>();

    public DbSet<EnrollmentApplication> EnrollmentApplications => Set<EnrollmentApplication>();

    public DbSet<StudentRequirement> StudentRequirements => Set<StudentRequirement>();

    public DbSet<ProcessType> ProcessTypes => Set<ProcessType>();

    public DbSet<RequirementDefinition> RequirementDefinitions => Set<RequirementDefinition>();

    public DbSet<LegalCase> LegalCases => Set<LegalCase>();

    public DbSet<CaseRequirement> CaseRequirements => Set<CaseRequirement>();

    public DbSet<CaseAssignment> CaseAssignments => Set<CaseAssignment>();

    public DbSet<Counterparty> Counterparties => Set<Counterparty>();

    public DbSet<TimelineEntry> TimelineEntries => Set<TimelineEntry>();

    public DbSet<Memorial> Memorials => Set<Memorial>();

    public DbSet<MemorialVersion> MemorialVersions => Set<MemorialVersion>();

    public DbSet<MemorialReview> MemorialReviews => Set<MemorialReview>();

    public DbSet<CasePresentation> CasePresentations => Set<CasePresentation>();

    public DbSet<CourtNotification> CourtNotifications => Set<CourtNotification>();

    public DbSet<SecretariatActivity> SecretariatActivities => Set<SecretariatActivity>();

    public DbSet<WeeklyReport> WeeklyReports => Set<WeeklyReport>();

    public DbSet<ReportActivity> ReportActivities => Set<ReportActivity>();

    public DbSet<EmailDelivery> EmailDeliveries => Set<EmailDelivery>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyAuditInformation();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        ApplyAuditInformation();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema("bufete");
        ModelConfiguration.Configure(modelBuilder);
        modelBuilder.Entity<ClientRestriction>(entity =>
        {
            entity.ToTable("client_restrictions", table => table.HasCheckConstraint("CK_client_restrictions_dpi", "\"Dpi\" ~ '^[0-9]{13}$'"));
            entity.HasIndex(x => x.Dpi).IsUnique();
            entity.Property(x => x.Dpi).HasMaxLength(13);
            entity.Property(x => x.Reason).HasMaxLength(2000);
            entity.Property(x => x.SourceTenantCode).HasMaxLength(40);
            entity.Property(x => x.IssuedByName).HasMaxLength(160);
        });
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.ToTable("tenants");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => item.Code).IsUnique();
            entity.Property(item => item.Code).HasMaxLength(40);
            entity.Property(item => item.Name).HasMaxLength(160);
            entity.Property(item => item.DatabaseName).HasMaxLength(63);
            entity.Property(item => item.Status).HasMaxLength(24);
        });

        base.OnModelCreating(modelBuilder);
    }

    private void ApplyAuditInformation()
    {
        ChangeTracker.DetectChanges();

        var now = timeProvider.GetUtcNow();
        var auditableEntries = ChangeTracker
            .Entries<AuditableEntity>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified)
            .ToList();

        foreach (var entry in auditableEntries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
                entry.Entity.CreatedByUserId ??= currentUser.UserId;
            }
            else
            {
                entry.Entity.UpdatedAtUtc = now;
                entry.Entity.UpdatedByUserId = currentUser.UserId;
                entry.Entity.ConcurrencyToken = Guid.NewGuid();
            }
        }

        var auditLogs = ChangeTracker
            .Entries()
            .Where(ShouldAudit)
            .Select(entry => CreateAuditLog(entry, now))
            .ToList();

        if (auditLogs.Count > 0)
        {
            AuditLogs.AddRange(auditLogs);
        }
    }

    private static bool ShouldAudit(EntityEntry entry) =>
        entry.Entity is not AuditLog and not RefreshToken &&
        entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted;

    private AuditLog CreateAuditLog(EntityEntry entry, DateTimeOffset now)
    {
        var action = entry.State switch
        {
            EntityState.Added => "Create",
            EntityState.Modified when IsSoftDelete(entry) => "SoftDelete",
            EntityState.Modified when IsRestore(entry) => "Restore",
            EntityState.Modified => "Update",
            EntityState.Deleted => "Delete",
            _ => entry.State.ToString()
        };

        var changes = new Dictionary<string, object?>();

        var isAccountPurge = entry.Entity is UserAccount && entry.State == EntityState.Deleted;
        foreach (var property in entry.Properties.Where(property => !isAccountPurge && ShouldIncludeProperty(entry, property)))
        {
            changes[property.Metadata.Name] = IsSensitiveAuditProperty(property.Metadata.Name)
                ? "[PROTECTED]"
                : entry.State == EntityState.Modified
                ? new { Original = property.OriginalValue, Current = property.CurrentValue }
                : property.CurrentValue;
        }

        var entityId = entry.Property("Id").CurrentValue?.ToString() ?? string.Empty;

        return new AuditLog
        {
            UserId = currentUser.UserId,
            Username = currentUser.Username,
            OccurredAtUtc = now,
            Action = action,
            EntityType = entry.Metadata.ClrType.Name,
            EntityId = entityId,
            ChangesJson = changes.Count == 0 ? null : JsonSerializer.Serialize(changes),
            TraceId = currentUser.TraceId,
            IpAddress = currentUser.IpAddress
        };
    }

    private static bool IsSoftDelete(EntityEntry entry)
    {
        var property = entry.Properties.FirstOrDefault(item => item.Metadata.Name == "DeletedAtUtc");
        return property is { IsModified: true, OriginalValue: null } && property.CurrentValue is not null;
    }

    private static bool IsRestore(EntityEntry entry)
    {
        var property = entry.Properties.FirstOrDefault(item => item.Metadata.Name == "DeletedAtUtc");
        return property is { IsModified: true, CurrentValue: null } && property.OriginalValue is not null;
    }

    private static bool ShouldIncludeProperty(EntityEntry entry, PropertyEntry property)
    {
        if (property.Metadata.Name is "PasswordHash" or "TokenHash" or "SecurityStamp")
        {
            return false;
        }

        return entry.State != EntityState.Modified || property.IsModified;
    }

    private static bool IsSensitiveAuditProperty(string propertyName) => propertyName is
        "Dpi" or
        "ResidenceAddress" or
        "WorkAddress" or
        "Phone" or
        "MobilePhone" or
        "HomePhone" or
        "WorkPhone" or
        "SalaryAmount" or
        "Notes" or
        "Observations" or
        "Description" or
        "FailureMessage";
}
