using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Students;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.StudentsRead)]
[Route("api/v{version:apiVersion}/practice-notices")]
public sealed class PracticeNoticesController(IPracticeNoticeService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PracticeNoticeDto>>> List(CancellationToken ct) => Ok(await service.ListAsync(ct));

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken ct)
    {
        await service.MarkReadAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/sounded")]
    public async Task<IActionResult> Sounded(Guid id, CancellationToken ct)
    {
        await service.MarkSoundedAsync(id, ct);
        return NoContent();
    }
}
