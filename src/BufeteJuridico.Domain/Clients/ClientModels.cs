using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Clients;

public sealed class Client : SoftDeletableEntity
{
    public string ReceptionNumber { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string NormalizedFullName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public int? AgeAtReception { get; set; }

    public string? BirthPlace { get; set; }

    public string? Nationality { get; set; }

    public string? Sex { get; set; }

    public string? MaritalStatus { get; set; }

    public string? Dpi { get; set; }

    public string ResidenceAddress { get; set; } = string.Empty;

    public string? Education { get; set; }

    public string? Occupation { get; set; }

    public string? Workplace { get; set; }

    public string? WorkAddress { get; set; }

    public string? WorkPhone { get; set; }

    public string? Phone { get; set; }

    public string? MobilePhone { get; set; }

    public decimal? SalaryAmount { get; set; }

    public string? SalaryFrequency { get; set; }

    public int ChildrenCount { get; set; }

    public string AssistanceRequested { get; set; } = string.Empty;

    public string? ClaimedAgainstPersonName { get; set; }

    public string? ClaimedAgainstPersonAddress { get; set; }

    public string ReceptionPlace { get; set; } = string.Empty;

    public DateOnly ReceptionDate { get; set; }

    public Guid? SignatureDocumentId { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<IncomeDeclaration> IncomeDeclarations { get; set; } = [];
}

public sealed class IncomeDeclaration : AuditableEntity
{
    public Guid ClientId { get; set; }

    public Client Client { get; set; } = null!;

    public string FullName { get; set; } = string.Empty;

    public int? DeclaredAge { get; set; }

    public string? MaritalStatus { get; set; }

    public string? Sex { get; set; }

    public string? Dpi { get; set; }

    public string? Occupation { get; set; }

    public string? Nationality { get; set; }

    public string ResidenceAddress { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public string? MobilePhone { get; set; }

    public string? Workplace { get; set; }

    public string? WorkAddress { get; set; }

    public decimal? SalaryAmount { get; set; }

    public string? SalaryFrequency { get; set; }

    public string Place { get; set; } = string.Empty;

    public DateOnly DeclarationDate { get; set; }

    public bool DeclaresLimitedResources { get; set; }

    public Guid? GeneratedDocumentId { get; set; }

    public Guid? SignedDocumentId { get; set; }
}
