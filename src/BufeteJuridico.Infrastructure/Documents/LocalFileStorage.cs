using System.Security.Cryptography;
using BufeteJuridico.Application.Documents;
using Microsoft.Extensions.Options;
using BufeteJuridico.Infrastructure.Tenancy;

namespace BufeteJuridico.Infrastructure.Documents;

internal sealed class LocalFileStorage : IFileStorage
{
    private readonly string rootPath;
    private readonly TenantContext tenant;

    public LocalFileStorage(IOptions<StorageOptions> options, TenantContext tenant)
    {
        this.tenant = tenant;
        rootPath = Path.GetFullPath(options.Value.RootPath, Directory.GetCurrentDirectory());
        Directory.CreateDirectory(rootPath);
    }

    public async Task<StoredFile> StoreAsync(
        string extension,
        string contentType,
        Stream content,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var relativeDirectory = Path.Combine("tenants", tenant.Code, now.ToString("yyyy"), now.ToString("MM"));
        var directory = Path.Combine(rootPath, relativeDirectory);
        Directory.CreateDirectory(directory);

        var safeExtension = extension.StartsWith(".", StringComparison.Ordinal) ? extension : $".{extension}";
        var fileName = $"{Guid.NewGuid():N}{safeExtension.ToLowerInvariant()}";
        var relativePath = Path.Combine(relativeDirectory, fileName).Replace('\\', '/');
        var absolutePath = ResolveSafePath(relativePath);

        try
        {
            await using var destination = new FileStream(
                absolutePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true);

            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var buffer = new byte[81920];
            long size = 0;
            int bytesRead;

            while ((bytesRead = await content.ReadAsync(buffer, cancellationToken)) > 0)
            {
                await destination.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
                hash.AppendData(buffer, 0, bytesRead);
                size += bytesRead;
            }

            await destination.FlushAsync(cancellationToken);
            return new StoredFile(relativePath, size, Convert.ToHexString(hash.GetHashAndReset()));
        }
        catch
        {
            if (File.Exists(absolutePath)) File.Delete(absolutePath);
            throw;
        }
    }

    public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = ResolveSafePath(storageKey);
        if (!File.Exists(path)) throw new FileNotFoundException("El archivo físico no está disponible.", path);

        Stream stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 81920,
            useAsync: true);

        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = ResolveSafePath(storageKey);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public Task<Uri?> CreateReadUrlAsync(
        string storageKey,
        string fileName,
        string contentType,
        TimeSpan lifetime,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult<Uri?>(null);
    }

    private string ResolveSafePath(string storageKey)
    {
        var path = Path.GetFullPath(storageKey, rootPath);
        var rootWithSeparator = rootPath.EndsWith(Path.DirectorySeparatorChar)
            ? rootPath
            : rootPath + Path.DirectorySeparatorChar;

        if (!path.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("La ruta de almacenamiento no es válida.");
        }

        return path;
    }
}
