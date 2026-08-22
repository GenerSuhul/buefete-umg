using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Documents;

internal sealed class S3StorageHealthCheck(
    IAmazonS3 client,
    IOptions<StorageOptions> options)
    : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await client.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = options.Value.S3.BucketName,
                MaxKeys = 1
            }, cancellationToken);
            return HealthCheckResult.Healthy("El almacenamiento de objetos está disponible.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("El almacenamiento de objetos no está disponible.", exception);
        }
    }
}
