using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Auditing;
using BufeteJuridico.Infrastructure.Persistence;

namespace BufeteJuridico.Api.Infrastructure.Auditing;

internal sealed class RequestAuditMiddleware(RequestDelegate next, ILogger<RequestAuditMiddleware> logger)
{
    public async Task InvokeAsync(
        HttpContext context,
        ICurrentUser currentUser,
        BufeteDbContext dbContext,
        TimeProvider timeProvider)
    {
        await next(context);

        if (!currentUser.IsAuthenticated ||
            context.Request.Path.StartsWithSegments("/health") ||
            context.Request.Path.StartsWithSegments("/openapi") ||
            context.RequestAborted.IsCancellationRequested)
        {
            return;
        }

        try
        {
            var path = context.Request.Path.Value ?? "/";
            dbContext.AuditLogs.Add(new AuditLog
            {
                UserId = currentUser.UserId,
                Username = currentUser.Username,
                OccurredAtUtc = timeProvider.GetUtcNow(),
                Action = $"{context.Request.Method}:{context.Response.StatusCode}",
                EntityType = "HttpRequest",
                EntityId = path.Length > 80 ? path[..80] : path,
                TraceId = currentUser.TraceId,
                IpAddress = currentUser.IpAddress
            });
            await dbContext.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "No se pudo persistir la auditoría HTTP para {Path}.", context.Request.Path);
        }
    }
}
