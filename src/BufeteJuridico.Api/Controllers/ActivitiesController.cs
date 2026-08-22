using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Operations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class ActivitiesController(IActivityReportService service) : ApiV1ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.ActivitiesRead)]
    public async Task<ActionResult<PagedResult<ActivityDto>>> Get(
        DateTimeOffset? from,
        DateTimeOffset? to,
        Guid? userId,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetActivitiesAsync(from, to, userId, page, pageSize, cancellationToken));

    [HttpPost]
    [Authorize(Policy = Permissions.ActivitiesWrite)]
    public async Task<ActionResult<ActivityDto>> Create(SaveActivityRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateActivityAsync(request, cancellationToken);
        return Created($"/api/v1/activities/{result.Id}", result);
    }

    [HttpPut("{id:guid}/correction")]
    [Authorize(Policy = Permissions.ActivitiesWrite)]
    public async Task<ActionResult<ActivityDto>> Correct(Guid id, SaveActivityRequest request, CancellationToken cancellationToken) =>
        Ok(await service.CorrectActivityAsync(id, request, cancellationToken));
}
