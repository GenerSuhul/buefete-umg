namespace BufeteJuridico.Infrastructure.Documents;

public enum StorageProviderType
{
    Local = 1,
    S3 = 2
}

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public StorageProviderType Provider { get; set; } = StorageProviderType.Local;

    public string RootPath { get; set; } = ".data/files";

    public long MaxFileSizeBytes { get; set; } = 25 * 1024 * 1024;

    public int DownloadUrlMinutes { get; set; } = 2;

    public S3StorageOptions S3 { get; set; } = new();
}

public sealed class S3StorageOptions
{
    public string BucketName { get; set; } = string.Empty;

    public string Region { get; set; } = "us-east-1";

    public string ServiceUrl { get; set; } = string.Empty;

    public bool ForcePathStyle { get; set; }

    public string AccessKey { get; set; } = string.Empty;

    public string SecretKey { get; set; } = string.Empty;

    public string KeyPrefix { get; set; } = "bufete";
}
