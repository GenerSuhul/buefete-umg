using BufeteJuridico.Application.Clients;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Clients;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace BufeteJuridico.Infrastructure.Clients;

internal sealed class ClientRestrictionService(TenantRegistry registry, TenantContext tenant, BufeteDbContext local,
    ICurrentUser currentUser, TimeProvider clock) : IClientRestrictionService, IAsyncDisposable
{
    private BufeteDbContext? gate;
    private IDbContextTransaction? transaction;
    private readonly HashSet<string> locked = [];

    private static string Key(string? dpi)
    {
        try { return ClientRestrictionIdentity.Normalize(dpi); }
        catch (ArgumentException ex) { throw new ValidationException(ex.Message); }
    }

    private async Task LockAsync(string key, CancellationToken ct)
    {
        if (gate is null)
        {
            gate = registry.OpenCentral();
            transaction = await gate.Database.BeginTransactionAsync(ct);
        }
        // Shared control-plane lock serializes issuance with attention writes in any tenant.
        // The scoped service holds it until the tenant write finishes and the request is disposed.
        if (locked.Add(key))
            await gate.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
    }

    private async Task<bool> RequireAdministratorAsync(CancellationToken ct)
    {
        var user = await local.Users.Include(u => u.Roles).ThenInclude(r => r.Role)
            .SingleOrDefaultAsync(u => u.Id == currentUser.UserId, ct);
        if (user is null || !UserAccessRules.CanSignIn(user, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime)) ||
            !user.Roles.Any(r => r.Role.NormalizedName == "ADMINISTRADOR"))
            throw new ForbiddenException("Sólo los administradores pueden emitir vetos de atención.");
        if (user.IsPlatformAccount) await registry.RequirePlatformAsync(ct);
        return user.IsPlatformAccount;
    }

    public async Task<PagedResult<ClientRestrictionDto>> ListAsync(string? dpi, int page, int pageSize, CancellationToken ct)
    {
        var global = await RequireAdministratorAsync(ct);
        await using var central = registry.OpenCentral();
        var query = central.ClientRestrictions.AsNoTracking();
        if (!global) query = query.Where(r => r.SourceTenantCode == tenant.Code);
        if (!string.IsNullOrWhiteSpace(dpi)) { var key = Key(dpi); query = query.Where(r => r.Dpi == key); }
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(r => r.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new(rows.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<ClientRestrictionDto> CreateAsync(CreateClientRestrictionRequest request, CancellationToken ct)
    {
        await RequireAdministratorAsync(ct);
        var key = Key(request.Dpi);
        if (key != Key(request.ConfirmDpi)) throw new ValidationException("Los DPI no coinciden. Verifique la identidad antes de confirmar.");
        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length is < 10 or > 2000) throw new ValidationException("Indique un motivo de 10 a 2000 caracteres.");
        await LockAsync(key, ct);
        if (await gate!.ClientRestrictions.AnyAsync(r => r.Dpi == key, ct))
            throw new ConflictException("Este DPI ya tiene un veto global permanente.");
        var entry = new ClientRestriction { Dpi = key, Reason = reason, SourceTenantCode = tenant.Code, IssuedByName = currentUser.Username ?? "Administrador" };
        gate.ClientRestrictions.Add(entry);
        try { await gate.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new ConflictException("Este DPI ya tiene un veto global permanente."); }
        await transaction!.CommitAsync(ct);
        return Map(entry);
    }

    public async Task<ClientRestrictionStatus> GetStatusAsync(string? dpi, CancellationToken ct)
    {
        // Historical malformed identities must not make the record unreadable.
        // If 13 ASCII digits can be recovered, still check the registry, but require correction before attention.
        var valid = true;
        try { _ = ClientRestrictionIdentity.Normalize(dpi); }
        catch (ArgumentException) { valid = false; }
        var key = ContactNormalization.Digits(dpi);
        if (key.Length != 13 || key.Any(c => c is < '0' or > '9')) return new(false, null, false);
        await using var central = registry.OpenCentral();
        var id = await central.ClientRestrictions.Where(r => r.Dpi == key).Select(r => (Guid?)r.Id).SingleOrDefaultAsync(ct);
        return new(id.HasValue, id, valid);
    }

    public async Task EnsureAllowedAsync(string? dpi, CancellationToken ct, bool required = true)
    {
        if (!required && string.IsNullOrWhiteSpace(dpi)) return;
        var key = Key(dpi);
        await LockAsync(key, ct);
        if (await gate!.ClientRestrictions.AnyAsync(r => r.Dpi == key, ct))
            throw new ConflictException("Atención bloqueada: este DPI tiene un veto global permanente. Consulte con la administración.");
    }

    public async Task EnsureCaseAllowedAsync(Guid caseId, CancellationToken ct)
    {
        var client = await local.LegalCases.Where(c => c.Id == caseId).Select(c => new { c.Client.Dpi }).SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("No se encontró el expediente.");
        await EnsureAllowedAsync(client.Dpi, ct);
    }

    public async Task EnsureDocumentAllowedAsync(DocumentContextType type, Guid id, CancellationToken ct)
    {
        Guid? clientId = type switch
        {
            DocumentContextType.Client => id,
            DocumentContextType.IncomeDeclaration => await local.IncomeDeclarations.Where(x => x.Id == id).Select(x => (Guid?)x.ClientId).SingleOrDefaultAsync(ct),
            DocumentContextType.LegalCase => await local.LegalCases.Where(x => x.Id == id).Select(x => (Guid?)x.ClientId).SingleOrDefaultAsync(ct),
            DocumentContextType.CaseRequirement => await local.CaseRequirements.Where(x => x.Id == id).Select(x => (Guid?)x.LegalCase.ClientId).SingleOrDefaultAsync(ct),
            DocumentContextType.Timeline => await local.TimelineEntries.Where(x => x.Id == id).Select(x => (Guid?)x.LegalCase.ClientId).SingleOrDefaultAsync(ct),
            DocumentContextType.Memorial => await local.Memorials.Where(x => x.Id == id).Select(x => (Guid?)x.LegalCase.ClientId).SingleOrDefaultAsync(ct),
            _ => null
        };
        if (clientId is not null)
        {
            var dpi = await local.Clients.Where(x => x.Id == clientId).Select(x => x.Dpi).SingleOrDefaultAsync(ct);
            await EnsureAllowedAsync(dpi, ct);
        }
    }

    private static ClientRestrictionDto Map(ClientRestriction r) => new(r.Id, ContactNormalization.Cui(r.Dpi)!, r.Reason, r.SourceTenantCode, r.IssuedByName, r.CreatedAtUtc);
    public async ValueTask DisposeAsync()
    {
        if (transaction is not null) await transaction.DisposeAsync();
        if (gate is not null) await gate.DisposeAsync();
    }
}
