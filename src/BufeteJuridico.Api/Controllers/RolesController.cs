using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.RolesManage)]
public sealed class RolesController(IUserManagementService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> Get(CancellationToken cancellationToken) =>
        Ok(await service.GetRolesAsync(cancellationToken));

    [HttpGet("permissions")]
    public async Task<ActionResult<IReadOnlyList<PermissionDto>>> GetPermissions(CancellationToken cancellationToken) =>
        Ok(await service.GetPermissionsAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<RoleDto>> Create(CreateRoleRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateRoleAsync(request, cancellationToken);
        return Created($"/api/v1/roles/{result.Id}", result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RoleDto>> Update(Guid id, UpdateRoleRequest request, CancellationToken cancellationToken) =>
        Ok(await service.UpdateRoleAsync(id, request, cancellationToken));
}
