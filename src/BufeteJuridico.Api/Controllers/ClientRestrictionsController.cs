using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Clients;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
[Route("api/v{version:apiVersion}/client-restrictions")]
public sealed class ClientRestrictionsController(IClientRestrictionService service) : ApiV1ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Administrador")]
    public async Task<IActionResult> List(string? dpi, int page = 1, int pageSize = 25, CancellationToken ct = default) =>
        Ok(await service.ListAsync(dpi, page, pageSize, ct));

    [HttpPost]
    [Authorize(Roles = "Administrador")]
    public async Task<IActionResult> Create(CreateClientRestrictionRequest request, CancellationToken ct) =>
        StatusCode(201, await service.CreateAsync(request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Administrador")]
    public async Task<IActionResult> Remove(Guid id, RemoveClientRestrictionRequest request, CancellationToken ct)
    {
        await service.RemoveAsync(id, request, ct);
        return NoContent();
    }

    [HttpPost("check")]
    [Authorize(Policy = Permissions.ClientsWrite)]
    public async Task<IActionResult> Check(CheckClientRestrictionRequest request, CancellationToken ct) =>
        Ok(await service.GetStatusAsync(request.Dpi, ct));
}
