using BufeteJuridico.Application.Students;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
[ApiController]
[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/students/{studentId:guid}/disciplines")]
public sealed class StudentDisciplinesController(IStudentDisciplineService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StudentDisciplineDto>>> List(Guid studentId, CancellationToken ct) =>
        Ok(await service.ListAsync(studentId, ct));

    [HttpPost]
    public async Task<ActionResult<StudentDisciplineDto>> Create(Guid studentId,
        CreateStudentDisciplineRequest request, CancellationToken ct)
    {
        var item = await service.CreateAsync(studentId, request, ct);
        return Created($"/api/v1/students/{studentId}/disciplines/{item.Id}", item);
    }

    [HttpPost("{id:guid}/revoke")]
    public async Task<ActionResult<StudentDisciplineDto>> Revoke(Guid studentId, Guid id,
        RevokeStudentDisciplineRequest request, CancellationToken ct) =>
        Ok(await service.RevokeAsync(studentId, id, request, ct));

    [HttpGet("{id:guid}/document")]
    public async Task<IActionResult> Document(Guid studentId, Guid id, CancellationToken ct)
    {
        var access = await service.GetDocumentAsync(studentId, id, ct);
        return File(access.Content!, access.ContentType);
    }
}
