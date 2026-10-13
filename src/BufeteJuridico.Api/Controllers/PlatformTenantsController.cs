using BufeteJuridico.Application.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = "PlatformAdmin")]
[Route("api/v{version:apiVersion}/platform/tenants")]
public sealed class PlatformTenantsController(ITenantManagementService registry) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await registry.ListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Create(CreateTenantRequest request, CancellationToken ct) => Ok(await registry.CreateAsync(request, ct));

    [HttpPut("{code}")]
    public async Task<IActionResult> Update(string code, UpdateTenantRequest request, CancellationToken ct) => Ok(await registry.UpdateAsync(code, request, ct));

    [HttpPost("{code}/session")]
    public async Task<IActionResult> Switch(string code, CancellationToken ct) => Ok(await registry.SwitchAsync(code, ct));
}
