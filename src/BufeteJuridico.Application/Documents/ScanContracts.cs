using BufeteJuridico.Domain.Documents;

namespace BufeteJuridico.Application.Documents;

public sealed class ScannerOptions
{
    public const string SectionName = "Scanner";

    public int SessionMinutes { get; set; } = 30;

    public int MaximumPages { get; set; } = 200;

    public int CleanupIntervalMinutes { get; set; } = 15;

    public int DraftRetentionDays { get; set; } = 30;
}

public sealed record CreateScanSessionRequest(
    DocumentContextType ContextType,
    Guid ContextId,
    string Label,
    Guid? ReplaceDocumentId,
    string AcquisitionProvider,
    string? DeviceId,
    string? DeviceName,
    int? ResolutionDpi,
    string? ColorMode,
    bool? Duplex);

public sealed record StoreScanCaptureRequest(
    string FileName,
    string ContentType,
    long SizeBytes,
    int PageCount,
    Stream Content);

public sealed record StoreScanPagesRequest(
    Guid ClientPageId,
    ScanPageSource Source,
    string FileName,
    string ContentType,
    long SizeBytes,
    int? WidthPixels,
    int? HeightPixels,
    Stream Content);

public sealed record ReorderScanPagesRequest(IReadOnlyList<Guid> PageIds);

public sealed record RotateScanPageRequest(int RotationDegrees);

public sealed record ReportScanFailureRequest(string Code, string Message);

public sealed record ScanSessionDto(
    Guid Id,
    ScanSessionStatus Status,
    DocumentContextType ContextType,
    Guid ContextId,
    string Label,
    Guid? ReplaceDocumentId,
    string AcquisitionProvider,
    string? DeviceId,
    string? DeviceName,
    int? ResolutionDpi,
    string? ColorMode,
    bool? Duplex,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset? CapturedAtUtc,
    DateTimeOffset? PreviewedAtUtc,
    string? CapturedFileName,
    string? CapturedContentType,
    long? CapturedSizeBytes,
    string? CapturedSha256,
    int? PageCount,
    Guid? DocumentId,
    DateTimeOffset? CompletedAtUtc,
    DateTimeOffset? CancelledAtUtc,
    string? FailureCode,
    string? FailureMessage,
    Guid? CreatedByUserId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? LastSavedAtUtc,
    IReadOnlyList<ScanPageDto> Pages);

public sealed record ScanPageDto(
    Guid Id,
    Guid ClientPageId,
    int Position,
    ScanPageSource Source,
    ScanPageStatus Status,
    string OriginalFileName,
    string ContentType,
    long SizeBytes,
    string Sha256,
    int? SourcePageNumber,
    int? WidthPixels,
    int? HeightPixels,
    int RotationDegrees,
    DateTimeOffset CreatedAtUtc,
    Guid? CreatedByUserId);

public sealed record ScanPreviewContent(string FileName, string ContentType, Stream Content);

public sealed record ScanPageContent(string FileName, string ContentType, Stream Content);

public interface IScanSessionService
{
    Task<ScanSessionDto> CreateAsync(CreateScanSessionRequest request, CancellationToken cancellationToken);

    Task<ScanSessionDto> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<ScanSessionDto>> GetDraftsAsync(CancellationToken cancellationToken);

    Task<ScanSessionDto> AddPagesAsync(Guid id, StoreScanPagesRequest request, CancellationToken cancellationToken);

    Task<ScanPageContent> OpenPageAsync(Guid id, Guid pageId, CancellationToken cancellationToken);

    Task<ScanSessionDto> ReorderPagesAsync(Guid id, ReorderScanPagesRequest request, CancellationToken cancellationToken);

    Task<ScanSessionDto> RotatePageAsync(Guid id, Guid pageId, RotateScanPageRequest request, CancellationToken cancellationToken);

    Task<ScanSessionDto> RemovePageAsync(Guid id, Guid pageId, CancellationToken cancellationToken);

    Task<ScanSessionDto> SaveDraftAsync(Guid id, CancellationToken cancellationToken);

    Task<ScanSessionDto> CaptureAsync(Guid id, StoreScanCaptureRequest request, CancellationToken cancellationToken);

    Task<ScanPreviewContent> OpenPreviewAsync(Guid id, CancellationToken cancellationToken);

    Task<DocumentDto> CompleteAsync(Guid id, CancellationToken cancellationToken);

    Task<ScanSessionDto> CancelAsync(Guid id, CancellationToken cancellationToken);

    Task<ScanSessionDto> ReportFailureAsync(Guid id, ReportScanFailureRequest request, CancellationToken cancellationToken);
}
