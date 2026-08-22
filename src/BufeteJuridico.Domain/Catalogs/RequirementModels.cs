using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Catalogs;

public enum RequirementScope
{
    Process = 1,
    StudentEnrollment = 2,
    ClientGeneral = 3
}

public enum RequirementKind
{
    Document = 1,
    Data = 2,
    Condition = 3
}

public enum DocumentNature
{
    NotApplicable = 0,
    Original = 1,
    Copy = 2,
    Photocopy = 3
}

public sealed class ProcessType : AuditableEntity
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public ICollection<RequirementDefinition> Requirements { get; set; } = [];
}

public sealed class RequirementDefinition : AuditableEntity
{
    public RequirementScope Scope { get; set; }

    public Guid? ProcessTypeId { get; set; }

    public ProcessType? ProcessType { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public RequirementKind Kind { get; set; }

    public bool IsRequired { get; set; }

    public bool IsConditional { get; set; }

    public string? ConditionDescription { get; set; }

    public DocumentNature DocumentNature { get; set; }

    public int? MaximumAgeDays { get; set; }

    public string? Subject { get; set; }

    public string? Instructions { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
