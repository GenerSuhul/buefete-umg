using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Documents;

internal sealed class DocumentService(
    BufeteDbContext dbContext,
    IFileStorage fileStorage,
    IOptions<StorageOptions> storageOptions,
    ICurrentUser currentUser)
    : IDocumentService
{
    public async Task<DocumentDto> StoreAsync(StoreDocumentRequest request, CancellationToken cancellationToken)
    {
        ValidateRequest(request);
        await EnsureContextAccessCoreAsync(request.ContextType, request.ContextId, write: true, cancellationToken);

        var extension = DocumentFileValidator.ValidateMetadata(
            request.OriginalFileName,
            request.ContentType,
            request.SizeBytes,
            storageOptions.Value.MaxFileSizeBytes);
        DocumentFileValidator.ValidateContext(extension, request.ContextType);
        await DocumentFileValidator.ValidateSignatureAsync(extension, request.Content, cancellationToken);

        DocumentRecord? previous = null;
        var versionNumber = 1;

        if (request.ReplaceDocumentId is not null)
        {
            previous = await dbContext.Documents.SingleOrDefaultAsync(
                item => item.Id == request.ReplaceDocumentId && item.IsCurrent && item.DeletedAtUtc == null,
                cancellationToken)
                ?? throw new ConflictException("El documento que se reemplazará no existe o ya no es la versión vigente.");

            if (previous.ContextType != request.ContextType ||
                previous.ContextId != request.ContextId ||
                !string.Equals(previous.Label, request.Label.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                throw new ValidationException("La nueva versión debe conservar contexto y etiqueta.");
            }

            previous.IsCurrent = false;
            versionNumber = previous.VersionNumber + 1;
        }

        var stored = await fileStorage.StoreAsync(extension, request.ContentType, request.Content, cancellationToken);
        try
        {
            var document = new DocumentRecord
            {
                StorageKey = stored.StorageKey,
                OriginalFileName = Path.GetFileName(request.OriginalFileName),
                ContentType = request.ContentType.ToLowerInvariant(),
                SizeBytes = stored.SizeBytes,
                Sha256 = stored.Sha256,
                Source = request.Source,
                ContextType = request.ContextType,
                ContextId = request.ContextId,
                Label = request.Label.Trim(),
                VersionNumber = versionNumber,
                PreviousVersionId = previous?.Id,
                IsCurrent = true
            };

            dbContext.Documents.Add(document);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Map(document);
        }
        catch
        {
            // El objeto no debe sobrevivir si PostgreSQL rechaza sus metadatos.
            await fileStorage.DeleteAsync(stored.StorageKey, CancellationToken.None);
            throw;
        }
    }

    public async Task<DocumentDto> GetMetadataAsync(Guid id, CancellationToken cancellationToken)
    {
        var document = await GetDocumentAsync(id, cancellationToken);
        await EnsureContextAccessCoreAsync(document.ContextType, document.ContextId, write: false, cancellationToken);
        return Map(document);
    }

    public async Task<PagedResult<DocumentDto>> GetForContextAsync(
        DocumentContextType contextType,
        Guid contextId,
        string? label,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        await EnsureContextAccessCoreAsync(contextType, contextId, write: false, cancellationToken);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.Documents.AsNoTracking().Where(item =>
            item.ContextType == contextType && item.ContextId == contextId && item.DeletedAtUtc == null);
        if (!string.IsNullOrWhiteSpace(label))
        {
            var exactLabel = label.Trim()
                .Replace("\\", "\\\\", StringComparison.Ordinal)
                .Replace("%", "\\%", StringComparison.Ordinal)
                .Replace("_", "\\_", StringComparison.Ordinal);
            query = query.Where(item => EF.Functions.ILike(item.Label, exactLabel, "\\"));
        }
        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(item => item.Label)
            .ThenByDescending(item => item.VersionNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<DocumentDto>(items.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<PagedResult<DocumentDto>> GetDocumentsAsync(
        DocumentContextType? contextType,
        Guid? contextId,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        if (contextType.HasValue != contextId.HasValue)
            throw new ValidationException("El tipo y el identificador de contexto deben enviarse juntos.");

        if (contextType is not null && contextId is not null)
        {
            await EnsureContextAccessCoreAsync(contextType.Value, contextId.Value, write: false, cancellationToken);
        }
        else
        {
            var isStaff = currentUser.HasPermission(Permissions.ClientsRead) ||
                          currentUser.HasPermission(Permissions.StudentsRead) ||
                          currentUser.HasPermission(Permissions.CasesRead);
            if (!currentUser.IsAuthenticated || !currentUser.HasPermission(Permissions.DocumentsRead) || !isStaff)
                throw new ForbiddenException("La consulta documental global está reservada al personal autorizado.");
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.Documents.AsNoTracking().Where(item =>
            item.DeletedAtUtc == null && item.IsCurrent);

        if (contextType is not null && contextId is not null)
            query = query.Where(item => item.ContextType == contextType && item.ContextId == contextId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item =>
                EF.Functions.ILike(item.Label, $"%{term}%") ||
                EF.Functions.ILike(item.OriginalFileName, $"%{term}%"));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<DocumentDto>(items.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<DocumentDownloadAccess> GetDownloadAccessAsync(Guid id, CancellationToken cancellationToken)
    {
        var document = await GetDocumentAsync(id, cancellationToken);
        await EnsureContextAccessCoreAsync(document.ContextType, document.ContextId, write: false, cancellationToken);
        var redirectUri = await fileStorage.CreateReadUrlAsync(
            document.StorageKey,
            document.OriginalFileName,
            document.ContentType,
            TimeSpan.FromMinutes(Math.Clamp(storageOptions.Value.DownloadUrlMinutes, 1, 15)),
            cancellationToken);
        if (redirectUri is not null)
            return new DocumentDownloadAccess(document.OriginalFileName, document.ContentType, null, redirectUri);

        var stream = await fileStorage.OpenReadAsync(document.StorageKey, cancellationToken);
        return new DocumentDownloadAccess(document.OriginalFileName, document.ContentType, stream, null);
    }

    public async Task<DocumentReadUrlDto> GetReadUrlAsync(Guid id, CancellationToken cancellationToken)
    {
        var document = await GetDocumentAsync(id, cancellationToken);
        await EnsureContextAccessCoreAsync(document.ContextType, document.ContextId, write: false, cancellationToken);
        var lifetime = TimeSpan.FromMinutes(Math.Clamp(storageOptions.Value.DownloadUrlMinutes, 1, 15));
        var redirectUri = await fileStorage.CreateReadUrlAsync(
            document.StorageKey,
            document.OriginalFileName,
            document.ContentType,
            lifetime,
            cancellationToken);

        return new DocumentReadUrlDto(
            document.OriginalFileName,
            document.ContentType,
            redirectUri?.AbsoluteUri,
            redirectUri is null ? null : DateTimeOffset.UtcNow.Add(lifetime));
    }

    private async Task<DocumentRecord> GetDocumentAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.Documents.AsNoTracking().SingleOrDefaultAsync(
            item => item.Id == id && item.DeletedAtUtc == null,
            cancellationToken)
        ?? throw new NotFoundException("No se encontró el documento.");

    private void ValidateRequest(StoreDocumentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Label))
            throw new ValidationException("Nombre y etiqueta del documento son obligatorios.");
        _ = DocumentFileValidator.ValidateMetadata(
            request.OriginalFileName,
            request.ContentType,
            request.SizeBytes,
            storageOptions.Value.MaxFileSizeBytes);
    }

    public Task EnsureContextAccessAsync(
        DocumentContextType contextType,
        Guid contextId,
        bool write,
        CancellationToken cancellationToken) =>
        EnsureContextAccessCoreAsync(contextType, contextId, write, cancellationToken);

    public async Task EnsureDocumentMatchesContextAsync(
        Guid documentId,
        DocumentContextType contextType,
        Guid contextId,
        CancellationToken cancellationToken)
    {
        await EnsureContextAccessCoreAsync(contextType, contextId, write: true, cancellationToken);
        if (!await dbContext.Documents.AsNoTracking().AnyAsync(item =>
                item.Id == documentId &&
                item.ContextType == contextType &&
                item.ContextId == contextId &&
                item.IsCurrent &&
                item.DeletedAtUtc == null,
                cancellationToken))
        {
            throw new ValidationException("El documento no pertenece al registro indicado o no es su versión vigente.");
        }
    }

    private async Task EnsureContextAccessCoreAsync(
        DocumentContextType contextType,
        Guid contextId,
        bool write,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated)
            throw new ForbiddenException("Debe iniciar sesión para acceder a documentos.");

        var requiredPermission = write ? Permissions.DocumentsWrite : Permissions.DocumentsRead;
        if (!currentUser.HasPermission(requiredPermission))
            throw new ForbiddenException("No tiene permiso para realizar esta operación documental.");

        var contextExists = await ContextExistsAsync(contextType, contextId, cancellationToken);
        if (!contextExists)
            throw new NotFoundException("No se encontró el registro al que se asociará el documento.");

        var isStaff = currentUser.HasPermission(Permissions.ClientsRead) ||
                      currentUser.HasPermission(Permissions.StudentsRead) ||
                      currentUser.HasPermission(Permissions.CasesRead);
        if (isStaff) return;

        var userId = currentUser.UserId ?? throw new ForbiddenException("No se pudo identificar al usuario.");
        if (contextType == DocumentContextType.UserPhoto && contextId == userId) return;
        var studentId = await dbContext.Students
            .Where(item => item.UserAccountId == userId && item.IsActive)
            .Select(item => (Guid?)item.Id)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ForbiddenException("La cuenta no está vinculada con un alumno activo.");

        if (contextType == DocumentContextType.Student && contextId == studentId) return;

        if (contextType == DocumentContextType.Enrollment &&
            await dbContext.EnrollmentApplications.AnyAsync(item => item.Id == contextId && item.StudentId == studentId, cancellationToken))
            return;

        var caseId = await ResolveCaseIdAsync(contextType, contextId, cancellationToken);
        if (caseId is not null && await dbContext.CaseAssignments.AnyAsync(item =>
                item.LegalCaseId == caseId &&
                item.StudentId == studentId &&
                item.Status == CaseAssignmentStatus.Active,
            cancellationToken))
        {
            if (!write || currentUser.HasPermission(Permissions.AssignedMemorialWrite)) return;
        }

        throw new ForbiddenException("No tiene acceso al contexto de este documento.");
    }

    private Task<bool> ContextExistsAsync(
        DocumentContextType contextType,
        Guid contextId,
        CancellationToken cancellationToken) =>
        contextType switch
        {
            DocumentContextType.Client => dbContext.Clients.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.IncomeDeclaration => dbContext.IncomeDeclarations.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.Student => dbContext.Students.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.Enrollment => dbContext.EnrollmentApplications.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.LegalCase => dbContext.LegalCases.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.CaseRequirement => dbContext.CaseRequirements.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.Timeline => dbContext.TimelineEntries.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.Memorial => dbContext.Memorials.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.Report => dbContext.WeeklyReports.AnyAsync(item => item.Id == contextId, cancellationToken),
            DocumentContextType.UserPhoto => dbContext.Users.AnyAsync(item => item.Id == contextId, cancellationToken),
            _ => Task.FromResult(false)
        };

    private async Task<Guid?> ResolveCaseIdAsync(DocumentContextType contextType, Guid contextId, CancellationToken cancellationToken) =>
        contextType switch
        {
            DocumentContextType.LegalCase => contextId,
            DocumentContextType.CaseRequirement => await dbContext.CaseRequirements.Where(item => item.Id == contextId).Select(item => (Guid?)item.LegalCaseId).SingleOrDefaultAsync(cancellationToken),
            DocumentContextType.Timeline => await dbContext.TimelineEntries.Where(item => item.Id == contextId).Select(item => (Guid?)item.LegalCaseId).SingleOrDefaultAsync(cancellationToken),
            DocumentContextType.Memorial => await dbContext.Memorials.Where(item => item.Id == contextId).Select(item => (Guid?)item.LegalCaseId).SingleOrDefaultAsync(cancellationToken),
            _ => null
        };

    private static DocumentDto Map(DocumentRecord item) => new(
        item.Id,
        item.OriginalFileName,
        item.ContentType,
        item.SizeBytes,
        item.Sha256,
        item.Source,
        item.ContextType,
        item.ContextId,
        item.Label,
        item.VersionNumber,
        item.PreviousVersionId,
        item.IsCurrent,
        item.PageCount,
        item.CreatedAtUtc,
        item.CreatedByUserId);
}
