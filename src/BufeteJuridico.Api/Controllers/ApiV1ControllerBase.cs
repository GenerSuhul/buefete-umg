using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[ApiController]
[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/[controller]")]
public abstract class ApiV1ControllerBase : ControllerBase;
