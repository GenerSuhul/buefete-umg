using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Cases;
using BufeteJuridico.Application.Clients;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Students;
using BufeteJuridico.Domain.Cases;
using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Documents;
using BufeteJuridico.Domain.Students;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Cases;

internal sealed class CaseService(
    BufeteDbContext dbContext,
    ICurrentUser currentUser,
    TimeProvider timeProvider,
    IClientRestrictionService restrictions,
    IStudentDisciplineService studentDiscipline)
    : ICaseService
{
    public async Task<PagedResult<CaseSummaryDto>> GetCasesAsync(
        string? search,
        LegalCaseStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.LegalCases
            .AsNoTracking()
            .Include(item => item.Client)
            .Include(item => item.ProcessType)
            .Include(item => item.Assignments)
                .ThenInclude(item => item.Student)
            .Include(item => item.Timeline)
            .AsQueryable();

        if (!currentUser.HasPermission(Permissions.CasesRead))
        {
            var studentId = await GetCurrentStudentIdAsync(cancellationToken);
            query = query.Where(item => item.Assignments.Any(assignment =>
                assignment.StudentId == studentId && assignment.Status == CaseAssignmentStatus.Active));
        }

        if (status is not null) query = query.Where(item => item.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = TextNormalization.Normalize(search);
            query = query.Where(item =>
                item.CaseNumber.Contains(search.Trim()) ||
                item.Client.NormalizedFullName.Contains(normalized) ||
                item.ProcessType.Name.ToUpper().Contains(normalized));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(item => item.OpenedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var photos = await GetStudentPhotoMapAsync(items.SelectMany(item => item.Assignments).Select(item => item.Student), cancellationToken);

        return new PagedResult<CaseSummaryDto>(items.Select(item => MapSummary(item, photos)).ToList(), page, pageSize, total);
    }

    public async Task<CaseDetailDto> GetCaseAsync(Guid id, CancellationToken cancellationToken)
    {
        await EnsureCanReadCaseAsync(id, cancellationToken);
        var legalCase = await LoadCaseAsync(id, cancellationToken);
        var photos = await GetStudentPhotoMapAsync(legalCase.Assignments.Select(item => item.Student), cancellationToken);
        return await MapDetailAsync(legalCase, photos, cancellationToken);
    }

    public async Task<CaseDetailDto> OpenCaseAsync(OpenCaseRequest request, CancellationToken cancellationToken)
    {
        EnsureStaffWrite();
        var client = await dbContext.Clients.SingleOrDefaultAsync(item => item.Id == request.ClientId && item.IsActive, cancellationToken)
            ?? throw new NotFoundException("No se encontró el cliente.");
        await restrictions.EnsureAllowedAsync(client.Dpi, cancellationToken);
        var processType = await dbContext.ProcessTypes
            .Include(item => item.Requirements.Where(requirement => requirement.IsActive))
            .SingleOrDefaultAsync(item => item.Id == request.ProcessTypeId && item.IsActive, cancellationToken)
            ?? throw new NotFoundException("No se encontró el tipo de proceso activo.");

        var legalCase = new LegalCase
        {
            CaseNumber = GenerateCaseNumber(),
            Client = client,
            ProcessType = processType,
            Status = LegalCaseStatus.DocumentCollection,
            Stage = string.IsNullOrWhiteSpace(request.InitialStage) ? "RecoleccionDocumental" : request.InitialStage.Trim(),
            OpenedAtUtc = timeProvider.GetUtcNow()
        };

        foreach (var definition in processType.Requirements.OrderBy(item => item.SortOrder))
        {
            legalCase.Requirements.Add(new CaseRequirement
            {
                RequirementDefinitionId = definition.Id,
                RequirementLabel = definition.Label,
                Kind = definition.Kind,
                IsRequired = definition.IsRequired,
                IsConditional = definition.IsConditional,
                DocumentNature = definition.DocumentNature,
                MaximumAgeDays = definition.MaximumAgeDays,
                Status = RequirementFulfillmentStatus.Pending
            });
        }

        foreach (var counterparty in request.Counterparties ?? [])
        {
            ValidateCounterparty(counterparty);

            legalCase.Counterparties.Add(new Counterparty
            {
                FullName = counterparty.FullName.Trim(),
                Dpi = ContactNormalization.Cui(counterparty.Dpi),
                ResidenceAddress = Clean(counterparty.ResidenceAddress),
                WorkAddress = Clean(counterparty.WorkAddress),
                Phone = ContactNormalization.GuatemalaPhone(counterparty.Phone),
                Notes = Clean(counterparty.Notes)
            });
        }

        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.CaseOpened,
            OccurredAtUtc = legalCase.OpenedAtUtc,
            Title = "Expediente abierto",
            Description = $"Se abrió el expediente para {processType.Name}."
        });

        dbContext.LegalCases.Add(legalCase);
        await dbContext.SaveChangesAsync(cancellationToken);
        return await MapDetailAsync(await LoadCaseAsync(legalCase.Id, cancellationToken), cancellationToken: cancellationToken);
    }

    public async Task<CaseDetailDto> UpdateCaseAsync(
        Guid id,
        UpdateCaseRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite();
        if (string.IsNullOrWhiteSpace(request.Stage))
            throw new ValidationException("La etapa procesal es obligatoria.");
        if (request.Stage.Trim().Length > 160)
            throw new ValidationException("La etapa procesal no puede exceder 160 caracteres.");
        if (request.ConcurrencyToken == Guid.Empty)
            throw new ValidationException("La versión del expediente es obligatoria para guardar cambios.");
        if (request.Status is LegalCaseStatus.Closed or LegalCaseStatus.Archived)
            throw new ValidationException("Utilice las acciones de cierre o archivo para ese estado.");

        var legalCase = await dbContext.LegalCases
            .Include(item => item.Timeline)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        dbContext.Entry(legalCase).Property(item => item.ConcurrencyToken).OriginalValue = request.ConcurrencyToken;
        await EnsureCaseWritableAsync(legalCase, cancellationToken);

        var previousStatus = legalCase.Status;
        var previousStage = legalCase.Stage;
        legalCase.Status = request.Status;
        legalCase.Stage = request.Stage.Trim();
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.StatusChange,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Title = "Datos operativos del expediente actualizados",
            Description = $"Estado: {previousStatus} → {legalCase.Status}. Etapa: {previousStage} → {legalCase.Stage}."
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return await MapDetailAsync(await LoadCaseAsync(id, cancellationToken), cancellationToken: cancellationToken);
    }

    public async Task<CaseRequirementDto> UpdateRequirementAsync(
        Guid caseId,
        Guid requirementId,
        UpdateCaseRequirementRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite();
        var legalCase = await dbContext.LegalCases.Include(item => item.Requirements)
            .SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        await EnsureCaseWritableAsync(legalCase, cancellationToken);
        var requirement = legalCase.Requirements.SingleOrDefault(item => item.Id == requirementId)
            ?? throw new NotFoundException("No se encontró el requisito del expediente.");

        if (request.DocumentId is Guid requirementDocumentId)
        {
            await EnsureDocumentMatchesContextAsync(
                requirementDocumentId,
                DocumentContextType.CaseRequirement,
                requirement.Id,
                cancellationToken);
        }

        if (RequirementRules.RequiresEvidence(request.Status) &&
            !RequirementRules.HasEvidence(requirement.Kind, request.DocumentId, request.DataValue, request.ConditionMet))
        {
            throw new ValidationException(requirement.Kind == RequirementKind.Document
                ? "Adjunte un documento antes de registrar su revisión."
                : "Complete la evidencia requerida antes de registrar su revisión.");
        }

        if (request.Status == RequirementFulfillmentStatus.NotApplicable && !requirement.IsConditional)
            throw new ValidationException("Solo los requisitos condicionales pueden marcarse como no aplicables.");

        requirement.Status = RequirementRules.DetermineStatus(
            request.Status,
            request.DocumentIssueDate,
            requirement.MaximumAgeDays,
            DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime));
        requirement.DocumentId = request.DocumentId;
        requirement.DataValue = Clean(request.DataValue);
        requirement.ConditionMet = request.ConditionMet;
        requirement.DocumentIssueDate = request.DocumentIssueDate;
        requirement.Notes = Clean(request.Notes);
        requirement.ReviewedAtUtc = timeProvider.GetUtcNow();
        requirement.ReviewedByUserId = currentUser.UserId;

        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.RequirementUpdated,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Title = $"Requisito actualizado: {requirement.RequirementLabel}",
            Description = $"Estado: {requirement.Status}",
            DocumentId = requirement.DocumentId
        });

        if (legalCase.Requirements.Where(item => item.IsRequired).All(item => RequirementRules.IsSatisfied(item.Status, item.IsConditional)))
        {
            legalCase.Status = LegalCaseStatus.Active;
            if (legalCase.Stage == "RecoleccionDocumental") legalCase.Stage = "EnTramite";
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(requirement);
    }

    public async Task<CaseAssignmentDto> AssignStudentAsync(
        Guid caseId,
        AssignStudentRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite(Permissions.CasesAssign);
        var legalCase = await dbContext.LegalCases.Include(item => item.Assignments)
            .SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        await EnsureCaseWritableAsync(legalCase, cancellationToken);
        var student = await dbContext.Students.SingleOrDefaultAsync(item =>
                item.Id == request.StudentId &&
                item.IsActive &&
                dbContext.EnrollmentApplications.Any(enrollment =>
                    enrollment.StudentId == item.Id && enrollment.Status == EnrollmentStatus.Approved),
            cancellationToken)
            ?? throw new ConflictException("El alumno debe estar activo y tener una inscripción aprobada antes de recibir casos.");
        await studentDiscipline.EnsureNotBlockedAsync(student.Dpi, cancellationToken);

        if (legalCase.Assignments.Any(item => item.StudentId == request.StudentId && item.Status == CaseAssignmentStatus.Active))
            throw new ConflictException("El alumno ya está asignado al expediente.");

        if (request.IsPrimary)
        {
            foreach (var assignment in legalCase.Assignments.Where(item => item.IsPrimary && item.Status == CaseAssignmentStatus.Active))
                assignment.IsPrimary = false;
        }

        var item = new CaseAssignment
        {
            LegalCase = legalCase,
            Student = student,
            IsPrimary = request.IsPrimary,
            Status = CaseAssignmentStatus.Active,
            AssignedAtUtc = timeProvider.GetUtcNow()
        };
        dbContext.CaseAssignments.Add(item);
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Assignment,
            OccurredAtUtc = item.AssignedAtUtc,
            Title = "Alumno asignado",
            Description = student.FullName,
            PerformedByStudentId = student.Id
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        var photo = student.UserAccountId is Guid userId
            ? await dbContext.Users.Where(user => user.Id == userId).Select(user => user.PhotoDocumentId).SingleOrDefaultAsync(cancellationToken)
            : null;
        return new CaseAssignmentDto(item.Id, student.Id, student.FullName, photo, item.IsPrimary, item.Status, item.AssignedAtUtc, item.EndedAtUtc, item.EndReason);
    }

    public async Task<CounterpartyDto> SaveCounterpartyAsync(
        Guid caseId,
        Guid? counterpartyId,
        SaveCounterpartyRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite();
        ValidateCounterparty(request);
        var legalCase = await dbContext.LegalCases.Include(item => item.Counterparties)
            .SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        await EnsureCaseWritableAsync(legalCase, cancellationToken);
        Counterparty item;
        if (counterpartyId is null)
        {
            item = new Counterparty { LegalCase = legalCase };
            dbContext.Counterparties.Add(item);
        }
        else
        {
            item = legalCase.Counterparties.SingleOrDefault(value => value.Id == counterpartyId)
                ?? throw new NotFoundException("No se encontró la contraparte.");
        }

        item.FullName = request.FullName.Trim();
        item.Dpi = ContactNormalization.Cui(request.Dpi);
        item.ResidenceAddress = Clean(request.ResidenceAddress);
        item.WorkAddress = Clean(request.WorkAddress);
        item.Phone = ContactNormalization.GuatemalaPhone(request.Phone);
        item.Notes = Clean(request.Notes);
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.GeneralAction,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Title = counterpartyId is null ? "Contraparte agregada" : "Contraparte actualizada",
            Description = item.FullName
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public async Task EndAssignmentAsync(
        Guid caseId,
        Guid assignmentId,
        EndAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite(Permissions.CasesAssign);
        if (request.Status == CaseAssignmentStatus.Active || string.IsNullOrWhiteSpace(request.Reason))
            throw new ValidationException("Debe indicar un estado final y el motivo.");

        var assignment = await dbContext.CaseAssignments.Include(item => item.LegalCase).Include(item => item.Student)
            .SingleOrDefaultAsync(item => item.Id == assignmentId && item.LegalCaseId == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró la asignación.");
        if (assignment.Status != CaseAssignmentStatus.Active) throw new ConflictException("La asignación ya finalizó.");

        assignment.Status = request.Status;
        assignment.EndedAtUtc = timeProvider.GetUtcNow();
        assignment.EndReason = request.Reason.Trim();
        AddTimeline(assignment.LegalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Assignment,
            OccurredAtUtc = assignment.EndedAtUtc.Value,
            Title = "Asignación finalizada",
            Description = $"{assignment.Student.FullName}: {assignment.EndReason}",
            PerformedByStudentId = assignment.StudentId
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<TimelineEntryDto> AddTimelineEntryAsync(
        Guid caseId,
        AddTimelineEntryRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite(Permissions.CaseTimelineWrite);
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ValidationException("El título de la actuación es obligatorio.");
        if (request.Type != TimelineEntryType.GeneralAction)
            throw new ValidationException("Las notificaciones, presentaciones, asignaciones y cambios de estado deben registrarse desde su acción específica.");
        if (!string.IsNullOrWhiteSpace(request.NewStage) || request.NewStatus is not null)
            throw new ValidationException("Una actuación general no puede modificar el estado ni la etapa del expediente.");
        var legalCase = await dbContext.LegalCases.SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        await EnsureCaseWritableAsync(legalCase, cancellationToken);

        if (request.DocumentId is Guid timelineDocumentId)
            await EnsureDocumentBelongsToCaseAsync(timelineDocumentId, caseId, cancellationToken);

        if (request.PerformedByStudentId is Guid studentId &&
            !await dbContext.CaseAssignments.AnyAsync(item =>
                item.LegalCaseId == caseId &&
                item.StudentId == studentId &&
                item.Status == CaseAssignmentStatus.Active,
                cancellationToken))
        {
            throw new ValidationException("El alumno indicado no tiene una asignación activa en el expediente.");
        }

        var item = new TimelineEntry
        {
            LegalCase = legalCase,
            Type = request.Type,
            OccurredAtUtc = request.OccurredAtUtc,
            Title = request.Title.Trim(),
            Description = Clean(request.Description),
            PerformedByStudentId = request.PerformedByStudentId,
            DocumentId = request.DocumentId
        };
        dbContext.TimelineEntries.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public async Task<MemorialDto> CreateMemorialAsync(
        Guid caseId,
        CreateMemorialRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureCanWriteMemorialAsync(caseId, request.SubmittedByStudentId, cancellationToken);
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ValidationException("El título del memorial es obligatorio.");
        await EnsureDocumentMatchesContextAsync(request.DocumentId, DocumentContextType.LegalCase, caseId, cancellationToken);
        var legalCase = await dbContext.LegalCases.SingleAsync(item => item.Id == caseId, cancellationToken);
        await EnsureCaseWritableAsync(legalCase, cancellationToken);

        var memorial = new Memorial
        {
            LegalCase = legalCase,
            Title = request.Title.Trim(),
            Status = MemorialStatus.Received
        };
        memorial.Versions.Add(new MemorialVersion
        {
            VersionNumber = 1,
            DocumentId = request.DocumentId,
            SubmittedByStudentId = request.SubmittedByStudentId,
            Notes = Clean(request.Notes)
        });
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Memorial,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Title = $"Memorial recibido: {memorial.Title}",
            DocumentId = request.DocumentId,
            PerformedByStudentId = request.SubmittedByStudentId
        });
        dbContext.Memorials.Add(memorial);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(memorial);
    }

    public async Task<MemorialDto> AddMemorialVersionAsync(
        Guid caseId,
        Guid memorialId,
        AddMemorialVersionRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureCanWriteMemorialAsync(caseId, request.SubmittedByStudentId, cancellationToken);
        await EnsureDocumentMatchesContextAsync(request.DocumentId, DocumentContextType.Memorial, memorialId, cancellationToken);
        var memorial = await LoadMemorialAsync(caseId, memorialId, cancellationToken);
        await EnsureCaseWritableAsync(memorial.LegalCase, cancellationToken);
        var version = new MemorialVersion
        {
            Memorial = memorial,
            VersionNumber = memorial.Versions.Count == 0 ? 1 : memorial.Versions.Max(item => item.VersionNumber) + 1,
            DocumentId = request.DocumentId,
            SubmittedByStudentId = request.SubmittedByStudentId,
            Notes = Clean(request.Notes)
        };
        dbContext.MemorialVersions.Add(version);
        memorial.Status = MemorialStatus.Corrected;
        AddTimeline(memorial.LegalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Memorial,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Title = $"Nueva versión de memorial: {memorial.Title}",
            Description = $"Versión {version.VersionNumber}",
            DocumentId = request.DocumentId,
            PerformedByStudentId = request.SubmittedByStudentId
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(memorial);
    }

    public async Task<MemorialDto> ReviewMemorialAsync(
        Guid caseId,
        Guid memorialId,
        ReviewMemorialRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite(Permissions.CaseTimelineWrite);
        if (string.IsNullOrWhiteSpace(request.Observations)) throw new ValidationException("Las observaciones de revisión son obligatorias.");
        var memorial = await LoadMemorialAsync(caseId, memorialId, cancellationToken);
        await EnsureCaseWritableAsync(memorial.LegalCase, cancellationToken);
        var version = memorial.Versions.SingleOrDefault(item => item.Id == request.VersionId)
            ?? throw new NotFoundException("No se encontró la versión del memorial.");
        var latestVersion = memorial.Versions.OrderByDescending(item => item.VersionNumber).First();
        if (version.Id != latestVersion.Id)
            throw new ConflictException("Solo se puede revisar la versión más reciente del memorial.");
        if (request.ReviewedDocumentId is Guid reviewedDocumentId)
            await EnsureDocumentMatchesContextAsync(reviewedDocumentId, DocumentContextType.Memorial, memorialId, cancellationToken);
        var review = new MemorialReview
        {
            MemorialVersion = version,
            Outcome = request.Outcome,
            Observations = request.Observations.Trim(),
            ReviewedDocumentId = request.ReviewedDocumentId,
            ReviewedAtUtc = timeProvider.GetUtcNow()
        };
        dbContext.MemorialReviews.Add(review);
        memorial.Status = request.Outcome == ReviewOutcome.Approved
            ? MemorialStatus.ApprovedForSignature
            : MemorialStatus.RequiresCorrection;
        AddTimeline(memorial.LegalCase, new TimelineEntry
        {
            Type = TimelineEntryType.MemorialReview,
            OccurredAtUtc = review.ReviewedAtUtc,
            Title = $"Revisión de memorial: {memorial.Title}",
            Description = request.Observations.Trim(),
            DocumentId = request.ReviewedDocumentId
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(memorial);
    }

    public async Task PresentMemorialAsync(
        Guid caseId,
        Guid memorialId,
        PresentMemorialRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite(Permissions.CaseTimelineWrite);
        var memorial = await LoadMemorialAsync(caseId, memorialId, cancellationToken);
        await EnsureCaseWritableAsync(memorial.LegalCase, cancellationToken);
        if (memorial.Status != MemorialStatus.ApprovedForSignature)
            throw new ConflictException("El memorial debe estar aprobado para firma antes de presentarse.");
        if (string.IsNullOrWhiteSpace(request.Result)) throw new ValidationException("Debe registrar el resultado de la presentación.");
        var approvedVersion = memorial.Versions.OrderByDescending(item => item.VersionNumber).First();
        if (!approvedVersion.Reviews.Any(item => item.Outcome == ReviewOutcome.Approved))
            throw new ConflictException("La versión más reciente del memorial debe tener una revisión aprobada.");
        if (request.PresentedDocumentId is Guid presentedDocumentId)
            await EnsureDocumentMatchesContextAsync(presentedDocumentId, DocumentContextType.Memorial, memorialId, cancellationToken);
        if (request.ReceiptDocumentId is Guid receiptDocumentId)
            await EnsureDocumentMatchesContextAsync(receiptDocumentId, DocumentContextType.Memorial, memorialId, cancellationToken);

        dbContext.CasePresentations.Add(new CasePresentation
        {
            LegalCaseId = caseId,
            MemorialId = memorialId,
            MemorialVersionId = approvedVersion.Id,
            PresentedAtUtc = request.PresentedAtUtc,
            Result = request.Result.Trim(),
            PresentedDocumentId = request.PresentedDocumentId,
            ReceiptDocumentId = request.ReceiptDocumentId
        });
        memorial.Status = MemorialStatus.Presented;
        AddTimeline(memorial.LegalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Presentation,
            OccurredAtUtc = request.PresentedAtUtc,
            Title = $"Memorial presentado: {memorial.Title}",
            Description = request.Result.Trim(),
            DocumentId = request.PresentedDocumentId
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AddCourtNotificationAsync(
        Guid caseId,
        AddCourtNotificationRequest request,
        CancellationToken cancellationToken)
    {
        EnsureStaffWrite(Permissions.CaseTimelineWrite);
        if (string.IsNullOrWhiteSpace(request.Description)) throw new ValidationException("La descripción de la notificación es obligatoria.");
        await EnsureDocumentMatchesContextAsync(request.DocumentId, DocumentContextType.LegalCase, caseId, cancellationToken);
        var legalCase = await dbContext.LegalCases.SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        await EnsureCaseWritableAsync(legalCase, cancellationToken);

        dbContext.CourtNotifications.Add(new CourtNotification
        {
            LegalCaseId = caseId,
            NotifiedAtUtc = request.NotifiedAtUtc,
            Description = request.Description.Trim(),
            DocumentId = request.DocumentId,
            NewStage = Clean(request.NewStage)
        });
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.CourtNotification,
            OccurredAtUtc = request.NotifiedAtUtc,
            Title = "Notificación del juzgado",
            Description = request.Description.Trim(),
            DocumentId = request.DocumentId
        });
        if (!string.IsNullOrWhiteSpace(request.NewStage)) legalCase.Stage = request.NewStage.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task CloseCaseAsync(Guid caseId, CloseCaseRequest request, CancellationToken cancellationToken)
    {
        EnsureStaffWrite();
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ValidationException("El motivo de cierre es obligatorio.");
        var legalCase = await dbContext.LegalCases.SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        EnsureCaseOpen(legalCase);
        legalCase.Status = LegalCaseStatus.Closed;
        legalCase.Stage = "Cerrado";
        legalCase.ClosedAtUtc = request.ClosedAtUtc;
        legalCase.ClosureReason = request.Reason.Trim();
        legalCase.RetentionStartsAtUtc = request.ClosedAtUtc;
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Closure,
            OccurredAtUtc = request.ClosedAtUtc,
            Title = "Expediente cerrado",
            Description = request.Reason.Trim()
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ReopenCaseAsync(Guid caseId, string reason, CancellationToken cancellationToken)
    {
        EnsureStaffWrite();
        if (string.IsNullOrWhiteSpace(reason)) throw new ValidationException("El motivo de reapertura es obligatorio.");
        var legalCase = await dbContext.LegalCases.SingleOrDefaultAsync(item => item.Id == caseId, cancellationToken)
            ?? throw new NotFoundException("No se encontró el expediente.");
        if (legalCase.Status != LegalCaseStatus.Closed) throw new ConflictException("Solo se puede reabrir un expediente cerrado.");
        await restrictions.EnsureCaseAllowedAsync(caseId, cancellationToken);
        legalCase.Status = LegalCaseStatus.Active;
        legalCase.Stage = "Reabierto";
        legalCase.ClosedAtUtc = null;
        legalCase.ClosureReason = null;
        legalCase.RetentionStartsAtUtc = null;
        AddTimeline(legalCase, new TimelineEntry
        {
            Type = TimelineEntryType.Reopening,
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Title = "Expediente reabierto",
            Description = reason.Trim()
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<LegalCase> LoadCaseAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.LegalCases.AsNoTracking()
            .Include(item => item.Client)
            .Include(item => item.ProcessType)
            .Include(item => item.Requirements)
            .Include(item => item.Counterparties)
            .Include(item => item.Assignments).ThenInclude(item => item.Student)
            .Include(item => item.Timeline)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
        ?? throw new NotFoundException("No se encontró el expediente.");

    private async Task<Memorial> LoadMemorialAsync(Guid caseId, Guid memorialId, CancellationToken cancellationToken) =>
        await dbContext.Memorials
            .Include(item => item.LegalCase)
            .Include(item => item.Versions).ThenInclude(item => item.Reviews)
            .SingleOrDefaultAsync(item => item.Id == memorialId && item.LegalCaseId == caseId, cancellationToken)
        ?? throw new NotFoundException("No se encontró el memorial.");

    private async Task EnsureCanReadCaseAsync(Guid caseId, CancellationToken cancellationToken)
    {
        if (currentUser.HasPermission(Permissions.CasesRead)) return;
        var studentId = await GetCurrentStudentIdAsync(cancellationToken);
        if (!await dbContext.CaseAssignments.AnyAsync(item =>
                item.LegalCaseId == caseId && item.StudentId == studentId && item.Status == CaseAssignmentStatus.Active,
            cancellationToken))
            throw new ForbiddenException("El expediente no está asignado al alumno autenticado.");
    }

    private async Task EnsureCanWriteMemorialAsync(Guid caseId, Guid? submittedByStudentId, CancellationToken cancellationToken)
    {
        if (currentUser.HasPermission(Permissions.CaseTimelineWrite)) return;
        if (!currentUser.HasPermission(Permissions.AssignedMemorialWrite))
            throw new ForbiddenException("No tiene permiso para registrar memoriales.");
        var studentId = await GetCurrentStudentIdAsync(cancellationToken);
        if (submittedByStudentId != studentId)
            throw new ForbiddenException("El alumno solo puede registrar memoriales con su propia identidad.");
        if (!await dbContext.CaseAssignments.AnyAsync(item => item.LegalCaseId == caseId && item.StudentId == studentId && item.Status == CaseAssignmentStatus.Active, cancellationToken))
            throw new ForbiddenException("El expediente no está asignado al alumno autenticado.");
    }

    private async Task<Guid> GetCurrentStudentIdAsync(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException("No se pudo identificar al usuario.");
        return await dbContext.Students.Where(item => item.UserAccountId == userId && item.IsActive).Select(item => item.Id).SingleOrDefaultAsync(cancellationToken) is var id && id != Guid.Empty
            ? id
            : throw new ForbiddenException("La cuenta no está vinculada con un alumno activo.");
    }

    private void EnsureStaffWrite(string permission = Permissions.CasesWrite)
    {
        if (!currentUser.HasPermission(permission)) throw new ForbiddenException("No tiene permiso para modificar expedientes.");
    }

    private async Task EnsureCaseWritableAsync(LegalCase legalCase, CancellationToken cancellationToken)
    {
        EnsureCaseOpen(legalCase);
        await restrictions.EnsureCaseAllowedAsync(legalCase.Id, cancellationToken);
    }

    private static void EnsureCaseOpen(LegalCase legalCase)
    {
        if (legalCase.Status is LegalCaseStatus.Closed or LegalCaseStatus.Archived)
            throw new ConflictException("El expediente está cerrado o archivado.");
    }

    private async Task EnsureDocumentMatchesContextAsync(
        Guid id,
        DocumentContextType contextType,
        Guid contextId,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Documents.AnyAsync(item =>
                item.Id == id &&
                item.ContextType == contextType &&
                item.ContextId == contextId &&
                item.IsCurrent &&
                item.DeletedAtUtc == null,
                cancellationToken))
        {
            throw new ValidationException("El documento no pertenece al registro que se está actualizando o no es su versión vigente.");
        }
    }

    private async Task EnsureDocumentBelongsToCaseAsync(Guid id, Guid caseId, CancellationToken cancellationToken)
    {
        var document = await dbContext.Documents.AsNoTracking().SingleOrDefaultAsync(item =>
            item.Id == id && item.IsCurrent && item.DeletedAtUtc == null,
            cancellationToken)
            ?? throw new NotFoundException("No se encontró el documento asociado.");

        var ownerCaseId = document.ContextType switch
        {
            DocumentContextType.LegalCase => document.ContextId,
            DocumentContextType.CaseRequirement => await dbContext.CaseRequirements
                .Where(item => item.Id == document.ContextId)
                .Select(item => (Guid?)item.LegalCaseId)
                .SingleOrDefaultAsync(cancellationToken),
            DocumentContextType.Timeline => await dbContext.TimelineEntries
                .Where(item => item.Id == document.ContextId)
                .Select(item => (Guid?)item.LegalCaseId)
                .SingleOrDefaultAsync(cancellationToken),
            DocumentContextType.Memorial => await dbContext.Memorials
                .Where(item => item.Id == document.ContextId)
                .Select(item => (Guid?)item.LegalCaseId)
                .SingleOrDefaultAsync(cancellationToken),
            _ => null
        };

        if (ownerCaseId != caseId)
            throw new ValidationException("El documento no pertenece a este expediente.");
    }

    private void AddTimeline(LegalCase legalCase, TimelineEntry entry)
    {
        entry.LegalCase = legalCase;
        dbContext.TimelineEntries.Add(entry);
    }

    private string GenerateCaseNumber() => $"EXP-{timeProvider.GetUtcNow():yyyy}-{Guid.NewGuid():N}"[..21].ToUpperInvariant();

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ValidateCounterparty(SaveCounterpartyRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.FullName))
            errors["fullName"] = ["El nombre de la contraparte es obligatorio."];
        if (!ContactNormalization.IsValidCui(request.Dpi, required: false))
            errors["dpi"] = ["El DPI debe contener los 13 dígitos del CUI."];
        if (!ContactNormalization.IsValidGuatemalaPhone(request.Phone))
            errors["phone"] = ["El teléfono debe contener 8 dígitos o el prefijo +502."];
        if (errors.Count > 0)
            throw new ValidationException("Revise los datos de la contraparte.", errors);
    }

    private async Task<CaseDetailDto> MapDetailAsync(
        LegalCase legalCase,
        IReadOnlyDictionary<Guid, Guid?>? photos = null,
        CancellationToken cancellationToken = default)
    {
        var memorialEntities = await dbContext.Memorials.AsNoTracking()
            .Include(item => item.Versions).ThenInclude(item => item.Reviews)
            .Where(item => item.LegalCaseId == legalCase.Id)
            .OrderBy(item => item.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var memorials = memorialEntities.Select(Map).ToList();
        var presentations = await dbContext.CasePresentations.AsNoTracking()
            .Where(item => item.LegalCaseId == legalCase.Id)
            .OrderBy(item => item.PresentedAtUtc)
            .Join(dbContext.Memorials.AsNoTracking(),
                presentation => presentation.MemorialId,
                memorial => (Guid?)memorial.Id,
                (presentation, memorial) => new CasePresentationDto(
                    presentation.Id,
                    memorial.Id,
                    memorial.Title,
                    presentation.MemorialVersionId,
                    presentation.PresentedAtUtc,
                    presentation.Result,
                    presentation.PresentedDocumentId,
                    presentation.ReceiptDocumentId,
                    presentation.CreatedByUserId))
            .ToListAsync(cancellationToken);
        var notifications = await dbContext.CourtNotifications.AsNoTracking()
            .Where(item => item.LegalCaseId == legalCase.Id)
            .OrderBy(item => item.NotifiedAtUtc)
            .Select(item => new CourtNotificationDto(
                item.Id,
                item.NotifiedAtUtc,
                item.Description,
                item.DocumentId,
                item.NewStage,
                item.CreatedByUserId))
            .ToListAsync(cancellationToken);
        return new CaseDetailDto(
            MapSummary(legalCase, photos),
            legalCase.Requirements.OrderBy(item => item.RequirementLabel).Select(Map).ToList(),
            legalCase.Counterparties.Select(Map).ToList(),
            legalCase.Timeline.OrderBy(item => item.OccurredAtUtc).Select(Map).ToList(),
            memorials,
            presentations,
            notifications,
            await restrictions.GetStatusAsync(legalCase.Client.Dpi, cancellationToken));
    }

    private CaseSummaryDto MapSummary(LegalCase item, IReadOnlyDictionary<Guid, Guid?>? photos = null) => new(
        item.Id,
        item.CaseNumber,
        item.ClientId,
        item.Client.FullName,
        item.ProcessTypeId,
        item.ProcessType.Name,
        item.Status,
        item.Stage,
        item.OpenedAtUtc,
        item.ClosedAtUtc,
        item.Timeline.OrderByDescending(value => value.OccurredAtUtc).Select(Map).FirstOrDefault(),
        item.Assignments.OrderByDescending(value => value.IsPrimary).ThenBy(value => value.Student.FullName).Select(value => Map(value, photos)).ToList(),
        item.ConcurrencyToken);

    private CaseRequirementDto Map(CaseRequirement item) => new(
        item.Id,
        item.RequirementDefinitionId,
        item.RequirementLabel,
        item.Kind,
        item.IsRequired,
        item.IsConditional,
        item.Status,
        item.DocumentId,
        item.DataValue,
        item.ConditionMet,
        item.DocumentIssueDate,
        item.Notes,
        item.Status == RequirementFulfillmentStatus.Expired ||
        (item.DocumentIssueDate is not null && item.MaximumAgeDays is not null && item.DocumentIssueDate.Value.AddDays(item.MaximumAgeDays.Value) < DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime)));

    private static CaseAssignmentDto Map(CaseAssignment item, IReadOnlyDictionary<Guid, Guid?>? photos = null) => new(
        item.Id, item.StudentId, item.Student.FullName,
        item.Student.UserAccountId is Guid userId && photos?.TryGetValue(userId, out var photo) == true ? photo : null,
        item.IsPrimary, item.Status, item.AssignedAtUtc, item.EndedAtUtc, item.EndReason);

    private async Task<Dictionary<Guid, Guid?>> GetStudentPhotoMapAsync(IEnumerable<Student> students, CancellationToken cancellationToken)
    {
        var userIds = students.Where(item => item.UserAccountId.HasValue).Select(item => item.UserAccountId!.Value).Distinct().ToList();
        return await dbContext.Users.AsNoTracking().Where(item => userIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.PhotoDocumentId, cancellationToken);
    }

    private static CounterpartyDto Map(Counterparty item) => new(
        item.Id, item.FullName, item.Dpi, item.ResidenceAddress, item.WorkAddress, item.Phone, item.Notes);

    private static TimelineEntryDto Map(TimelineEntry item) => new(
        item.Id, item.Type, item.OccurredAtUtc, item.Title, item.Description, item.PerformedByStudentId, item.DocumentId, item.CreatedByUserId);

    private static MemorialDto Map(Memorial item) => new(
        item.Id,
        item.Title,
        item.Status,
        item.Versions.OrderBy(value => value.VersionNumber).Select(value => new MemorialVersionDto(
            value.Id,
            value.VersionNumber,
            value.DocumentId,
            value.SubmittedByStudentId,
            value.Notes,
            value.Reviews.OrderBy(review => review.ReviewedAtUtc).Select(review => new MemorialReviewDto(
                review.Id,
                review.Outcome,
                review.Observations,
                review.ReviewedDocumentId,
                review.ReviewedAtUtc,
                review.CreatedByUserId)).ToList())).ToList());
}
