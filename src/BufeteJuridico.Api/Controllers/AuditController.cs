using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.AuditRead)]
public sealed class AuditController(IQueryService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> Get(
        Guid? userId,
        string? entityType,
        Guid? entityId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetAuditAsync(userId, entityType, entityId, from, to, page, pageSize, cancellationToken));
}
