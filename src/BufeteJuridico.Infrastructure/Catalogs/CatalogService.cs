using BufeteJuridico.Application.Catalogs;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Catalogs;

internal sealed class CatalogService(BufeteDbContext dbContext) : ICatalogService
{
    public async Task<IReadOnlyList<ProcessTypeDto>> GetProcessTypesAsync(bool includeInactive, CancellationToken cancellationToken)
    {
        var query = dbContext.ProcessTypes.AsNoTracking().Include(item => item.Requirements).AsQueryable();
        if (!includeInactive) query = query.Where(item => item.IsActive);

        var items = await query.OrderBy(item => item.Name).ToListAsync(cancellationToken);
        return items.Select(Map).ToList();
    }

    public async Task<ProcessTypeDto> GetProcessTypeAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.ProcessTypes.AsNoTracking().Include(value => value.Requirements)
            .SingleOrDefaultAsync(value => value.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el tipo de proceso.");
        return Map(item);
    }

    public async Task<ProcessTypeDto> CreateProcessTypeAsync(SaveProcessTypeRequest request, CancellationToken cancellationToken)
    {
        ValidateProcessType(request);
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        if (await dbContext.ProcessTypes.AnyAsync(item => item.Code == normalizedCode || item.Name == request.Name.Trim(), cancellationToken))
        {
            throw new ConflictException("Ya existe un tipo de proceso con el código o nombre indicado.");
        }

        var item = new ProcessType
        {
            Code = normalizedCode,
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            IsActive = request.IsActive
        };

        dbContext.ProcessTypes.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public async Task<ProcessTypeDto> UpdateProcessTypeAsync(Guid id, SaveProcessTypeRequest request, CancellationToken cancellationToken)
    {
        ValidateProcessType(request);
        var item = await dbContext.ProcessTypes.Include(value => value.Requirements)
            .SingleOrDefaultAsync(value => value.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el tipo de proceso.");
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        if (await dbContext.ProcessTypes.AnyAsync(value => value.Id != id && (value.Code == normalizedCode || value.Name == request.Name.Trim()), cancellationToken))
        {
            throw new ConflictException("Ya existe otro tipo de proceso con el código o nombre indicado.");
        }

        item.Code = normalizedCode;
        item.Name = request.Name.Trim();
        item.Description = request.Description.Trim();
        item.IsActive = request.IsActive;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public Task<RequirementDefinitionDto> CreateRequirementAsync(SaveRequirementDefinitionRequest request, CancellationToken cancellationToken) =>
        SaveRequirementAsync(null, request, cancellationToken);

    public Task<RequirementDefinitionDto> UpdateRequirementAsync(Guid id, SaveRequirementDefinitionRequest request, CancellationToken cancellationToken) =>
        SaveRequirementAsync(id, request, cancellationToken);

    public async Task<IReadOnlyList<RequirementDefinitionDto>> GetStudentRequirementsAsync(CancellationToken cancellationToken) =>
        await dbContext.RequirementDefinitions
            .AsNoTracking()
            .Where(item => item.Scope == RequirementScope.StudentEnrollment && item.IsActive)
            .OrderBy(item => item.SortOrder)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);

    private async Task<RequirementDefinitionDto> SaveRequirementAsync(
        Guid? id,
        SaveRequirementDefinitionRequest request,
        CancellationToken cancellationToken)
    {
        ValidateRequirement(request);

        if (request.Scope == RequirementScope.Process)
        {
            if (request.ProcessTypeId is null ||
                !await dbContext.ProcessTypes.AnyAsync(item => item.Id == request.ProcessTypeId, cancellationToken))
            {
                throw new ValidationException("Un requisito de proceso debe indicar un tipo de proceso válido.");
            }
        }
        else if (request.ProcessTypeId is not null)
        {
            throw new ValidationException("Solo los requisitos de proceso pueden relacionarse con un tipo de proceso.");
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        if (await dbContext.RequirementDefinitions.AnyAsync(item =>
                item.Id != id &&
                item.Scope == request.Scope &&
                item.ProcessTypeId == request.ProcessTypeId &&
                item.Code == normalizedCode,
            cancellationToken))
        {
            throw new ConflictException("Ya existe un requisito con el mismo código en este catálogo.");
        }

        RequirementDefinition item;
        if (id is null)
        {
            item = new RequirementDefinition();
            dbContext.RequirementDefinitions.Add(item);
        }
        else
        {
            item = await dbContext.RequirementDefinitions.SingleOrDefaultAsync(value => value.Id == id, cancellationToken)
                ?? throw new NotFoundException("No se encontró el requisito.");
        }

        item.Scope = request.Scope;
        item.ProcessTypeId = request.ProcessTypeId;
        item.Code = normalizedCode;
        item.Label = request.Label.Trim();
        item.Kind = request.Kind;
        item.IsRequired = request.IsRequired;
        item.IsConditional = request.IsConditional;
        item.ConditionDescription = Clean(request.ConditionDescription);
        item.DocumentNature = request.Kind == RequirementKind.Document ? request.DocumentNature : DocumentNature.NotApplicable;
        item.MaximumAgeDays = request.Kind == RequirementKind.Document ? request.MaximumAgeDays : null;
        item.Subject = Clean(request.Subject);
        item.Instructions = Clean(request.Instructions);
        item.SortOrder = request.SortOrder;
        item.IsActive = request.IsActive;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    private static void ValidateProcessType(SaveProcessTypeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ValidationException("Código y nombre del tipo de proceso son obligatorios.");
        }
    }

    private static void ValidateRequirement(SaveRequirementDefinitionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Label))
        {
            throw new ValidationException("Código y etiqueta del requisito son obligatorios.");
        }

        if (request.IsConditional && string.IsNullOrWhiteSpace(request.ConditionDescription))
        {
            throw new ValidationException("Un requisito condicional debe explicar su condición.");
        }

        if (request.MaximumAgeDays <= 0)
        {
            throw new ValidationException("La vigencia máxima debe ser mayor que cero.");
        }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ProcessTypeDto Map(ProcessType item) => new(
        item.Id,
        item.Code,
        item.Name,
        item.Description,
        item.IsActive,
        item.Requirements.OrderBy(value => value.SortOrder).Select(Map).ToList());

    private static RequirementDefinitionDto Map(RequirementDefinition item) => new(
        item.Id,
        item.Scope,
        item.ProcessTypeId,
        item.Code,
        item.Label,
        item.Kind,
        item.IsRequired,
        item.IsConditional,
        item.ConditionDescription,
        item.DocumentNature,
        item.MaximumAgeDays,
        item.Subject,
        item.Instructions,
        item.SortOrder,
        item.IsActive);
}
