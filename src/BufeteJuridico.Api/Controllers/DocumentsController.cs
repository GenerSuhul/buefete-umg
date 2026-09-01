using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Domain.Documents;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class DocumentsController(IDocumentService service) : ApiV1ControllerBase
{
    [HttpPost]
    [Authorize(Policy = Permissions.DocumentsWrite)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(27_000_000)]
    public async Task<ActionResult<DocumentDto>> Upload([FromForm] UploadDocumentForm form, CancellationToken cancellationToken)
    {
        await using var stream = form.File.OpenReadStream();
        var result = await service.StoreAsync(new StoreDocumentRequest(
            form.File.FileName,
            form.File.ContentType,
            form.File.Length,
            form.Source,
            form.ContextType,
            form.ContextId,
            form.Label,
            form.ReplaceDocumentId,
            stream), cancellationToken);
        return Created($"/api/v1/documents/{result.Id}", result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.DocumentsRead)]
    public async Task<ActionResult<DocumentDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetMetadataAsync(id, cancellationToken));

    [HttpGet]
    [Authorize(Policy = Permissions.DocumentsRead)]
    public async Task<ActionResult<PagedResult<DocumentDto>>> GetForContext(
        DocumentContextType? contextType,
        Guid? contextId,
        string? search,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetDocumentsAsync(contextType, contextId, search, page, pageSize, cancellationToken));

    [HttpGet("context/{contextType}/{contextId:guid}/history")]
    [Authorize(Policy = Permissions.DocumentsRead)]
    public async Task<ActionResult<PagedResult<DocumentDto>>> GetHistory(
        DocumentContextType contextType,
        Guid contextId,
        string? label,
        int page = 1,
        int pageSize = 100,
        CancellationToken cancellationToken = default) =>
        Ok(await service.GetForContextAsync(contextType, contextId, label, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}/content")]
    [Authorize(Policy = Permissions.DocumentsRead)]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var access = await service.GetDownloadAccessAsync(id, cancellationToken);
        if (access.RedirectUri is not null) return Redirect(access.RedirectUri.AbsoluteUri);
        return File(
            access.Content ?? throw new InvalidOperationException("El proveedor no devolvió contenido ni redirección."),
            access.ContentType,
            access.FileName,
            enableRangeProcessing: true);
    }

    [HttpGet("{id:guid}/access")]
    [Authorize(Policy = Permissions.DocumentsRead)]
    public async Task<ActionResult<DocumentReadUrlDto>> GetReadAccess(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetReadUrlAsync(id, cancellationToken));
}

public sealed class UploadDocumentForm
{
    public required IFormFile File { get; init; }

    public DocumentSource Source { get; init; } = DocumentSource.Upload;

    public DocumentContextType ContextType { get; init; }

    public Guid ContextId { get; init; }

    public string Label { get; init; } = string.Empty;

    public Guid? ReplaceDocumentId { get; init; }
}
