using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.ClientsRead)]
public sealed class SearchController(IQueryService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<SearchResultDto>>> Search(
        string term,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.SearchAsync(term, page, pageSize, cancellationToken));
}
