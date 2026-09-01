using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Operations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class ReportsController(IActivityReportService service) : ApiV1ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.ReportsGenerate)]
    public async Task<ActionResult<PagedResult<WeeklyReportDto>>> GetAll(
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetReportsAsync(page, pageSize, cancellationToken));

    [HttpPost("weekly")]
    [Authorize(Policy = Permissions.ReportsGenerate)]
    public async Task<ActionResult<WeeklyReportDto>> GenerateWeekly(GenerateWeeklyReportRequest request, CancellationToken cancellationToken)
    {
        var result = await service.GenerateWeeklyReportAsync(request.Start, request.End, cancellationToken);
        return Created($"/api/v1/reports/{result.Id}", result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.ReportsGenerate)]
    public async Task<ActionResult<WeeklyReportDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetReportAsync(id, cancellationToken));

    [HttpGet("{id:guid}/print")]
    [Authorize(Policy = Permissions.ReportsGenerate)]
    [Produces("text/html")]
    public async Task<ContentResult> Print(Guid id, CancellationToken cancellationToken)
    {
        var report = await service.GetReportAsync(id, cancellationToken);
        return Content(report.PrintableHtml, "text/html", System.Text.Encoding.UTF8);
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = Permissions.ReportsGenerate)]
    public async Task<ActionResult<WeeklyReportDto>> Review(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.ReviewReportAsync(id, cancellationToken));

    [HttpPost("{id:guid}/send")]
    [Authorize(Policy = Permissions.ReportsSend)]
    public async Task<ActionResult<WeeklyReportDto>> Send(Guid id, SendReportRequest request, CancellationToken cancellationToken) =>
        Ok(await service.SendReportAsync(id, request, cancellationToken));
}

public sealed record GenerateWeeklyReportRequest(DateOnly Start, DateOnly End);
