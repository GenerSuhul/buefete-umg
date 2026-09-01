using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Documents;

namespace BufeteJuridico.Application.Documents;

public sealed record DocumentDto(
    Guid Id,
    string OriginalFileName,
    string ContentType,
    long SizeBytes,
    string Sha256,
    DocumentSource Source,
    DocumentContextType ContextType,
    Guid ContextId,
    string Label,
    int VersionNumber,
    Guid? PreviousVersionId,
    bool IsCurrent,
    int? PageCount,
    DateTimeOffset CreatedAtUtc,
    Guid? CreatedByUserId);

public sealed record StoreDocumentRequest(
    string OriginalFileName,
    string ContentType,
    long SizeBytes,
    DocumentSource Source,
    DocumentContextType ContextType,
    Guid ContextId,
    string Label,
    Guid? ReplaceDocumentId,
    Stream Content);

public sealed record DocumentDownloadAccess(
    string FileName,
    string ContentType,
    Stream? Content,
    Uri? RedirectUri);

public sealed record DocumentReadUrlDto(
    string FileName,
    string ContentType,
    string? Url,
    DateTimeOffset? ExpiresAtUtc);

public interface IDocumentService
{
    Task<DocumentDto> StoreAsync(StoreDocumentRequest request, CancellationToken cancellationToken);

    Task<DocumentDto> GetMetadataAsync(Guid id, CancellationToken cancellationToken);

    Task<PagedResult<DocumentDto>> GetForContextAsync(
        DocumentContextType contextType,
        Guid contextId,
        string? label,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task<PagedResult<DocumentDto>> GetDocumentsAsync(
        DocumentContextType? contextType,
        Guid? contextId,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task<DocumentDownloadAccess> GetDownloadAccessAsync(Guid id, CancellationToken cancellationToken);

    Task<DocumentReadUrlDto> GetReadUrlAsync(Guid id, CancellationToken cancellationToken);

    Task EnsureContextAccessAsync(DocumentContextType contextType, Guid contextId, bool write, CancellationToken cancellationToken);

    Task EnsureDocumentMatchesContextAsync(Guid documentId, DocumentContextType contextType, Guid contextId, CancellationToken cancellationToken);
}

public interface IFileStorage
{
    Task<StoredFile> StoreAsync(string extension, string contentType, Stream content, CancellationToken cancellationToken);

    Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken);

    Task DeleteAsync(string storageKey, CancellationToken cancellationToken);

    Task<Uri?> CreateReadUrlAsync(
        string storageKey,
        string fileName,
        string contentType,
        TimeSpan lifetime,
        CancellationToken cancellationToken);
}

public sealed record StoredFile(string StorageKey, long SizeBytes, string Sha256);
