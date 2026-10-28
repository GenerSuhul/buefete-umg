using BufeteJuridico.Application.Clients;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Clients;
using BufeteJuridico.Domain.Auditing;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Identity;
using BufeteJuridico.Infrastructure.Identity;
using BufeteJuridico.Infrastructure.Persistence;
using BufeteJuridico.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using System.Text.Json;

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
            throw new ForbiddenException("Sólo los administradores pueden administrar la lista negra.");
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
            throw new ConflictException("Este DPI ya tiene un bloqueo permanente en lista negra.");
        var entry = new ClientRestriction { Dpi = key, Reason = reason, SourceTenantCode = tenant.Code, IssuedByName = currentUser.Username ?? "Administrador" };
        gate.ClientRestrictions.Add(entry);
        try { await gate.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new ConflictException("Este DPI ya tiene un bloqueo permanente en lista negra."); }
        await transaction!.CommitAsync(ct);
        return Map(entry);
    }

    public async Task RemoveAsync(Guid id, RemoveClientRestrictionRequest request, CancellationToken ct)
    {
        var global = await RequireAdministratorAsync(ct);
        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length is < 10 or > 2000)
            throw new ValidationException("Indique un motivo de 10 a 2000 caracteres para retirar el bloqueo.");
        await using var central = registry.OpenCentral();
        var existing = await central.ClientRestrictions.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException("No se encontró un bloqueo vigente con esa referencia.");
        if (!global && existing.SourceTenantCode != tenant.Code)
            throw new ForbiddenException("Sólo la sede que emitió el bloqueo puede retirarlo.");
        await LockAsync(existing.Dpi, ct);
        var entry = await gate!.ClientRestrictions.SingleOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException("El bloqueo ya fue retirado. Actualice la lista.");
        if (!global && entry.SourceTenantCode != tenant.Code)
            throw new ForbiddenException("Sólo la sede que emitió el bloqueo puede retirarlo.");
        gate.ClientRestrictions.Remove(entry);
        gate.AuditLogs.Add(new AuditLog
        {
            UserId = currentUser.UserId,
            Username = currentUser.Username,
            OccurredAtUtc = clock.GetUtcNow(),
            Action = "ClientRestrictionRemoved",
            EntityType = nameof(ClientRestriction),
            EntityId = id.ToString(),
            ChangesJson = JsonSerializer.Serialize(new { Reason = reason, entry.Dpi, entry.SourceTenantCode }),
            TraceId = currentUser.TraceId,
            IpAddress = currentUser.IpAddress
        });
        await gate.SaveChangesAsync(ct);
        await transaction!.CommitAsync(ct);
    }

    public async Task<ClientRestrictionStatus> GetStatusAsync(string? dpi, CancellationToken ct)
    {
        return (await GetStatusesAsync([dpi], ct))[0];
    }

    public async Task<IReadOnlyList<ClientRestrictionStatus>> GetStatusesAsync(IReadOnlyList<string?> dpis, CancellationToken ct)
    {
        if (dpis.Count == 0) return [];
        // Historical malformed identities must not make the record unreadable.
        // If 13 ASCII digits can be recovered, still check the registry, but require correction before attention.
        var identities = dpis.Select(dpi =>
        {
            var valid = true;
            try { _ = ClientRestrictionIdentity.Normalize(dpi); }
            catch (ArgumentException) { valid = false; }
            return (Key: ContactNormalization.Digits(dpi), Valid: valid);
        }).ToArray();
        var keys = identities.Select(identity => identity.Key)
            .Where(key => key.Length == 13 && key.All(c => c is >= '0' and <= '9')).Distinct().ToArray();
        if (keys.Length == 0) return identities.Select(_ => new ClientRestrictionStatus(false, null, false)).ToArray();
        await using var central = registry.OpenCentral();
        var rows = await central.ClientRestrictions.AsNoTracking().Where(r => keys.Contains(r.Dpi))
            .Select(r => new { r.Dpi, r.Id }).ToListAsync(ct);
        var blocked = rows.ToDictionary(r => r.Dpi, r => r.Id);
        return identities.Select(identity => blocked.TryGetValue(identity.Key, out var id)
            ? new ClientRestrictionStatus(true, id, identity.Valid)
            : new ClientRestrictionStatus(false, null, identity.Valid)).ToArray();
    }

    public async Task EnsureAllowedAsync(string? dpi, CancellationToken ct, bool required = true)
    {
        if (!required && string.IsNullOrWhiteSpace(dpi)) return;
        var key = Key(dpi);
        await LockAsync(key, ct);
        if (await gate!.ClientRestrictions.AnyAsync(r => r.Dpi == key, ct))
            throw new ConflictException("Atención bloqueada: este DPI tiene un bloqueo permanente en lista negra. Consulte con la administración.");
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
