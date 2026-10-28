namespace BufeteJuridico.Application.Students;

public sealed record PracticeNoticeDto(Guid Id, Guid StudentId, string StudentName, DateOnly EndDate, int DaysRemaining, bool IsRead, bool IsSounded);
public interface IPracticeNoticeService
{
    Task<IReadOnlyList<PracticeNoticeDto>> ListAsync(CancellationToken cancellationToken);
    Task MarkReadAsync(Guid id, CancellationToken cancellationToken);
    Task MarkSoundedAsync(Guid id, CancellationToken cancellationToken);
}
