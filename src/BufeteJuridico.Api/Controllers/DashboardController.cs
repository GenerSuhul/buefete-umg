using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.CasesRead)]
public sealed class DashboardController(IDashboardService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get(CancellationToken cancellationToken) =>
        Ok(await service.GetAsync(cancellationToken));
}
