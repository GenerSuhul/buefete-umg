using System.Net;
using BufeteJuridico.Api.Infrastructure.Errors;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace BufeteJuridico.IntegrationTests;

public sealed class GlobalExceptionHandlerTests
{
    [Fact]
    public async Task Integrity_constraint_violations_return_conflict_without_database_details()
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddOptions();
        serviceCollection.AddProblemDetails();
        var services = serviceCollection.BuildServiceProvider();
        var handler = new GlobalExceptionHandler(
            NullLogger<GlobalExceptionHandler>.Instance,
            services.GetRequiredService<IProblemDetailsService>());
        var context = new DefaultHttpContext
        {
            RequestServices = services,
            Response = { Body = new MemoryStream() }
        };
        var postgresException = new PostgresException(
            "duplicate key value violates unique constraint users_email",
            "ERROR",
            "ERROR",
            PostgresErrorCodes.UniqueViolation);

        var handled = await handler.TryHandleAsync(
            context,
            new DbUpdateException("The update failed.", postgresException),
            CancellationToken.None);

        context.Response.Body.Position = 0;
        var responseBody = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.True(handled);
        Assert.Equal((int)HttpStatusCode.Conflict, context.Response.StatusCode);
        Assert.DoesNotContain("users_email", responseBody, StringComparison.Ordinal);
        Assert.Contains("registro existente", responseBody, StringComparison.Ordinal);
    }
}
