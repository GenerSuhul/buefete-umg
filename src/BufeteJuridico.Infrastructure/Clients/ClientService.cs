using System.Net;
using System.Text;
using BufeteJuridico.Application.Clients;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Domain.Clients;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Infrastructure.Branding;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using BufeteJuridico.Infrastructure.Tenancy;

namespace BufeteJuridico.Infrastructure.Clients;

internal sealed class ClientService(BufeteDbContext dbContext, IDocumentService documentService, TimeProvider timeProvider, TenantContext tenantContext, IClientRestrictionService restrictions) : IClientService
{
    public async Task<PagedResult<ClientDto>> GetClientsAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken,
        bool? isActive = true)
    {
        (page, pageSize) = ValidatePage(page, pageSize);
        var query = dbContext.Clients.AsNoTracking();
        if (isActive is bool active) query = query.Where(item => item.IsActive == active);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = TextNormalization.Normalize(search);
            var identitySearch = ContactNormalization.Digits(search);
            query = query.Where(item =>
                item.NormalizedFullName.Contains(normalized) ||
                (identitySearch.Length > 0 && item.Dpi != null && item.Dpi.Replace(" ", "").Replace("-", "").Contains(identitySearch)) ||
                item.ReceptionNumber.Contains(search.Trim()));
        }

        var total = await query.CountAsync(cancellationToken);
        var clients = await query
            .OrderBy(item => item.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ClientDto>(clients.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<ClientDto> SetAttentionAsync(Guid id, SetClientAttentionRequest request, CancellationToken cancellationToken)
    {
        if (request.ConcurrencyToken == Guid.Empty)
            throw new ValidationException("Actualice la ficha antes de cambiar el estado de atención.");
        var client = await dbContext.Clients.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el usuario atendido.");
        if (client.ConcurrencyToken != request.ConcurrencyToken)
            throw new DbUpdateConcurrencyException("La ficha fue modificada por otra persona.");
        dbContext.Entry(client).Property(item => item.ConcurrencyToken).OriginalValue = request.ConcurrencyToken;
        if (request.IsActive) await restrictions.EnsureAllowedAsync(client.Dpi, cancellationToken);
        client.IsActive = request.IsActive;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(client);
    }

    public async Task<ClientDto> GetClientAsync(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el cliente.");
        return Map(client);
    }

    public async Task<ClientProfileDto> GetClientProfileAsync(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el cliente.");
        var declarations = await dbContext.IncomeDeclarations.AsNoTracking()
            .Where(item => item.ClientId == id)
            .OrderByDescending(item => item.DeclarationDate)
            .ToListAsync(cancellationToken);
        var cases = await dbContext.LegalCases.AsNoTracking()
            .Include(item => item.ProcessType)
            .Include(item => item.Timeline)
            .Where(item => item.ClientId == id)
            .OrderByDescending(item => item.OpenedAtUtc)
            .ToListAsync(cancellationToken);

        return new ClientProfileDto(
            Map(client),
            declarations.Select(Map).ToList(),
            cases.Select(item =>
            {
                var lastStep = item.Timeline.OrderByDescending(step => step.OccurredAtUtc).FirstOrDefault();
                return new ClientCaseDto(
                    item.Id,
                    item.CaseNumber,
                    item.ProcessType.Name,
                    item.Status.ToString(),
                    item.Stage,
                    lastStep?.Title,
                    lastStep?.OccurredAtUtc);
            }).ToList(), await restrictions.GetStatusAsync(client.Dpi, cancellationToken));
    }

    public async Task<ClientDto> CreateClientAsync(SaveClientRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        await restrictions.EnsureAllowedAsync(request.Dpi, cancellationToken);
        await EnsureDpiAvailableAsync(request.Dpi, null, cancellationToken);

        var client = new Client
        {
            ReceptionNumber = GenerateReceptionNumber(),
            FullName = request.FullName.Trim(),
            NormalizedFullName = TextNormalization.Normalize(request.FullName),
            IsActive = true
        };

        Apply(client, request);
        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(client);
    }

    public async Task<ClientDto> UpdateClientAsync(Guid id, SaveClientRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        var client = await dbContext.Clients.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el cliente.");
        if (request.ConcurrencyToken is not Guid concurrencyToken || concurrencyToken == Guid.Empty)
            throw new ValidationException("La versión del cliente es obligatoria para guardar cambios.");
        dbContext.Entry(client).Property(item => item.ConcurrencyToken).OriginalValue = concurrencyToken;

        // Lock both identities in stable order: changing the DPI must not bypass an existing veto.
        var priorDigits = ContactNormalization.Digits(client.Dpi);
        var priorIdentity = priorDigits.Length == 13 && priorDigits.All(c => c is >= '0' and <= '9') ? priorDigits : null;
        foreach (var dpi in new[] { priorIdentity, request.Dpi }.Where(value => !string.IsNullOrWhiteSpace(value))
                     .Distinct().OrderBy(value => ContactNormalization.Digits(value), StringComparer.Ordinal))
            await restrictions.EnsureAllowedAsync(dpi, cancellationToken);
        await EnsureDpiAvailableAsync(request.Dpi, id, cancellationToken);
        // Preserve the already-associated signature when correcting a legacy identity.
        // New associations still pass document authorization and the global attention guard.
        if (request.SignatureDocumentId is Guid signatureDocumentId && request.SignatureDocumentId != client.SignatureDocumentId)
            await documentService.EnsureDocumentMatchesContextAsync(signatureDocumentId, DocumentContextType.Client, id, cancellationToken);
        Apply(client, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(client);
    }

    public async Task<IncomeDeclarationDto> CreateIncomeDeclarationAsync(
        Guid clientId,
        SaveIncomeDeclarationRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) ||
            string.IsNullOrWhiteSpace(request.ResidenceAddress) ||
            string.IsNullOrWhiteSpace(request.Place))
        {
            throw new ValidationException("Nombre, residencia y lugar son obligatorios en la declaración.");
        }
        if (!ContactNormalization.IsValidCui(request.Dpi, required: false))
            throw new ValidationException("El DPI debe contener los 13 dígitos del CUI.");
        if (!ContactNormalization.IsValidGuatemalaPhone(request.Phone) ||
            !ContactNormalization.IsValidGuatemalaPhone(request.MobilePhone))
            throw new ValidationException("Los teléfonos deben contener 8 dígitos o el prefijo +502.");

        if (!await dbContext.Clients.AnyAsync(item => item.Id == clientId && item.IsActive, cancellationToken))
        {
            throw new NotFoundException("No se encontró el cliente.");
        }

        var ownerDpi = await dbContext.Clients.Where(item => item.Id == clientId).Select(item => item.Dpi).SingleAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(ownerDpi) && !string.IsNullOrWhiteSpace(request.Dpi) &&
            ContactNormalization.Digits(ownerDpi) != ContactNormalization.Digits(request.Dpi))
            throw new ValidationException("El DPI de la declaración debe coincidir con el DPI de la ficha del usuario.");
        await restrictions.EnsureAllowedAsync(ownerDpi, cancellationToken);
        await restrictions.EnsureAllowedAsync(request.Dpi, cancellationToken, required: false);
        if (request.SignedDocumentId is Guid signedDocumentId)
            await documentService.EnsureDocumentMatchesContextAsync(signedDocumentId, DocumentContextType.Client, clientId, cancellationToken);

        var declaration = new IncomeDeclaration
        {
            ClientId = clientId,
            FullName = request.FullName.Trim(),
            DeclaredAge = request.DeclaredAge,
            MaritalStatus = Clean(request.MaritalStatus),
            Sex = Clean(request.Sex),
            Dpi = ContactNormalization.Cui(request.Dpi),
            Occupation = Clean(request.Occupation),
            Nationality = Clean(request.Nationality),
            ResidenceAddress = request.ResidenceAddress.Trim(),
            Phone = ContactNormalization.GuatemalaPhone(request.Phone),
            MobilePhone = ContactNormalization.GuatemalaPhone(request.MobilePhone),
            Workplace = Clean(request.Workplace),
            WorkAddress = Clean(request.WorkAddress),
            SalaryAmount = request.SalaryAmount,
            SalaryFrequency = Clean(request.SalaryFrequency),
            Place = request.Place.Trim(),
            DeclarationDate = request.DeclarationDate,
            DeclaresLimitedResources = request.DeclaresLimitedResources,
            SignedDocumentId = request.SignedDocumentId
        };

        dbContext.IncomeDeclarations.Add(declaration);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(declaration);
    }

    public async Task<IReadOnlyList<IncomeDeclarationDto>> GetIncomeDeclarationsAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Clients.AnyAsync(item => item.Id == clientId, cancellationToken))
        {
            throw new NotFoundException("No se encontró el cliente.");
        }

        return await dbContext.IncomeDeclarations
            .AsNoTracking()
            .Where(item => item.ClientId == clientId)
            .OrderByDescending(item => item.DeclarationDate)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<string> GenerateIncomeDeclarationHtmlAsync(Guid declarationId, CancellationToken cancellationToken)
    {
        var declaration = await dbContext.IncomeDeclarations
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == declarationId, cancellationToken)
            ?? throw new NotFoundException("No se encontró la declaración jurada.");

        static string Encode(object? value) => WebUtility.HtmlEncode(value?.ToString() ?? "—");

        var html = new StringBuilder()
            .Append("<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">")
            .Append("<title>Declaración jurada de ingresos</title>")
            .Append("<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.6}h1{text-align:center;font-size:20px}.signature{margin-top:80px;border-top:1px solid #000;text-align:center}</style>")
            .Append("</head><body>").Append(InstitutionalReportHeader.Html(tenantContext.Name))
            .Append("<h1>DECLARACIÓN JURADA DE INGRESOS</h1>")
            .Append("<p>Yo, <strong>").Append(Encode(declaration.FullName)).Append("</strong>, de ")
            .Append(Encode(declaration.DeclaredAge)).Append(" años, estado civil ")
            .Append(Encode(declaration.MaritalStatus)).Append(", identificado(a) con DPI ")
            .Append(Encode(declaration.Dpi)).Append(", con residencia en ")
            .Append(Encode(declaration.ResidenceAddress)).Append(", declaro bajo juramento que mis ingresos son de ")
            .Append(Encode(declaration.SalaryAmount)).Append(" ")
            .Append(Encode(declaration.SalaryFrequency)).Append(" y solicito los servicios del Bufete Popular.</p>")
            .Append("<p>Lugar y fecha: ").Append(Encode(declaration.Place)).Append(", ")
            .Append(Encode(declaration.DeclarationDate)).Append(".</p>")
            .Append("<div class=\"signature\">Firma o impresión digital</div></body></html>")
            .ToString();

        return html;
    }

    private async Task EnsureDpiAvailableAsync(string? dpi, Guid? existingId, CancellationToken cancellationToken)
    {
        var digits = ContactNormalization.Digits(dpi);
        if (digits.Length > 0 &&
            await dbContext.Clients.AnyAsync(item =>
                item.Id != existingId && item.Dpi != null &&
                item.Dpi.Replace(" ", "").Replace("-", "") == digits,
                cancellationToken))
        {
            throw new ConflictException("Ya existe un cliente con el mismo DPI.");
        }
    }

    private string GenerateReceptionNumber() =>
        $"CLI-{timeProvider.GetUtcNow():yyyy}-{Guid.NewGuid():N}"[..21].ToUpperInvariant();

    private static void Validate(SaveClientRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.FullName)) errors["fullName"] = ["El nombre es obligatorio."];
        if (!ContactNormalization.IsValidCui(request.Dpi)) errors["dpi"] = ["El DPI debe contener los 13 dígitos del CUI."];
        if (string.IsNullOrWhiteSpace(request.ResidenceAddress)) errors["residenceAddress"] = ["La dirección es obligatoria."];
        if (string.IsNullOrWhiteSpace(request.AssistanceRequested)) errors["assistanceRequested"] = ["La asistencia solicitada es obligatoria."];
        if (string.IsNullOrWhiteSpace(request.ReceptionPlace)) errors["receptionPlace"] = ["El lugar de recepción es obligatorio."];
        if (request.ChildrenCount < 0) errors["childrenCount"] = ["La cantidad de hijos no puede ser negativa."];
        if (request.SalaryAmount < 0) errors["salaryAmount"] = ["El salario no puede ser negativo."];
        if (!ContactNormalization.IsValidGuatemalaPhone(request.Phone)) errors["phone"] = ["El teléfono debe contener 8 dígitos o el prefijo +502."];
        if (!ContactNormalization.IsValidGuatemalaPhone(request.MobilePhone)) errors["mobilePhone"] = ["El celular debe contener 8 dígitos o el prefijo +502."];
        if (!ContactNormalization.IsValidGuatemalaPhone(request.WorkPhone)) errors["workPhone"] = ["El teléfono de trabajo debe contener 8 dígitos o el prefijo +502."];
        if (errors.Count > 0) throw new ValidationException("Revise los datos del cliente.", errors);
    }

    private static void Apply(Client client, SaveClientRequest request)
    {
        client.FullName = request.FullName.Trim();
        client.NormalizedFullName = TextNormalization.Normalize(request.FullName);
        client.BirthDate = request.BirthDate;
        client.AgeAtReception = request.AgeAtReception;
        client.BirthPlace = Clean(request.BirthPlace);
        client.Nationality = Clean(request.Nationality);
        client.Sex = Clean(request.Sex);
        client.MaritalStatus = Clean(request.MaritalStatus);
        client.Dpi = ContactNormalization.Cui(request.Dpi);
        client.ResidenceAddress = request.ResidenceAddress.Trim();
        client.Education = Clean(request.Education);
        client.Occupation = Clean(request.Occupation);
        client.Workplace = Clean(request.Workplace);
        client.WorkAddress = Clean(request.WorkAddress);
        client.WorkPhone = ContactNormalization.GuatemalaPhone(request.WorkPhone);
        client.Phone = ContactNormalization.GuatemalaPhone(request.Phone);
        client.MobilePhone = ContactNormalization.GuatemalaPhone(request.MobilePhone);
        client.SalaryAmount = request.SalaryAmount;
        client.SalaryFrequency = Clean(request.SalaryFrequency);
        client.ChildrenCount = request.ChildrenCount;
        client.AssistanceRequested = request.AssistanceRequested.Trim();
        client.ClaimedAgainstPersonName = Clean(request.ClaimedAgainstPersonName);
        client.ClaimedAgainstPersonAddress = Clean(request.ClaimedAgainstPersonAddress);
        client.ReceptionPlace = request.ReceptionPlace.Trim();
        client.ReceptionDate = request.ReceptionDate;
        client.SignatureDocumentId = request.SignatureDocumentId;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static (int Page, int PageSize) ValidatePage(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));

    private static ClientDto Map(Client item) => new(
        item.Id,
        item.ReceptionNumber,
        item.FullName,
        item.BirthDate,
        item.AgeAtReception,
        item.BirthPlace,
        item.Nationality,
        item.Sex,
        item.MaritalStatus,
        item.Dpi,
        item.ResidenceAddress,
        item.Education,
        item.Occupation,
        item.Workplace,
        item.WorkAddress,
        item.WorkPhone,
        item.Phone,
        item.MobilePhone,
        item.SalaryAmount,
        item.SalaryFrequency,
        item.ChildrenCount,
        item.AssistanceRequested,
        item.ClaimedAgainstPersonName,
        item.ClaimedAgainstPersonAddress,
        item.ReceptionPlace,
        item.ReceptionDate,
        item.SignatureDocumentId,
        item.IsActive,
        item.CreatedAtUtc,
        item.ConcurrencyToken);

    private static IncomeDeclarationDto Map(IncomeDeclaration item) => new(
        item.Id,
        item.ClientId,
        item.FullName,
        item.DeclaredAge,
        item.MaritalStatus,
        item.Sex,
        item.Dpi,
        item.Occupation,
        item.Nationality,
        item.ResidenceAddress,
        item.Phone,
        item.MobilePhone,
        item.Workplace,
        item.WorkAddress,
        item.SalaryAmount,
        item.SalaryFrequency,
        item.Place,
        item.DeclarationDate,
        item.DeclaresLimitedResources,
        item.GeneratedDocumentId,
        item.SignedDocumentId);
}
