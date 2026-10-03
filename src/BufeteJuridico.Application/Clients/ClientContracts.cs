using BufeteJuridico.Application.Common;

namespace BufeteJuridico.Application.Clients;

public sealed record ClientDto(
    Guid Id,
    string ReceptionNumber,
    string FullName,
    DateOnly? BirthDate,
    int? AgeAtReception,
    string? BirthPlace,
    string? Nationality,
    string? Sex,
    string? MaritalStatus,
    string? Dpi,
    string ResidenceAddress,
    string? Education,
    string? Occupation,
    string? Workplace,
    string? WorkAddress,
    string? WorkPhone,
    string? Phone,
    string? MobilePhone,
    decimal? SalaryAmount,
    string? SalaryFrequency,
    int ChildrenCount,
    string AssistanceRequested,
    string? ClaimedAgainstPersonName,
    string? ClaimedAgainstPersonAddress,
    string ReceptionPlace,
    DateOnly ReceptionDate,
    Guid? SignatureDocumentId,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    Guid ConcurrencyToken);

public sealed record SaveClientRequest(
    string FullName,
    DateOnly? BirthDate,
    int? AgeAtReception,
    string? BirthPlace,
    string? Nationality,
    string? Sex,
    string? MaritalStatus,
    string? Dpi,
    string ResidenceAddress,
    string? Education,
    string? Occupation,
    string? Workplace,
    string? WorkAddress,
    string? WorkPhone,
    string? Phone,
    string? MobilePhone,
    decimal? SalaryAmount,
    string? SalaryFrequency,
    int ChildrenCount,
    string AssistanceRequested,
    string? ClaimedAgainstPersonName,
    string? ClaimedAgainstPersonAddress,
    string ReceptionPlace,
    DateOnly ReceptionDate,
    Guid? SignatureDocumentId,
    Guid? ConcurrencyToken = null);

public sealed record IncomeDeclarationDto(
    Guid Id,
    Guid ClientId,
    string FullName,
    int? DeclaredAge,
    string? MaritalStatus,
    string? Sex,
    string? Dpi,
    string? Occupation,
    string? Nationality,
    string ResidenceAddress,
    string? Phone,
    string? MobilePhone,
    string? Workplace,
    string? WorkAddress,
    decimal? SalaryAmount,
    string? SalaryFrequency,
    string Place,
    DateOnly DeclarationDate,
    bool DeclaresLimitedResources,
    Guid? GeneratedDocumentId,
    Guid? SignedDocumentId);

public sealed record SaveIncomeDeclarationRequest(
    string FullName,
    int? DeclaredAge,
    string? MaritalStatus,
    string? Sex,
    string? Dpi,
    string? Occupation,
    string? Nationality,
    string ResidenceAddress,
    string? Phone,
    string? MobilePhone,
    string? Workplace,
    string? WorkAddress,
    decimal? SalaryAmount,
    string? SalaryFrequency,
    string Place,
    DateOnly DeclarationDate,
    bool DeclaresLimitedResources,
    Guid? SignedDocumentId);

public sealed record ClientCaseDto(
    Guid Id,
    string CaseNumber,
    string ProcessType,
    string Status,
    string Stage,
    string? LastStep,
    DateTimeOffset? LastStepAtUtc);

public sealed record ClientProfileDto(
    ClientDto Client,
    IReadOnlyList<IncomeDeclarationDto> IncomeDeclarations,
    IReadOnlyList<ClientCaseDto> Cases);

public sealed record SetClientAttentionRequest(bool IsActive, Guid ConcurrencyToken);

public interface IClientService
{
    Task<PagedResult<ClientDto>> GetClientsAsync(string? search, int page, int pageSize, CancellationToken cancellationToken, bool? isActive = true);

    Task<ClientDto> SetAttentionAsync(Guid id, SetClientAttentionRequest request, CancellationToken cancellationToken);

    Task<ClientDto> GetClientAsync(Guid id, CancellationToken cancellationToken);

    Task<ClientProfileDto> GetClientProfileAsync(Guid id, CancellationToken cancellationToken);

    Task<ClientDto> CreateClientAsync(SaveClientRequest request, CancellationToken cancellationToken);

    Task<ClientDto> UpdateClientAsync(Guid id, SaveClientRequest request, CancellationToken cancellationToken);

    Task<IncomeDeclarationDto> CreateIncomeDeclarationAsync(Guid clientId, SaveIncomeDeclarationRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<IncomeDeclarationDto>> GetIncomeDeclarationsAsync(Guid clientId, CancellationToken cancellationToken);

    Task<string> GenerateIncomeDeclarationHtmlAsync(Guid declarationId, CancellationToken cancellationToken);
}
