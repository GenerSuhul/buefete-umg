using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Students;
using BufeteJuridico.Domain.Auditing;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Students;

internal sealed class PracticeNoticeService(BufeteDbContext db, ICurrentUser user, TimeProvider clock) : IPracticeNoticeService
{
    private const string ReadAction = "PracticeEndNoticeRead";
    private const string SoundedAction = "PracticeEndNoticeSounded";
    public async Task<IReadOnlyList<PracticeNoticeDto>> ListAsync(CancellationToken ct)
    {
        var actor = user.UserId ?? throw new ForbiddenException("Inicie sesión para consultar avisos.");
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var limit = today.AddDays(15);
        var records = await db.EnrollmentApplications.AsNoTracking()
            .Where(item => item.EndDate != null && item.EndDate >= today && item.EndDate <= limit &&
                item.Status != EnrollmentStatus.Rejected && item.Status != EnrollmentStatus.Completed &&
                item.Student.IsActive && item.Student.DeletedAtUtc == null)
            .Select(item => new { item.Id, item.StudentId, item.Student.FullName, item.EndDate })
            .OrderBy(item => item.EndDate)
            .ToListAsync(ct);
        var keys = records.Select(item => item.Id.ToString()).ToArray();
        var markers = await db.AuditLogs.AsNoTracking()
            .Where(item => item.UserId == actor && (item.Action == ReadAction || item.Action == SoundedAction) && keys.Contains(item.EntityId))
            .Select(item => new { item.EntityId, item.Action }).ToListAsync(ct);
        var readSet = markers.Where(item => item.Action == ReadAction).Select(item => item.EntityId).ToHashSet(StringComparer.Ordinal);
        var soundedSet = markers.Where(item => item.Action == SoundedAction).Select(item => item.EntityId).ToHashSet(StringComparer.Ordinal);
        return records.Select(item => new PracticeNoticeDto(item.Id, item.StudentId, item.FullName, item.EndDate!.Value,
            item.EndDate.Value.DayNumber - today.DayNumber, readSet.Contains(item.Id.ToString()), soundedSet.Contains(item.Id.ToString()))).ToArray();
    }

    public async Task MarkReadAsync(Guid id, CancellationToken ct)
        => await MarkAsync(id, ReadAction, ct);

    public async Task MarkSoundedAsync(Guid id, CancellationToken ct)
        => await MarkAsync(id, SoundedAction, ct);

    private async Task MarkAsync(Guid id, string action, CancellationToken ct)
    {
        var actor = user.UserId ?? throw new ForbiddenException("Inicie sesión para consultar avisos.");
        if (!(await ListAsync(ct)).Any(item => item.Id == id)) throw new NotFoundException("El aviso ya no está vigente.");
        if (await db.AuditLogs.AnyAsync(item => item.UserId == actor && item.Action == action && item.EntityId == id.ToString(), ct)) return;
        db.AuditLogs.Add(new AuditLog
        {
            UserId = actor, Username = user.Username, OccurredAtUtc = clock.GetUtcNow(), Action = action,
            EntityType = nameof(EnrollmentApplication), EntityId = id.ToString(), TraceId = user.TraceId, IpAddress = user.IpAddress
        });
        await db.SaveChangesAsync(ct);
    }
}
