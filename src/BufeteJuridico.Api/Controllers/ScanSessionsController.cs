using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Domain.Documents;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize(Policy = Permissions.ScannerUse)]
[Route("api/v{version:apiVersion}/scan-sessions")]
public sealed class ScanSessionsController(IScanSessionService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ScanSessionDto>>> GetDrafts(CancellationToken cancellationToken) =>
        Ok(await service.GetDraftsAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ScanSessionDto>> Create(
        CreateScanSessionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.CreateAsync(request, cancellationToken);
        return Created($"/api/v1/scan-sessions/{result.Id}", result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ScanSessionDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetAsync(id, cancellationToken));

    [HttpPost("{id:guid}/pages")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(27_000_000)]
    public async Task<ActionResult<ScanSessionDto>> AddPages(
        Guid id,
        [FromForm] ScanPagesForm form,
        CancellationToken cancellationToken)
    {
        await using var stream = form.File.OpenReadStream();
        return Ok(await service.AddPagesAsync(id, new StoreScanPagesRequest(
            form.ClientPageId,
            form.Source,
            form.File.FileName,
            form.File.ContentType,
            form.File.Length,
            form.WidthPixels,
            form.HeightPixels,
            stream), cancellationToken));
    }

    [HttpGet("{id:guid}/pages/{pageId:guid}/content")]
    public async Task<IActionResult> OpenPage(Guid id, Guid pageId, CancellationToken cancellationToken)
    {
        var content = await service.OpenPageAsync(id, pageId, cancellationToken);
        return File(content.Content, content.ContentType, enableRangeProcessing: true);
    }

    [HttpPut("{id:guid}/pages/order")]
    public async Task<ActionResult<ScanSessionDto>> Reorder(
        Guid id,
        ReorderScanPagesRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.ReorderPagesAsync(id, request, cancellationToken));

    [HttpPut("{id:guid}/pages/{pageId:guid}/rotation")]
    public async Task<ActionResult<ScanSessionDto>> Rotate(
        Guid id,
        Guid pageId,
        RotateScanPageRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.RotatePageAsync(id, pageId, request, cancellationToken));

    [HttpDelete("{id:guid}/pages/{pageId:guid}")]
    public async Task<ActionResult<ScanSessionDto>> RemovePage(Guid id, Guid pageId, CancellationToken cancellationToken) =>
        Ok(await service.RemovePageAsync(id, pageId, cancellationToken));

    [HttpPost("{id:guid}/draft")]
    public async Task<ActionResult<ScanSessionDto>> SaveDraft(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.SaveDraftAsync(id, cancellationToken));

    [HttpPost("{id:guid}/capture")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(27_000_000)]
    public async Task<ActionResult<ScanSessionDto>> Capture(
        Guid id,
        [FromForm] ScanCaptureForm form,
        CancellationToken cancellationToken)
    {
        await using var stream = form.File.OpenReadStream();
        return Ok(await service.CaptureAsync(id, new StoreScanCaptureRequest(
            form.File.FileName,
            form.File.ContentType,
            form.File.Length,
            form.PageCount,
            stream), cancellationToken));
    }

    [HttpGet("{id:guid}/preview")]
    public async Task<IActionResult> Preview(Guid id, CancellationToken cancellationToken)
    {
        var content = await service.OpenPreviewAsync(id, cancellationToken);
        return File(content.Content, content.ContentType, enableRangeProcessing: true);
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<DocumentDto>> Complete(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.CompleteAsync(id, cancellationToken));

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<ScanSessionDto>> Cancel(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.CancelAsync(id, cancellationToken));

    [HttpPost("{id:guid}/failure")]
    public async Task<ActionResult<ScanSessionDto>> ReportFailure(
        Guid id,
        ReportScanFailureRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.ReportFailureAsync(id, request, cancellationToken));
}

public sealed class ScanCaptureForm
{
    public required IFormFile File { get; init; }

    public int PageCount { get; init; } = 1;
}

public sealed class ScanPagesForm
{
    public required IFormFile File { get; init; }

    public Guid ClientPageId { get; init; }

    public ScanPageSource Source { get; init; } = ScanPageSource.Upload;

    public int? WidthPixels { get; init; }

    public int? HeightPixels { get; init; }
}
