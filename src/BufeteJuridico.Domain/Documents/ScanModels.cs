using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Documents;

public enum ScanSessionStatus
{
    Created = 1,
    Captured = 2,
    Completed = 3,
    Cancelled = 4,
    Failed = 5,
    Expired = 6
}

public enum ScanPageSource
{
    Scanner = 1,
    Upload = 2,
    PdfImport = 3
}

public enum ScanPageStatus
{
    Ready = 1,
    Removed = 2,
    Failed = 3
}

public sealed class ScanSession : AuditableEntity
{
    public ScanSessionStatus Status { get; set; } = ScanSessionStatus.Created;

    public DocumentContextType ContextType { get; set; }

    public Guid ContextId { get; set; }

    public string Label { get; set; } = string.Empty;

    public Guid? ReplaceDocumentId { get; set; }

    public string AcquisitionProvider { get; set; } = string.Empty;

    public string? DeviceId { get; set; }

    public string? DeviceName { get; set; }

    public int? ResolutionDpi { get; set; }

    public string? ColorMode { get; set; }

    public bool? Duplex { get; set; }

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? CapturedAtUtc { get; set; }

    public DateTimeOffset? PreviewedAtUtc { get; set; }

    public string? StagedStorageKey { get; set; }

    public string? StagedFileName { get; set; }

    public string? StagedContentType { get; set; }

    public long? StagedSizeBytes { get; set; }

    public string? StagedSha256 { get; set; }

    public int? PageCount { get; set; }

    public Guid? DocumentId { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public DateTimeOffset? CancelledAtUtc { get; set; }

    public string? FailureCode { get; set; }

    public string? FailureMessage { get; set; }

    public DateTimeOffset? LastSavedAtUtc { get; set; }

    public ICollection<ScanPage> Pages { get; set; } = [];
}

public sealed class ScanPage : AuditableEntity
{
    public Guid ScanSessionId { get; set; }

    public ScanSession ScanSession { get; set; } = null!;

    public Guid ClientPageId { get; set; }

    public int Position { get; set; }

    public ScanPageSource Source { get; set; }

    public ScanPageStatus Status { get; set; } = ScanPageStatus.Ready;

    public string OriginalStorageKey { get; set; } = string.Empty;

    public string OriginalFileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public int? SourcePageNumber { get; set; }

    public int? WidthPixels { get; set; }

    public int? HeightPixels { get; set; }

    public int RotationDegrees { get; set; }

    public DateTimeOffset? RemovedAtUtc { get; set; }

    public Guid? RemovedByUserId { get; set; }
}
