using System.Diagnostics;
using BufeteJuridico.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Api.Infrastructure.Errors;

public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            ValidationException => (StatusCodes.Status400BadRequest, "La solicitud no es válida.", exception.Message),
            AuthenticationException => (StatusCodes.Status401Unauthorized, "Autenticación rechazada.", exception.Message),
            ForbiddenException => (StatusCodes.Status403Forbidden, "Acceso denegado.", exception.Message),
            NotFoundException => (StatusCodes.Status404NotFound, "Registro no encontrado.", exception.Message),
            ConflictException => (StatusCodes.Status409Conflict, "La operación entra en conflicto con el estado actual.", exception.Message),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "El registro fue modificado por otra persona.", "Actualice la información e intente nuevamente."),
            _ => (StatusCodes.Status500InternalServerError, "Ocurrió un error interno.", "La solicitud no pudo completarse.")
        };

        if (status >= 500)
            logger.LogError(exception, "Error no controlado. TraceId: {TraceId}", httpContext.TraceIdentifier);
        else
            logger.LogWarning(exception, "Solicitud rechazada con estado {Status}. TraceId: {TraceId}", status, httpContext.TraceIdentifier);

        httpContext.Response.StatusCode = status;
        ProblemDetails problemDetails;
        if (exception is ValidationException validation)
        {
            problemDetails = new ValidationProblemDetails(validation.Errors.ToDictionary())
            {
                Status = status,
                Title = title,
                Detail = detail,
                Instance = httpContext.Request.Path
            };
        }
        else
        {
            problemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = detail,
                Instance = httpContext.Request.Path
            };
        }

        problemDetails.Extensions["traceId"] = Activity.Current?.Id ?? httpContext.TraceIdentifier;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problemDetails,
            Exception = exception
        });
    }
}
