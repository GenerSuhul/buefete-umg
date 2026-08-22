using BufeteJuridico.Domain.Catalogs;

namespace BufeteJuridico.Application.Catalogs;

public sealed record RequirementDefinitionDto(
    Guid Id,
    RequirementScope Scope,
    Guid? ProcessTypeId,
    string Code,
    string Label,
    RequirementKind Kind,
    bool IsRequired,
    bool IsConditional,
    string? ConditionDescription,
    DocumentNature DocumentNature,
    int? MaximumAgeDays,
    string? Subject,
    string? Instructions,
    int SortOrder,
    bool IsActive);

public sealed record ProcessTypeDto(
    Guid Id,
    string Code,
    string Name,
    string Description,
    bool IsActive,
    IReadOnlyList<RequirementDefinitionDto> Requirements);

public sealed record SaveProcessTypeRequest(
    string Code,
    string Name,
    string Description,
    bool IsActive);

public sealed record SaveRequirementDefinitionRequest(
    RequirementScope Scope,
    Guid? ProcessTypeId,
    string Code,
    string Label,
    RequirementKind Kind,
    bool IsRequired,
    bool IsConditional,
    string? ConditionDescription,
    DocumentNature DocumentNature,
    int? MaximumAgeDays,
    string? Subject,
    string? Instructions,
    int SortOrder,
    bool IsActive);

public interface ICatalogService
{
    Task<IReadOnlyList<ProcessTypeDto>> GetProcessTypesAsync(bool includeInactive, CancellationToken cancellationToken);

    Task<ProcessTypeDto> GetProcessTypeAsync(Guid id, CancellationToken cancellationToken);

    Task<ProcessTypeDto> CreateProcessTypeAsync(SaveProcessTypeRequest request, CancellationToken cancellationToken);

    Task<ProcessTypeDto> UpdateProcessTypeAsync(Guid id, SaveProcessTypeRequest request, CancellationToken cancellationToken);

    Task<RequirementDefinitionDto> CreateRequirementAsync(SaveRequirementDefinitionRequest request, CancellationToken cancellationToken);

    Task<RequirementDefinitionDto> UpdateRequirementAsync(Guid id, SaveRequirementDefinitionRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<RequirementDefinitionDto>> GetStudentRequirementsAsync(CancellationToken cancellationToken);
}
