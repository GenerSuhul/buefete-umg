using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.RetentionPreview)]
public sealed class RetentionController(IQueryService service, TimeProvider timeProvider) : ApiV1ControllerBase
{
    [HttpGet("candidates")]
    public async Task<ActionResult<PagedResult<RetentionCandidateDto>>> GetCandidates(
        int retentionDays = 365,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetRetentionCandidatesAsync(timeProvider.GetUtcNow(), retentionDays, page, pageSize, cancellationToken));

    [HttpGet("{caseId:guid}/preview")]
    public async Task<ActionResult<RetentionPreviewDto>> GetPreview(
        Guid caseId,
        int retentionDays = 365,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetRetentionPreviewAsync(caseId, timeProvider.GetUtcNow(), retentionDays, cancellationToken));
}
