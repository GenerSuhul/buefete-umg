using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class UsersController(IUserManagementService service, ICurrentUser currentUser) : ApiV1ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.UsersRead)]
    public async Task<ActionResult<PagedResult<UserSummaryDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetUsersAsync(search, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.UsersRead)]
    public async Task<ActionResult<UserSummaryDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetUserAsync(id, cancellationToken));

    [HttpPost]
    [Authorize(Policy = Permissions.UsersWrite)]
    public async Task<ActionResult<UserSummaryDto>> Create(CreateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateUserAsync(request, cancellationToken);
        return Created($"/api/v1/users/{result.Id}", result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.UsersWrite)]
    public async Task<ActionResult<UserSummaryDto>> Update(Guid id, UpdateUserRequest request, CancellationToken cancellationToken) =>
        Ok(await service.UpdateUserAsync(id, request, cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.UsersDeactivate)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        await service.DeactivateUserAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/roles")]
    [Authorize(Policy = Permissions.RolesManage)]
    public async Task<IActionResult> AssignRole(Guid id, UserRoleAssignmentRequest request, CancellationToken cancellationToken)
    {
        await service.AssignRoleAsync(id, request, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/roles/{roleId:guid}")]
    [Authorize(Policy = Permissions.RolesManage)]
    public async Task<IActionResult> RemoveRole(Guid id, Guid roleId, CancellationToken cancellationToken)
    {
        await service.RemoveRoleAsync(id, roleId, cancellationToken);
        return NoContent();
    }

    [HttpPost("me/change-password")]
    public async Task<IActionResult> ChangeOwnPassword(ChangeOwnPasswordRequest request, CancellationToken cancellationToken)
    {
        await service.ChangeOwnPasswordAsync(request, cancellationToken);
        return NoContent();
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserSummaryDto>> UpdateOwnProfile(
        UpdateOwnProfileRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.UpdateOwnProfileAsync(request, cancellationToken));

    [HttpPost("{id:guid}/reset-password")]
    [Authorize(Policy = Permissions.UsersWrite)]
    public async Task<IActionResult> ResetPassword(Guid id, ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await service.ResetPasswordAsync(id, request, cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:guid}/photo")]
    [Authorize(Policy = Permissions.UsersWrite)]
    public async Task<ActionResult<UserSummaryDto>> SetPhoto(
        Guid id,
        SetUserPhotoRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.SetPhotoAsync(id, request, cancellationToken));

    [HttpPut("me/photo")]
    public async Task<ActionResult<UserSummaryDto>> SetOwnPhoto(
        SetUserPhotoRequest request,
        CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();
        return Ok(await service.SetPhotoAsync(userId, request, cancellationToken));
    }
}
