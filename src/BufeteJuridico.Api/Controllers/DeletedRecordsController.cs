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

    [HttpGet("{type}/{id:guid}/purge-preview")]
    [Authorize(Policy = Permissions.DeletedRecordsRead)]
    public async Task<ActionResult<PurgePreviewDto>> PreviewPurge(DeletedRecordType type, Guid id, CancellationToken cancellationToken)
    {
        if (User.FindFirst("platform_admin")?.Value != "true") return Forbid();
        return Ok(await service.PreviewPurgeAsync(type, id, cancellationToken));
    }

    [HttpDelete("{type}/{id:guid}/purge")]
    [Authorize(Policy = Permissions.DeletedRecordsRead)]
    public async Task<ActionResult<PurgeResultDto>> Purge(DeletedRecordType type, Guid id, PurgeRecordRequest request, CancellationToken cancellationToken)
    {
        if (User.FindFirst("platform_admin")?.Value != "true") return Forbid();
        return Ok(await service.PurgeAsync(type, id, request.Reference, cancellationToken));
    }

    [HttpPost("storage-cleanup")]
    [Authorize(Policy = Permissions.DeletedRecordsRead)]
    public async Task<ActionResult<object>> RetryStorageCleanup(CancellationToken cancellationToken)
    {
        if (User.FindFirst("platform_admin")?.Value != "true") return Forbid();
        return Ok(new { pending = await service.RetryPendingStorageDeletesAsync(cancellationToken) });
    }
}
