using BufeteJuridico.Application.Cases;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Cases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class CasesController(ICaseService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<CaseSummaryDto>>> GetAll(
        string? search,
        LegalCaseStatus? status,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetCasesAsync(search, status, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CaseDetailDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetCaseAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<CaseDetailDto>> Open(OpenCaseRequest request, CancellationToken cancellationToken)
    {
        var result = await service.OpenCaseAsync(request, cancellationToken);
        return Created($"/api/v1/cases/{result.Summary.Id}", result);
    }

    [HttpPut("{caseId:guid}/requirements/{requirementId:guid}")]
    public async Task<ActionResult<CaseRequirementDto>> UpdateRequirement(
        Guid caseId,
        Guid requirementId,
        UpdateCaseRequirementRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.UpdateRequirementAsync(caseId, requirementId, request, cancellationToken));

    [HttpPost("{caseId:guid}/assignments")]
    public async Task<ActionResult<CaseAssignmentDto>> AssignStudent(
        Guid caseId,
        AssignStudentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.AssignStudentAsync(caseId, request, cancellationToken);
        return Created($"/api/v1/cases/{caseId}/assignments/{result.Id}", result);
    }

    [HttpPost("{caseId:guid}/counterparties")]
    public async Task<ActionResult<CounterpartyDto>> AddCounterparty(
        Guid caseId,
        SaveCounterpartyRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.SaveCounterpartyAsync(caseId, null, request, cancellationToken);
        return Created($"/api/v1/cases/{caseId}/counterparties/{result.Id}", result);
    }

    [HttpPut("{caseId:guid}/counterparties/{counterpartyId:guid}")]
    public async Task<ActionResult<CounterpartyDto>> UpdateCounterparty(
        Guid caseId,
        Guid counterpartyId,
        SaveCounterpartyRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.SaveCounterpartyAsync(caseId, counterpartyId, request, cancellationToken));

    [HttpPut("{caseId:guid}/assignments/{assignmentId:guid}/end")]
    public async Task<IActionResult> EndAssignment(
        Guid caseId,
        Guid assignmentId,
        EndAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        await service.EndAssignmentAsync(caseId, assignmentId, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{caseId:guid}/timeline")]
    public async Task<ActionResult<TimelineEntryDto>> AddTimeline(
        Guid caseId,
        AddTimelineEntryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.AddTimelineEntryAsync(caseId, request, cancellationToken);
        return Created($"/api/v1/cases/{caseId}/timeline/{result.Id}", result);
    }

    [HttpPost("{caseId:guid}/memorials")]
    public async Task<ActionResult<MemorialDto>> CreateMemorial(
        Guid caseId,
        CreateMemorialRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.CreateMemorialAsync(caseId, request, cancellationToken);
        return Created($"/api/v1/cases/{caseId}/memorials/{result.Id}", result);
    }

    [HttpPost("{caseId:guid}/memorials/{memorialId:guid}/versions")]
    public async Task<ActionResult<MemorialDto>> AddMemorialVersion(
        Guid caseId,
        Guid memorialId,
        AddMemorialVersionRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.AddMemorialVersionAsync(caseId, memorialId, request, cancellationToken));

    [HttpPost("{caseId:guid}/memorials/{memorialId:guid}/reviews")]
    public async Task<ActionResult<MemorialDto>> ReviewMemorial(
        Guid caseId,
        Guid memorialId,
        ReviewMemorialRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.ReviewMemorialAsync(caseId, memorialId, request, cancellationToken));

    [HttpPost("{caseId:guid}/memorials/{memorialId:guid}/presentation")]
    public async Task<IActionResult> PresentMemorial(
        Guid caseId,
        Guid memorialId,
        PresentMemorialRequest request,
        CancellationToken cancellationToken)
    {
        await service.PresentMemorialAsync(caseId, memorialId, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{caseId:guid}/court-notifications")]
    public async Task<IActionResult> AddCourtNotification(
        Guid caseId,
        AddCourtNotificationRequest request,
        CancellationToken cancellationToken)
    {
        await service.AddCourtNotificationAsync(caseId, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{caseId:guid}/close")]
    public async Task<IActionResult> Close(Guid caseId, CloseCaseRequest request, CancellationToken cancellationToken)
    {
        await service.CloseCaseAsync(caseId, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{caseId:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid caseId, [FromBody] ReopenCaseRequest request, CancellationToken cancellationToken)
    {
        await service.ReopenCaseAsync(caseId, request.Reason, cancellationToken);
        return NoContent();
    }
}

public sealed record ReopenCaseRequest(string Reason);
