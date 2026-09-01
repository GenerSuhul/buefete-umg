using BufeteJuridico.Application.Administration;
using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
[Route("api/v{version:apiVersion}/deleted-records")]
public sealed class DeletedRecordsController(IDeletedRecordService service) : ApiV1ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.DeletedRecordsRead)]
    public async Task<ActionResult<PagedResult<DeletedRecordDto>>> Get(
        DeletedRecordType? type,
        string? search,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetAsync(type, search, page, pageSize, cancellationToken));

    [HttpPost("{type}/{id:guid}/restore")]
    [Authorize(Policy = Permissions.RecordsRestore)]
    public async Task<IActionResult> Restore(DeletedRecordType type, Guid id, CancellationToken cancellationToken)
    {
        await service.RestoreAsync(type, id, cancellationToken);
        return NoContent();
    }
}
