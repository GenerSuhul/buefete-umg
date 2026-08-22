using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Students;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class StudentsController(IStudentService service) : ApiV1ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<StudentDto>>> GetAll(
        string? search, int page = 1, int pageSize = 25, CancellationToken cancellationToken = default) =>
        Ok(await service.GetStudentsAsync(search, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudentDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetStudentAsync(id, cancellationToken));

    [HttpGet("{id:guid}/profile")]
    public async Task<ActionResult<StudentProfileDto>> GetProfile(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetStudentProfileAsync(id, cancellationToken));

    [HttpPost("registration")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<StudentRegistrationDto>> Register(
        RegisterStudentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.RegisterStudentAsync(request, cancellationToken);
        return Created($"/api/v1/students/{result.Student.Id}", result);
    }

    [HttpPost("{studentId:guid}/access")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<StudentAccessDto>> ProvisionAccess(
        Guid studentId,
        StudentAccessRequest request,
        CancellationToken cancellationToken)
    {
        var result = await service.ProvisionAccessAsync(studentId, request, cancellationToken);
        return Created($"/api/v1/users/{result.UserAccountId}", result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<StudentDto>> Update(Guid id, SaveStudentRequest request, CancellationToken cancellationToken) =>
        Ok(await service.UpdateStudentAsync(id, request, cancellationToken));

    [HttpPut("{id:guid}/active")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<StudentDto>> SetActive(Guid id, SetStudentActiveRequest request, CancellationToken cancellationToken) =>
        Ok(await service.SetStudentActiveAsync(id, request.IsActive, cancellationToken));

    [HttpPost("{studentId:guid}/enrollments")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<EnrollmentApplicationDto>> CreateEnrollment(Guid studentId, CreateEnrollmentRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateEnrollmentAsync(studentId, request, cancellationToken);
        return Created($"/api/v1/students/{studentId}/enrollments/{result.Id}", result);
    }

    [HttpPut("enrollments/{enrollmentId:guid}/status")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<EnrollmentApplicationDto>> ChangeEnrollmentStatus(
        Guid enrollmentId,
        ChangeEnrollmentStatusRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.ChangeEnrollmentStatusAsync(enrollmentId, request, cancellationToken));

    [HttpPut("enrollments/{enrollmentId:guid}/clinic-card")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<EnrollmentApplicationDto>> IssueClinicCard(
        Guid enrollmentId,
        IssueClinicCardRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.IssueClinicCardAsync(enrollmentId, request, cancellationToken));

    [HttpPut("enrollments/{enrollmentId:guid}/requirements/{requirementId:guid}")]
    [Authorize(Policy = Permissions.StudentsWrite)]
    public async Task<ActionResult<EnrollmentApplicationDto>> UpdateRequirement(
        Guid enrollmentId,
        Guid requirementId,
        UpdateStudentRequirementRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.UpdateRequirementAsync(enrollmentId, requirementId, request, cancellationToken));
}
