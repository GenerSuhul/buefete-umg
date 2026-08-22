using System.Reflection;
using Asp.Versioning;
using BufeteJuridico.Api.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[ApiController]
[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/system")]
public sealed class SystemController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<SystemInfoResponse>(StatusCodes.Status200OK)]
    public ActionResult<SystemInfoResponse> Get()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";
        return Ok(new SystemInfoResponse("Bufete Jurídico UMG API", version, DateTimeOffset.UtcNow));
    }
}
