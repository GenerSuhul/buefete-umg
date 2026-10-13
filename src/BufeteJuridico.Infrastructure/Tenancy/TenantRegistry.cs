using System.Net.Mail;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Npgsql;

namespace BufeteJuridico.Infrastructure.Tenancy;

// The control plane always opens the configured central database, never the request database.
public sealed class TenantRegistry(
    IConfiguration configuration,
    ICurrentUser currentUser,
    IPasswordHasher<UserAccount> hasher,
    IAccessTokenIssuer issuer,
    IOptions<JwtOptions> jwtOptions,
    TimeProvider clock) : ITenantManagementService
{
    public BufeteDbContext OpenCentral() => Open(configuration.GetConnectionString("BufeteDb")!);

    private BufeteDbContext Open(string connection) => new(
        new DbContextOptionsBuilder<BufeteDbContext>().UseNpgsql(connection).Options,
        currentUser, clock);

    public async Task InitialiseAsync(CancellationToken ct)
    {
        await using var db = OpenCentral();
        if (!await db.Tenants.AnyAsync(item => item.Code == "peten", ct))
        {
            db.Tenants.Add(new Tenant { Code = "peten", Name = "Petén", Status = "Ready", IsActive = true,
                DatabaseName = new NpgsqlConnectionStringBuilder(configuration.GetConnectionString("BufeteDb")).Database! });
            await db.SaveChangesAsync(ct);
        }
        // Bootstrap is opt-in, has no committed/default password, and never resets existing credentials.
        var email = configuration["PlatformAdmin:Email"];
        var password = configuration["PlatformAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
        if (!PasswordRules.IsValid(password) || !MailAddress.TryCreate(email, out _))
            throw new InvalidOperationException("PlatformAdmin requiere un correo y una contraseña válidos.");
        var normalized = TextNormalization.Normalize(email);
        var existing = await db.Users.SingleOrDefaultAsync(item => item.NormalizedEmail == normalized, ct);
        if (existing is not null)
        {
            if (!existing.IsPlatformAccount) throw new InvalidOperationException("El correo de plataforma ya pertenece a una cuenta local.");
            return;
        }
        var root = new UserAccount { Username = "superadmin", NormalizedUsername = "SUPERADMIN", Email = email,
            NormalizedEmail = normalized, FullName = "Administrador de plataforma", IsPlatformAccount = true };
        root.PasswordHash = hasher.HashPassword(root, password);
        root.Roles.Add(new UserRole { RoleId = await db.Roles.Where(item => item.NormalizedName == "ADMINISTRADOR").Select(item => item.Id).SingleAsync(ct), AssignedAtUtc = clock.GetUtcNow() });
        db.Users.Add(root);
        await db.SaveChangesAsync(ct);
    }

    public async Task<Tenant> ResolveAsync(string code, CancellationToken ct)
    {
        await using var db = OpenCentral();
        return await db.Tenants.AsNoTracking().SingleOrDefaultAsync(item => item.Code == code && item.IsActive && item.Status == "Ready", ct)
            ?? throw new ForbiddenException("La sede no está disponible. Consulte con la administración.");
    }

    public async Task<bool> IsPlatformAccountValidAsync(Guid id, Guid stamp, CancellationToken ct)
    {
        await using var db = OpenCentral();
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id && item.IsPlatformAccount, ct);
        return user is not null && user.SecurityStamp == stamp && UserAccessRules.CanSignIn(user, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));
    }

    public async Task RejectReservedIdentityAsync(string username, string email, Guid? exceptUserId, CancellationToken ct)
    {
        await using var db = OpenCentral();
        var normalizedUsername = TextNormalization.Normalize(username);
        var normalizedEmail = TextNormalization.Normalize(email);
        if (await db.Users.AnyAsync(item => item.IsPlatformAccount && item.Id != exceptUserId &&
            (item.NormalizedUsername == normalizedUsername || item.NormalizedEmail == normalizedEmail), ct))
            throw new ConflictException("El identificador o correo está reservado para administración de plataforma.");
    }

    public async Task RequirePlatformAsync(CancellationToken ct)
    {
        await using var db = OpenCentral();
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(item => item.Id == currentUser.UserId && item.IsPlatformAccount, ct);
        if (user is null || !UserAccessRules.CanSignIn(user, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime)))
            throw new ForbiddenException("Esta acción requiere una cuenta de administración de plataforma.");
    }

    public async Task<IReadOnlyList<TenantDto>> ListAsync(CancellationToken ct)
    {
        await RequirePlatformAsync(ct);
        await using var db = OpenCentral();
        return await db.Tenants.AsNoTracking().OrderBy(item => item.Name)
            .Select(item => new TenantDto(item.Code, item.Name, item.Status, item.IsActive)).ToListAsync(ct);
    }

    public async Task<TenantDto> CreateAsync(CreateTenantRequest request, CancellationToken ct)
    {
        await RequirePlatformAsync(ct);
        var code = request.Code?.Trim().ToLowerInvariant() ?? "";
        var name = request.Name?.Trim() ?? "";
        if (!Regex.IsMatch(code, "^[a-z][a-z0-9-]{1,39}$", RegexOptions.CultureInvariant) || name.Length is < 2 or > 160)
            throw new ValidationException("Indique un código de 2 a 40 letras, números o guiones y un nombre de sede válido.");
        if (string.IsNullOrWhiteSpace(request.AdministratorName) || request.AdministratorName.Length > 160 ||
            !MailAddress.TryCreate(request.AdministratorEmail, out _) || !PasswordRules.IsValid(request.AdministratorPassword))
            throw new ValidationException("Complete el nombre, correo y contraseña del administrador (8 a 128 caracteres).");
        await RejectReservedIdentityAsync("administrador", request.AdministratorEmail, null, ct);
        await using var central = OpenCentral();
        var existing = await central.Tenants.SingleOrDefaultAsync(item => item.Code == code, ct);
        if (existing is not null && existing.Status != "Failed") throw new ConflictException("El código de sede ya está registrado.");
        // Generated identifier is never derived from caller SQL or from a connection string supplied by a caller.
        var tenant = existing ?? new Tenant { Code = code, Name = name, DatabaseName = $"bufete_t_{Guid.NewGuid():N}" };
        tenant.Name = name;
        tenant.Status = "Provisioning";
        if (existing is null) central.Tenants.Add(tenant);
        try { await central.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new ConflictException("Otra operación ya está aprovisionando esta sede."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new ConflictException("El código de sede ya está registrado."); }
        try
        {
            await using var connection = new NpgsqlConnection(configuration.GetConnectionString("BufeteDb"));
            await connection.OpenAsync(ct);
            await using var command = new NpgsqlCommand($"CREATE DATABASE \"{tenant.DatabaseName}\"", connection);
            try { await command.ExecuteNonQueryAsync(ct); }
            catch (PostgresException ex) when (existing is not null && ex.SqlState == PostgresErrorCodes.DuplicateDatabase) { /* Resume the owned, previously failed database. */ }
            var tenantScope = new TenantContext(configuration);
            tenantScope.Select(code, name, tenant.DatabaseName);
            await using var db = Open(tenantScope.ConnectionString);
            var admin = Options.Create(new BootstrapAdminOptions { Username = "administrador", Email = request.AdministratorEmail.Trim(),
                FullName = request.AdministratorName.Trim(), Password = request.AdministratorPassword });
            await new DatabaseInitializer(db, hasher, admin, clock).InitialiseAsync(ct);
            tenant.Status = "Ready";
            tenant.IsActive = true;
            await central.SaveChangesAsync(ct);
            return new TenantDto(code, name, tenant.Status, tenant.IsActive);
        }
        catch
        {
            tenant.Status = "Failed";
            tenant.IsActive = false;
            await central.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    public async Task<TenantDto> UpdateAsync(string code, UpdateTenantRequest request, CancellationToken ct)
    {
        await RequirePlatformAsync(ct);
        var name = request.Name?.Trim() ?? "";
        if (name.Length is < 2 or > 160) throw new ValidationException("El nombre debe tener entre 2 y 160 caracteres.");
        if (code == "peten" && !request.IsActive) throw new ConflictException("La sede central aloja la administración de plataforma y no puede suspenderse.");
        await using var db = OpenCentral();
        var tenant = await db.Tenants.SingleOrDefaultAsync(item => item.Code == code, ct) ?? throw new NotFoundException("Sede no encontrada.");
        if (tenant.Status != "Ready") throw new ConflictException("La sede no completó su aprovisionamiento.");
        tenant.Name = name;
        tenant.IsActive = request.IsActive;
        await db.SaveChangesAsync(ct);
        return new TenantDto(tenant.Code, tenant.Name, tenant.Status, tenant.IsActive);
    }

    public async Task<TokenResponse> SwitchAsync(string code, CancellationToken ct)
    {
        await RequirePlatformAsync(ct);
        var tenant = await ResolveAsync(code, ct);
        await using var central = OpenCentral();
        var root = await central.Users.AsNoTracking().SingleAsync(item => item.Id == currentUser.UserId && item.IsPlatformAccount, ct);
        var context = new TenantContext(configuration);
        context.Select(tenant.Code, tenant.Name, tenant.DatabaseName);
        await using var target = Open(context.ConnectionString);
        var mirror = await target.Users.Include(item => item.Roles).ThenInclude(item => item.Role).SingleOrDefaultAsync(item => item.Id == root.Id, ct);
        if (mirror is null)
        {
            if (await target.Users.AnyAsync(item => item.NormalizedEmail == root.NormalizedEmail || item.NormalizedUsername == root.NormalizedUsername, ct))
                throw new ConflictException("El identificador de la cuenta de plataforma está reservado en esta sede.");
            mirror = new UserAccount { Id = root.Id, Username = root.Username, NormalizedUsername = root.NormalizedUsername,
                Email = root.Email, NormalizedEmail = root.NormalizedEmail, FullName = root.FullName, IsPlatformAccount = true };
            mirror.PasswordHash = hasher.HashPassword(mirror, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
            mirror.Roles.Add(new UserRole { RoleId = await target.Roles.Where(item => item.NormalizedName == "ADMINISTRADOR").Select(item => item.Id).SingleAsync(ct), AssignedAtUtc = clock.GetUtcNow() });
            target.Users.Add(mirror);
        }
        mirror.SecurityStamp = root.SecurityStamp;
        mirror.FullName = root.FullName;
        mirror.Email = root.Email;
        mirror.NormalizedEmail = root.NormalizedEmail;
        await target.SaveChangesAsync(ct);
        var auth = new AuthenticationService(target, hasher, issuer, jwtOptions, currentUser, clock, context, this);
        return await auth.CreatePlatformSessionAsync(root.Id, ct);
    }
}
