using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BufeteJuridico.Api.Controllers;

[Route("api/v{version:apiVersion}/auth")]
public sealed class AuthController(
    IAuthenticationService authenticationService,
    IUserManagementService userManagementService,
    ICurrentUser currentUser) : ApiV1ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [ProducesResponseType<TokenResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<TokenResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken) =>
        Ok(await authenticationService.LoginAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken));

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [ProducesResponseType<TokenResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<TokenResponse>> Refresh(
        RefreshRequest request,
        CancellationToken cancellationToken) =>
        Ok(await authenticationService.RefreshAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken));

    [HttpPost("revoke")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Revoke(RefreshRequest request, CancellationToken cancellationToken)
    {
        await authenticationService.RevokeAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<UserSummaryDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserSummaryDto>> Me(CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();
        return Ok(await userManagementService.GetUserAsync(userId, cancellationToken));
    }
}
