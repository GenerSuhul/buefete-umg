using System.Security.Cryptography;
using System.Text;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Documents;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PdfSharp.Drawing;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace BufeteJuridico.Infrastructure.Documents;

internal sealed class ScanSessionService(
    BufeteDbContext dbContext,
    IDocumentService documentService,
    IFileStorage fileStorage,
    IOptions<StorageOptions> storageOptions,
    IOptions<ScannerOptions> scannerOptions,
    ICurrentUser currentUser,
    TimeProvider timeProvider)
    : IScanSessionService
{
    public async Task<ScanSessionDto> CreateAsync(CreateScanSessionRequest request, CancellationToken cancellationToken)
    {
        ValidateCreateRequest(request);
        await documentService.EnsureContextAccessAsync(request.ContextType, request.ContextId, write: true, cancellationToken);
        await ValidateReplacementAsync(request.ReplaceDocumentId, request.ContextType, request.ContextId, request.Label, cancellationToken);

        var now = timeProvider.GetUtcNow();
        var session = new ScanSession
        {
            ContextType = request.ContextType,
            ContextId = request.ContextId,
            Label = request.Label.Trim(),
            ReplaceDocumentId = request.ReplaceDocumentId,
            AcquisitionProvider = request.AcquisitionProvider.Trim(),
            DeviceId = NullIfWhiteSpace(request.DeviceId),
            DeviceName = NullIfWhiteSpace(request.DeviceName),
            ResolutionDpi = request.ResolutionDpi,
            ColorMode = NullIfWhiteSpace(request.ColorMode),
            Duplex = request.Duplex,
            ExpiresAtUtc = DraftExpiresAt(now),
            LastSavedAtUtc = now
        };

        dbContext.ScanSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    public async Task<ScanSessionDto> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await ExpireIfNeededAsync(session, cancellationToken);
        return Map(session);
    }

    public async Task<IReadOnlyList<ScanSessionDto>> GetDraftsAsync(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException("No se pudo identificar al usuario autenticado.");
        var now = timeProvider.GetUtcNow();
        var sessions = await dbContext.ScanSessions
            .Include(item => item.Pages)
            .Where(item => item.CreatedByUserId == userId &&
                           (item.Status == ScanSessionStatus.Created || item.Status == ScanSessionStatus.Captured) &&
                           item.ExpiresAtUtc > now)
            .OrderByDescending(item => item.LastSavedAtUtc ?? item.CreatedAtUtc)
            .Take(25)
            .ToListAsync(cancellationToken);
        return sessions.Select(Map).ToList();
    }

    public async Task<ScanSessionDto> AddPagesAsync(Guid id, StoreScanPagesRequest request, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);

        var existing = session.Pages.FirstOrDefault(item => item.ClientPageId == request.ClientPageId);
        if (existing is not null) return Map(session);

        var extension = DocumentFileValidator.ValidateMetadata(
            request.FileName,
            request.ContentType,
            request.SizeBytes,
            storageOptions.Value.MaxFileSizeBytes);
        if (extension is not (".pdf" or ".jpg" or ".jpeg" or ".png"))
            throw new ValidationException("Las páginas de una sesión deben ser PDF, JPG o PNG.");

        await using var buffered = new MemoryStream((int)Math.Min(request.SizeBytes, int.MaxValue));
        await request.Content.CopyToAsync(buffered, cancellationToken);
        buffered.Position = 0;
        await DocumentFileValidator.ValidateSignatureAsync(extension, buffered, cancellationToken);
        buffered.Position = 0;

        var importedPageCount = 1;
        if (extension == ".pdf")
        {
            try
            {
                using var source = PdfReader.Open(buffered, PdfDocumentOpenMode.Import);
                importedPageCount = source.PageCount;
                if (importedPageCount < 1) throw new ValidationException("El PDF no contiene páginas utilizables.");
            }
            catch (ValidationException)
            {
                throw;
            }
            catch (Exception)
            {
                throw new ValidationException("El PDF está corrupto, protegido o no puede importarse.");
            }
            finally
            {
                buffered.Position = 0;
            }
        }

        var maximumPages = Math.Clamp(scannerOptions.Value.MaximumPages, 1, 1000);
        var activeCount = session.Pages.Count(item => item.Status == ScanPageStatus.Ready);
        if (activeCount + importedPageCount > maximumPages)
            throw new ValidationException($"La sesión admite como máximo {maximumPages} páginas.");

        var stored = await fileStorage.StoreAsync(extension, request.ContentType, buffered, cancellationToken);
        try
        {
            var nextPosition = activeCount;
            for (var pageIndex = 0; pageIndex < importedPageCount; pageIndex++)
            {
                var page = new ScanPage
                {
                    ScanSessionId = session.Id,
                    ScanSession = session,
                    ClientPageId = pageIndex == 0 ? request.ClientPageId : DeriveClientPageId(request.ClientPageId, pageIndex),
                    Position = nextPosition + pageIndex,
                    Source = extension == ".pdf" ? ScanPageSource.PdfImport : request.Source,
                    Status = ScanPageStatus.Ready,
                    OriginalStorageKey = stored.StorageKey,
                    OriginalFileName = Path.GetFileName(request.FileName),
                    ContentType = request.ContentType.ToLowerInvariant(),
                    SizeBytes = stored.SizeBytes,
                    Sha256 = stored.Sha256,
                    SourcePageNumber = extension == ".pdf" ? pageIndex + 1 : null,
                    WidthPixels = request.WidthPixels,
                    HeightPixels = request.HeightPixels
                };
                session.Pages.Add(page);
                dbContext.ScanPages.Add(page);
            }

            Touch(session);
            session.Status = ScanSessionStatus.Captured;
            session.CapturedAtUtc ??= timeProvider.GetUtcNow();
            session.PreviewedAtUtc = null;
            session.PageCount = activeCount + importedPageCount;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await fileStorage.DeleteAsync(stored.StorageKey, CancellationToken.None);
            throw;
        }

        return Map(session);
    }

    public async Task<ScanPageContent> OpenPageAsync(Guid id, Guid pageId, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        var page = session.Pages.SingleOrDefault(item => item.Id == pageId && !string.IsNullOrWhiteSpace(item.OriginalStorageKey))
            ?? throw new NotFoundException("No se encontró la página digitalizada.");
        return new ScanPageContent(page.OriginalFileName, page.ContentType, await fileStorage.OpenReadAsync(page.OriginalStorageKey, cancellationToken));
    }

    public async Task<ScanSessionDto> ReorderPagesAsync(Guid id, ReorderScanPagesRequest request, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        var active = session.Pages.Where(item => item.Status == ScanPageStatus.Ready).ToList();
        if (request.PageIds.Count != active.Count || request.PageIds.Distinct().Count() != active.Count ||
            active.Any(item => !request.PageIds.Contains(item.Id)))
            throw new ValidationException("El nuevo orden debe incluir una vez cada página activa de la sesión.");

        var byId = active.ToDictionary(item => item.Id);
        for (var index = 0; index < request.PageIds.Count; index++) byId[request.PageIds[index]].Position = index;
        Touch(session);
        session.PreviewedAtUtc = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    public async Task<ScanSessionDto> RotatePageAsync(Guid id, Guid pageId, RotateScanPageRequest request, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        var normalized = ((request.RotationDegrees % 360) + 360) % 360;
        if (normalized is not (0 or 90 or 180 or 270)) throw new ValidationException("La rotación debe ser 0°, 90°, 180° o 270°.");
        var page = session.Pages.SingleOrDefault(item => item.Id == pageId && item.Status == ScanPageStatus.Ready)
            ?? throw new NotFoundException("No se encontró la página activa.");
        page.RotationDegrees = normalized;
        Touch(session);
        session.PreviewedAtUtc = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    public async Task<ScanSessionDto> RemovePageAsync(Guid id, Guid pageId, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        var page = session.Pages.SingleOrDefault(item => item.Id == pageId && item.Status == ScanPageStatus.Ready)
            ?? throw new NotFoundException("No se encontró la página activa.");
        page.Status = ScanPageStatus.Removed;
        page.RemovedAtUtc = timeProvider.GetUtcNow();
        page.RemovedByUserId = currentUser.UserId;
        var remaining = session.Pages.Where(item => item.Status == ScanPageStatus.Ready && item.Id != pageId).OrderBy(item => item.Position).ToList();
        for (var index = 0; index < remaining.Count; index++) remaining[index].Position = index;
        session.PageCount = remaining.Count;
        Touch(session);
        session.PreviewedAtUtc = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    public async Task<ScanSessionDto> SaveDraftAsync(Guid id, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        Touch(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    public async Task<ScanSessionDto> CaptureAsync(Guid id, StoreScanCaptureRequest request, CancellationToken cancellationToken)
    {
        var session = await AddPagesAsync(id, new StoreScanPagesRequest(
            Guid.NewGuid(),
            ScanPageSource.Scanner,
            request.FileName,
            request.ContentType,
            request.SizeBytes,
            null,
            null,
            request.Content), cancellationToken);
        return session;
    }

    public async Task<ScanPreviewContent> OpenPreviewAsync(Guid id, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        if (!session.Pages.Any(item => item.Status == ScanPageStatus.Ready))
            throw new ConflictException("La sesión todavía no contiene páginas para previsualizar.");

        var content = await GeneratePdfAsync(session, cancellationToken);
        session.PreviewedAtUtc = timeProvider.GetUtcNow();
        await dbContext.SaveChangesAsync(cancellationToken);
        return new ScanPreviewContent($"{SafeFileName(session.Label)}-vista-previa.pdf", "application/pdf", content);
    }

    public async Task<DocumentDto> CompleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        var pages = session.Pages.Where(item => item.Status == ScanPageStatus.Ready).OrderBy(item => item.Position).ToList();
        if (pages.Count == 0) throw new ConflictException("Agregue al menos una página antes de finalizar.");
        if (session.PreviewedAtUtc is null || session.PreviewedAtUtc < session.LastSavedAtUtc)
            throw new ConflictException("Debe previsualizar el orden vigente antes de finalizar el documento.");

        await documentService.EnsureContextAccessAsync(session.ContextType, session.ContextId, write: true, cancellationToken);
        await using var finalPdf = await GeneratePdfAsync(session, cancellationToken);
        var stored = await fileStorage.StoreAsync(".pdf", "application/pdf", finalPdf, cancellationToken);

        DocumentRecord? previous = null;
        var versionNumber = 1;
        if (session.ReplaceDocumentId is Guid previousId)
        {
            previous = await dbContext.Documents.SingleOrDefaultAsync(item => item.Id == previousId && item.DeletedAtUtc == null, cancellationToken)
                ?? throw new NotFoundException("No se encontró el documento que se reemplazará.");
            ValidateReplacement(previous, session.ContextType, session.ContextId, session.Label);
            previous.IsCurrent = false;
            versionNumber = previous.VersionNumber + 1;
        }

        var document = new DocumentRecord
        {
            StorageKey = stored.StorageKey,
            OriginalFileName = $"{SafeFileName(session.Label)}.pdf",
            ContentType = "application/pdf",
            SizeBytes = stored.SizeBytes,
            Sha256 = stored.Sha256,
            Source = DocumentSource.Scanner,
            ContextType = session.ContextType,
            ContextId = session.ContextId,
            Label = session.Label,
            VersionNumber = versionNumber,
            PreviousVersionId = previous?.Id,
            IsCurrent = true,
            PageCount = pages.Count
        };

        try
        {
            var now = timeProvider.GetUtcNow();
            session.Status = ScanSessionStatus.Completed;
            session.DocumentId = document.Id;
            session.CompletedAtUtc = now;
            session.PageCount = pages.Count;
            dbContext.Documents.Add(document);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await fileStorage.DeleteAsync(stored.StorageKey, CancellationToken.None);
            throw;
        }

        return MapDocument(document);
    }

    public Task<ScanSessionDto> CancelAsync(Guid id, CancellationToken cancellationToken) =>
        EndAsync(id, ScanSessionStatus.Cancelled, null, null, cancellationToken);

    public Task<ScanSessionDto> ReportFailureAsync(Guid id, ReportScanFailureRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Message))
            throw new ValidationException("El código y el mensaje del fallo son obligatorios.");
        if (request.Code.Length > 80 || request.Message.Length > 1000)
            throw new ValidationException("El detalle del fallo excede la longitud permitida.");
        return EndAsync(id, ScanSessionStatus.Failed, request.Code.Trim(), request.Message.Trim(), cancellationToken);
    }

    private async Task<ScanSessionDto> EndAsync(Guid id, ScanSessionStatus status, string? failureCode, string? failureMessage, CancellationToken cancellationToken)
    {
        var session = await GetOwnedSessionAsync(id, cancellationToken);
        await EnsureOpenAsync(session, cancellationToken);
        session.Status = status;
        session.CancelledAtUtc = status == ScanSessionStatus.Cancelled ? timeProvider.GetUtcNow() : null;
        session.FailureCode = failureCode;
        session.FailureMessage = failureMessage;
        session.LastSavedAtUtc = timeProvider.GetUtcNow();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    private async Task<ScanSession> GetOwnedSessionAsync(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException("No se pudo identificar al usuario autenticado.");
        return await dbContext.ScanSessions.Include(item => item.Pages).SingleOrDefaultAsync(item => item.Id == id && item.CreatedByUserId == userId, cancellationToken)
            ?? throw new NotFoundException("No se encontró la sesión de escaneo.");
    }

    private async Task EnsureOpenAsync(ScanSession session, CancellationToken cancellationToken)
    {
        if (await ExpireIfNeededAsync(session, cancellationToken)) throw new ConflictException("La sesión de digitalización expiró.");
        if (session.Status is not (ScanSessionStatus.Created or ScanSessionStatus.Captured))
            throw new ConflictException("La sesión ya terminó y no admite cambios.");
    }

    private async Task<bool> ExpireIfNeededAsync(ScanSession session, CancellationToken cancellationToken)
    {
        if (session.Status is not (ScanSessionStatus.Created or ScanSessionStatus.Captured) || session.ExpiresAtUtc > timeProvider.GetUtcNow()) return false;
        session.Status = ScanSessionStatus.Expired;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<MemoryStream> GeneratePdfAsync(ScanSession session, CancellationToken cancellationToken)
    {
        var pages = session.Pages.Where(item => item.Status == ScanPageStatus.Ready).OrderBy(item => item.Position).ToList();
        var resources = new List<IDisposable>();
        try
        {
            using var output = new PdfDocument();
            foreach (var page in pages)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await using var sourceStream = await fileStorage.OpenReadAsync(page.OriginalStorageKey, cancellationToken);
                var buffer = new MemoryStream();
                await sourceStream.CopyToAsync(buffer, cancellationToken);
                buffer.Position = 0;
                resources.Add(buffer);

                if (page.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
                {
                    var imported = PdfReader.Open(buffer, PdfDocumentOpenMode.Import);
                    resources.Add(imported);
                    var sourceIndex = Math.Clamp((page.SourcePageNumber ?? 1) - 1, 0, imported.PageCount - 1);
                    var target = output.AddPage(imported.Pages[sourceIndex]);
                    target.Rotate = (target.Rotate + page.RotationDegrees) % 360;
                }
                else
                {
                    var image = XImage.FromStream(buffer);
                    resources.Add(image);
                    var target = output.AddPage();
                    target.Width = XUnit.FromPoint(image.PointWidth);
                    target.Height = XUnit.FromPoint(image.PointHeight);
                    target.Rotate = page.RotationDegrees;
                    using var graphics = XGraphics.FromPdfPage(target);
                    graphics.DrawImage(image, 0, 0, target.Width.Point, target.Height.Point);
                }
            }

            var result = new MemoryStream();
            output.Save(result, false);
            result.Position = 0;
            return result;
        }
        catch (ValidationException)
        {
            throw;
        }
        catch (Exception exception)
        {
            throw new ConflictException($"No se pudo generar el PDF definitivo: {exception.Message}");
        }
        finally
        {
            foreach (var resource in resources.AsEnumerable().Reverse()) resource.Dispose();
        }
    }

    private void Touch(ScanSession session)
    {
        var now = timeProvider.GetUtcNow();
        session.LastSavedAtUtc = now;
        session.ExpiresAtUtc = DraftExpiresAt(now);
    }

    private DateTimeOffset DraftExpiresAt(DateTimeOffset now) => now.AddDays(Math.Clamp(scannerOptions.Value.DraftRetentionDays, 1, 365));

    private async Task ValidateReplacementAsync(Guid? documentId, DocumentContextType contextType, Guid contextId, string label, CancellationToken cancellationToken)
    {
        if (documentId is not Guid id) return;
        var document = await dbContext.Documents.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id && item.DeletedAtUtc == null, cancellationToken)
            ?? throw new NotFoundException("No se encontró el documento que se reemplazará.");
        ValidateReplacement(document, contextType, contextId, label);
    }

    private static void ValidateReplacement(DocumentRecord document, DocumentContextType contextType, Guid contextId, string label)
    {
        if (document.ContextType != contextType || document.ContextId != contextId ||
            !string.Equals(document.Label, label.Trim(), StringComparison.OrdinalIgnoreCase) || !document.IsCurrent)
            throw new ValidationException("El reemplazo debe conservar contexto y etiqueta, y apuntar a la versión vigente.");
    }

    private static void ValidateCreateRequest(CreateScanSessionRequest request)
    {
        if (request.ContextId == Guid.Empty) throw new ValidationException("El contexto documental es obligatorio.");
        if (string.IsNullOrWhiteSpace(request.Label) || request.Label.Length > 200) throw new ValidationException("La etiqueta es obligatoria y admite hasta 200 caracteres.");
        if (string.IsNullOrWhiteSpace(request.AcquisitionProvider) || request.AcquisitionProvider.Length > 50) throw new ValidationException("El proveedor de adquisición es obligatorio y admite hasta 50 caracteres.");
        if (request.ResolutionDpi is < 75 or > 1200) throw new ValidationException("La resolución debe estar entre 75 y 1200 DPI.");
        if (request.DeviceId?.Length > 250 || request.DeviceName?.Length > 250 || request.ColorMode?.Length > 40) throw new ValidationException("Los datos del dispositivo exceden la longitud permitida.");
    }

    private static Guid DeriveClientPageId(Guid root, int pageIndex)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{root:N}:{pageIndex}"));
        return new Guid(bytes[..16]);
    }

    private static string SafeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(value.Select(character => invalid.Contains(character) ? '-' : character).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "documento-digitalizado" : cleaned;
    }

    private static string? NullIfWhiteSpace(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ScanSessionDto Map(ScanSession item) => new(
        item.Id, item.Status, item.ContextType, item.ContextId, item.Label, item.ReplaceDocumentId,
        item.AcquisitionProvider, item.DeviceId, item.DeviceName, item.ResolutionDpi, item.ColorMode, item.Duplex,
        item.ExpiresAtUtc, item.CapturedAtUtc, item.PreviewedAtUtc, item.StagedFileName, item.StagedContentType,
        item.StagedSizeBytes, item.StagedSha256, item.PageCount, item.DocumentId, item.CompletedAtUtc,
        item.CancelledAtUtc, item.FailureCode, item.FailureMessage, item.CreatedByUserId, item.CreatedAtUtc,
        item.LastSavedAtUtc,
        item.Pages.Where(page => page.Status == ScanPageStatus.Ready).OrderBy(page => page.Position).Select(MapPage).ToList());

    private static ScanPageDto MapPage(ScanPage item) => new(
        item.Id, item.ClientPageId, item.Position, item.Source, item.Status, item.OriginalFileName,
        item.ContentType, item.SizeBytes, item.Sha256, item.SourcePageNumber, item.WidthPixels,
        item.HeightPixels, item.RotationDegrees, item.CreatedAtUtc, item.CreatedByUserId);

    private static DocumentDto MapDocument(DocumentRecord item) => new(
        item.Id, item.OriginalFileName, item.ContentType, item.SizeBytes, item.Sha256, item.Source,
        item.ContextType, item.ContextId, item.Label, item.VersionNumber, item.PreviousVersionId,
        item.IsCurrent, item.PageCount, item.CreatedAtUtc, item.CreatedByUserId);
}
