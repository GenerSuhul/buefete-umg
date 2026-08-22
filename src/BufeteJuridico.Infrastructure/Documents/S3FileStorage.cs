using System.Security.Cryptography;
using Amazon.S3;
using Amazon.S3.Model;
using BufeteJuridico.Application.Documents;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Documents;

internal sealed class S3FileStorage(
    IAmazonS3 client,
    IOptions<StorageOptions> options)
    : IFileStorage
{
    private readonly S3StorageOptions settings = options.Value.S3;

    public async Task<StoredFile> StoreAsync(
        string extension,
        string contentType,
        Stream content,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var storageKey = string.Join('/',
            now.ToString("yyyy"),
            now.ToString("MM"),
            $"{Guid.NewGuid():N}{NormalizeExtension(extension)}");

        MemoryStream? buffer = null;
        var uploadStream = content;
        if (!content.CanSeek)
        {
            buffer = new MemoryStream();
            await content.CopyToAsync(buffer, cancellationToken);
            buffer.Position = 0;
            uploadStream = buffer;
        }

        try
        {
            var initialPosition = uploadStream.Position;
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var bytes = new byte[81920];
            long size = 0;
            int read;
            while ((read = await uploadStream.ReadAsync(bytes, cancellationToken)) > 0)
            {
                hash.AppendData(bytes, 0, read);
                size += read;
            }

            var sha256 = Convert.ToHexString(hash.GetHashAndReset());
            uploadStream.Position = initialPosition;

            await client.PutObjectAsync(new PutObjectRequest
            {
                BucketName = settings.BucketName,
                Key = ToObjectKey(storageKey),
                InputStream = uploadStream,
                ContentType = contentType,
                AutoCloseStream = false
            }, cancellationToken);

            return new StoredFile(storageKey, size, sha256);
        }
        finally
        {
            if (buffer is not null) await buffer.DisposeAsync();
        }
    }

    public async Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        var response = await client.GetObjectAsync(new GetObjectRequest
        {
            BucketName = settings.BucketName,
            Key = ToObjectKey(ValidateKey(storageKey))
        }, cancellationToken);
        return new OwnedResponseStream(response.ResponseStream, response);
    }

    public async Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        await client.DeleteObjectAsync(new DeleteObjectRequest
        {
            BucketName = settings.BucketName,
            Key = ToObjectKey(ValidateKey(storageKey))
        }, cancellationToken);
    }

    public async Task<Uri?> CreateReadUrlAsync(
        string storageKey,
        string fileName,
        string contentType,
        TimeSpan lifetime,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var url = await client.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = settings.BucketName,
            Key = ToObjectKey(ValidateKey(storageKey)),
            Verb = HttpVerb.GET,
            Protocol = Uri.TryCreate(settings.ServiceUrl, UriKind.Absolute, out var serviceUri) &&
                       serviceUri.Scheme == Uri.UriSchemeHttp
                ? Protocol.HTTP
                : Protocol.HTTPS,
            Expires = DateTime.UtcNow.Add(lifetime),
            ResponseHeaderOverrides = new ResponseHeaderOverrides
            {
                ContentType = contentType,
                ContentDisposition = $"inline; filename*=UTF-8''{Uri.EscapeDataString(fileName)}"
            }
        });
        return new Uri(url, UriKind.Absolute);
    }

    private string ValidateKey(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey) ||
            storageKey.StartsWith("/", StringComparison.Ordinal) ||
            storageKey.Contains("..", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("La clave del objeto no es válida.");
        }

        return storageKey;
    }

    private string ToObjectKey(string storageKey)
    {
        var prefix = settings.KeyPrefix.Trim('/');
        return string.IsNullOrWhiteSpace(prefix) ? storageKey : $"{prefix}/{storageKey}";
    }

    private static string NormalizeExtension(string extension) =>
        extension.StartsWith(".", StringComparison.Ordinal)
            ? extension.ToLowerInvariant()
            : $".{extension.ToLowerInvariant()}";

    private sealed class OwnedResponseStream(Stream inner, IDisposable owner) : Stream
    {
        public override bool CanRead => inner.CanRead;

        public override bool CanSeek => inner.CanSeek;

        public override bool CanWrite => false;

        public override long Length => inner.Length;

        public override long Position
        {
            get => inner.Position;
            set => inner.Position = value;
        }

        public override void Flush() => inner.Flush();

        public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) =>
            inner.ReadAsync(buffer, cancellationToken);

        public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                inner.Dispose();
                owner.Dispose();
            }

            base.Dispose(disposing);
        }

        public override async ValueTask DisposeAsync()
        {
            await inner.DisposeAsync();
            owner.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
