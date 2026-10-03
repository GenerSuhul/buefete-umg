using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Students;

namespace BufeteJuridico.Application.Students;

public sealed record StudentDto(
    Guid Id,
    Guid? UserAccountId,
    Guid? PhotoDocumentId,
    string FullName,
    DateOnly? BirthDate,
    int? AgeAtRegistration,
    string StudentCardNumber,
    string Dpi,
    int? Semester,
    string? StudyShift,
    string? Workplace,
    string? WorkPhone,
    string? ImmediateSupervisor,
    string? JobTitle,
    string ResidenceAddress,
    string? MobilePhone,
    string? HomePhone,
    string Email,
    DateOnly RegistrationDate,
    bool IsActive,
    Guid ConcurrencyToken);

public sealed record StudentAssignmentCandidateDto(
    Guid Id,
    Guid? PhotoDocumentId,
    string FullName,
    string StudentCardNumber);

public sealed record SaveStudentRequest(
    string FullName,
    DateOnly? BirthDate,
    int? AgeAtRegistration,
    string StudentCardNumber,
    string Dpi,
    int? Semester,
    string? StudyShift,
    string? Workplace,
    string? WorkPhone,
    string? ImmediateSupervisor,
    string? JobTitle,
    string ResidenceAddress,
    string? MobilePhone,
    string? HomePhone,
    string Email,
    DateOnly RegistrationDate,
    Guid? ConcurrencyToken = null);

public sealed record EnrollmentApplicationDto(
    Guid Id,
    Guid StudentId,
    PracticeModality Modality,
    EnrollmentStatus Status,
    string? SiteName,
    string? SiteAddress,
    string? Shift,
    string? PracticeDays,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTimeOffset? SubmittedAtUtc,
    DateTimeOffset? AdmittedAtUtc,
    DateTimeOffset? ResolvedAtUtc,
    string? ResolutionNotes,
    Guid? ResolutionDocumentId,
    string? ClinicCardNumber,
    DateOnly? ClinicCardIssuedDate,
    DateOnly? ClinicCardExpirationDate,
    DateTimeOffset? ClinicCardDeliveredAtUtc,
    IReadOnlyList<StudentRequirementDto> Requirements);

public sealed record StudentRequirementDto(
    Guid Id,
    Guid RequirementDefinitionId,
    string Label,
    RequirementKind Kind,
    bool IsRequired,
    bool IsConditional,
    RequirementFulfillmentStatus Status,
    Guid? DocumentId,
    string? DataValue,
    DateOnly? DocumentIssueDate,
    string? Notes);

public sealed record CreateEnrollmentRequest(
    PracticeModality Modality,
    EnrollmentStatus InitialStatus,
    string? SiteName,
    string? SiteAddress,
    string? Shift,
    string? PracticeDays,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    DateOnly? StartDate,
    DateOnly? EndDate);

public sealed record StudentAccessRequest(
    string Password,
    DateOnly? ParticipationStartDate,
    DateOnly? ParticipationEndDate);

public sealed record RegisterStudentRequest(
    SaveStudentRequest Student,
    CreateEnrollmentRequest Enrollment,
    StudentAccessRequest Access);

public sealed record StudentAccessDto(
    Guid UserAccountId,
    string Username,
    string Email,
    bool IsActive);

public sealed record StudentRegistrationDto(
    StudentDto Student,
    EnrollmentApplicationDto Enrollment,
    StudentAccessDto Access);

public sealed record ChangeEnrollmentStatusRequest(
    EnrollmentStatus Status,
    string? ResolutionNotes,
    Guid? ResolutionDocumentId);

public sealed record SetStudentActiveRequest(bool IsActive);

public sealed record IssueClinicCardRequest(
    string CardNumber,
    DateOnly IssuedDate,
    DateOnly? ExpirationDate,
    bool MarkDelivered);

public sealed record UpdateStudentRequirementRequest(
    RequirementFulfillmentStatus Status,
    Guid? DocumentId,
    string? DataValue,
    DateOnly? DocumentIssueDate,
    string? Notes);

public sealed record StudentCaseDto(
    Guid AssignmentId,
    Guid CaseId,
    string CaseNumber,
    string ClientName,
    string ProcessType,
    string Status,
    string Stage,
    bool IsPrimary,
    CaseAssignmentStatus AssignmentStatus,
    DateTimeOffset AssignedAtUtc,
    DateTimeOffset? EndedAtUtc,
    string? EndReason,
    string? LastStep,
    DateTimeOffset? LastStepAtUtc);

public sealed record StudentProfileDto(
    StudentDto Student,
    IReadOnlyList<EnrollmentApplicationDto> Enrollments,
    IReadOnlyList<StudentCaseDto> Cases);

public interface IStudentService
{
    Task<PagedResult<StudentDto>> GetStudentsAsync(string? search, int page, int pageSize, CancellationToken cancellationToken);

    Task<StudentDto> GetStudentAsync(Guid id, CancellationToken cancellationToken);

    Task<PagedResult<StudentAssignmentCandidateDto>> GetAssignmentCandidatesAsync(
        Guid caseId,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task<StudentProfileDto> GetStudentProfileAsync(Guid id, CancellationToken cancellationToken);

    Task<StudentDto> CreateStudentAsync(SaveStudentRequest request, CancellationToken cancellationToken);

    Task<StudentRegistrationDto> RegisterStudentAsync(RegisterStudentRequest request, CancellationToken cancellationToken);

    Task<StudentAccessDto> ProvisionAccessAsync(Guid studentId, StudentAccessRequest request, CancellationToken cancellationToken);

    Task<StudentDto> UpdateStudentAsync(Guid id, SaveStudentRequest request, CancellationToken cancellationToken);

    Task<StudentDto> SetStudentActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken);

    Task<EnrollmentApplicationDto> CreateEnrollmentAsync(Guid studentId, CreateEnrollmentRequest request, CancellationToken cancellationToken);

    Task<EnrollmentApplicationDto> ChangeEnrollmentStatusAsync(Guid enrollmentId, ChangeEnrollmentStatusRequest request, CancellationToken cancellationToken);

    Task<EnrollmentApplicationDto> IssueClinicCardAsync(Guid enrollmentId, IssueClinicCardRequest request, CancellationToken cancellationToken);

    Task<EnrollmentApplicationDto> UpdateRequirementAsync(Guid enrollmentId, Guid requirementId, UpdateStudentRequirementRequest request, CancellationToken cancellationToken);
}
