using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Students;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
[Route("api/v{version:apiVersion}/student-legal-studies")]
public sealed class StudentLegalStudiesController(IStudentLegalStudyService service) : ApiV1ControllerBase
{
    [HttpGet("{studentId:guid}")]
    public async Task<ActionResult<StudentLegalStudyDto>> Get(Guid studentId, CancellationToken cancellationToken) =>
        Ok(await service.GetAsync(studentId, cancellationToken));

    [HttpPost("{studentId:guid}/reviews")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<StudentLegalStudyDto>> Review(Guid studentId, AddLegalStudyReviewRequest request, CancellationToken cancellationToken) =>
        Ok(await service.AddReviewAsync(studentId, request, cancellationToken));

    [HttpPost("{studentId:guid}/delivery")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<StudentLegalStudyDto>> Deliver(Guid studentId, DeliverLegalStudyRequest request, CancellationToken cancellationToken) =>
        Ok(await service.DeliverAsync(studentId, request, cancellationToken));

    [HttpGet("closures")]
    [Authorize(Policy = Permissions.StudentsRead)]
    public async Task<ActionResult<PagedResult<StudentPracticeClosureDto>>> Closures(string? search, int page = 1, int pageSize = 25,
        CancellationToken cancellationToken = default) => Ok(await service.GetClosuresAsync(search, page, pageSize, cancellationToken));
}
