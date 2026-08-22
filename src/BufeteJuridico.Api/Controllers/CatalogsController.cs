using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Catalogs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class CatalogsController(ICatalogService service) : ApiV1ControllerBase
{
    [HttpGet("process-types")]
    [Authorize(Policy = Permissions.CatalogsRead)]
    public async Task<ActionResult<IReadOnlyList<ProcessTypeDto>>> GetProcessTypes(
        bool includeInactive = false,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetProcessTypesAsync(includeInactive, cancellationToken));

    [HttpGet("process-types/{id:guid}")]
    [Authorize(Policy = Permissions.CatalogsRead)]
    public async Task<ActionResult<ProcessTypeDto>> GetProcessType(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetProcessTypeAsync(id, cancellationToken));

    [HttpPost("process-types")]
    [Authorize(Policy = Permissions.CatalogsManage)]
    public async Task<ActionResult<ProcessTypeDto>> CreateProcessType(SaveProcessTypeRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateProcessTypeAsync(request, cancellationToken);
        return Created($"/api/v1/catalogs/process-types/{result.Id}", result);
    }

    [HttpPut("process-types/{id:guid}")]
    [Authorize(Policy = Permissions.CatalogsManage)]
    public async Task<ActionResult<ProcessTypeDto>> UpdateProcessType(Guid id, SaveProcessTypeRequest request, CancellationToken cancellationToken) =>
        Ok(await service.UpdateProcessTypeAsync(id, request, cancellationToken));

    [HttpPost("requirements")]
    [Authorize(Policy = Permissions.CatalogsManage)]
    public async Task<ActionResult<RequirementDefinitionDto>> CreateRequirement(SaveRequirementDefinitionRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateRequirementAsync(request, cancellationToken);
        return Created($"/api/v1/catalogs/requirements/{result.Id}", result);
    }

    [HttpPut("requirements/{id:guid}")]
    [Authorize(Policy = Permissions.CatalogsManage)]
    public async Task<ActionResult<RequirementDefinitionDto>> UpdateRequirement(Guid id, SaveRequirementDefinitionRequest request, CancellationToken cancellationToken) =>
        Ok(await service.UpdateRequirementAsync(id, request, cancellationToken));

    [HttpGet("student-requirements")]
    [Authorize(Policy = Permissions.CatalogsRead)]
    public async Task<ActionResult<IReadOnlyList<RequirementDefinitionDto>>> GetStudentRequirements(CancellationToken cancellationToken) =>
        Ok(await service.GetStudentRequirementsAsync(cancellationToken));
}
