using System.Net;
using System.Net.Mail;
using System.Text;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Application.Operations;
using BufeteJuridico.Domain.Activities;
using BufeteJuridico.Domain.Reports;
using BufeteJuridico.Infrastructure.Branding;
using BufeteJuridico.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using BufeteJuridico.Infrastructure.Tenancy;

namespace BufeteJuridico.Infrastructure.Operations;

internal sealed class ActivityReportService(
    BufeteDbContext dbContext,
    IEmailSender emailSender,
    ICurrentUser currentUser,
    TimeProvider timeProvider,
    TenantContext tenantContext)
    : IActivityReportService
{
    private static readonly TimeZoneInfo ClinicTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById("America/Guatemala");

    public async Task<PagedResult<ActivityDto>> GetActivitiesAsync(
        DateTimeOffset? from,
        DateTimeOffset? to,
        Guid? userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        from = from?.ToUniversalTime();
        to = to?.ToUniversalTime();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.SecretariatActivities.AsNoTracking().AsQueryable();
        if (from is not null) query = query.Where(item => item.OccurredAtUtc >= from);
        if (to is not null) query = query.Where(item => item.OccurredAtUtc <= to);
        if (userId is not null) query = query.Where(item => item.CreatedByUserId == userId);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(item => item.OccurredAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<ActivityDto>(items.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<ActivityDto> CreateActivityAsync(SaveActivityRequest request, CancellationToken cancellationToken)
    {
        await ValidateActivityAsync(request, cancellationToken);
        var item = new SecretariatActivity
        {
            OccurredAtUtc = request.OccurredAtUtc,
            ActivityType = request.ActivityType.Trim(),
            Description = request.Description.Trim(),
            ClientId = request.ClientId,
            StudentId = request.StudentId,
            LegalCaseId = request.LegalCaseId
        };
        dbContext.SecretariatActivities.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public async Task<ActivityDto> CorrectActivityAsync(
        Guid id,
        SaveActivityRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CorrectionReason))
            throw new ValidationException("El motivo de corrección es obligatorio.");
        await ValidateActivityAsync(request, cancellationToken);
        var item = await dbContext.SecretariatActivities.SingleOrDefaultAsync(value => value.Id == id, cancellationToken)
            ?? throw new NotFoundException("No se encontró la actividad.");
        item.OccurredAtUtc = request.OccurredAtUtc;
        item.ActivityType = request.ActivityType.Trim();
        item.Description = request.Description.Trim();
        item.ClientId = request.ClientId;
        item.StudentId = request.StudentId;
        item.LegalCaseId = request.LegalCaseId;
        item.IsCorrected = true;
        item.CorrectionReason = request.CorrectionReason.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public async Task<WeeklyReportDto> GenerateWeeklyReportAsync(
        DateOnly start,
        DateOnly end,
        CancellationToken cancellationToken)
    {
        if (end < start || end.DayNumber - start.DayNumber > 31)
            throw new ValidationException("El período del reporte no es válido.");
        if (await dbContext.WeeklyReports.AnyAsync(item => item.PeriodStart == start && item.PeriodEnd == end, cancellationToken))
            throw new ConflictException("Ya existe un reporte para el período indicado.");

        var from = ToUtcBoundary(start);
        var until = ToUtcBoundary(end.AddDays(1));
        var activities = await dbContext.SecretariatActivities.AsNoTracking()
            .Where(item => item.OccurredAtUtc >= from && item.OccurredAtUtc < until)
            .OrderBy(item => item.OccurredAtUtc)
            .ToListAsync(cancellationToken);
        var responsibleIds = activities
            .Where(item => item.CreatedByUserId.HasValue)
            .Select(item => item.CreatedByUserId!.Value)
            .Distinct()
            .ToList();
        var responsibleNames = await dbContext.Users.AsNoTracking()
            .Where(item => responsibleIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.FullName, cancellationToken);

        var report = new WeeklyReport
        {
            PeriodStart = start,
            PeriodEnd = end,
            Status = WeeklyReportStatus.Draft,
            PrintableHtml = BuildReportHtml(start, end, activities, responsibleNames, tenantContext.Name)
        };
        foreach (var activity in activities)
            report.Activities.Add(new ReportActivity { SecretariatActivityId = activity.Id });

        dbContext.WeeklyReports.Add(report);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(report);
    }

    public async Task<WeeklyReportDto> GetReportAsync(Guid id, CancellationToken cancellationToken) =>
        Map(await LoadReportAsync(id, cancellationToken));

    public async Task<PagedResult<WeeklyReportDto>> GetReportsAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = dbContext.WeeklyReports.AsNoTracking();
        var total = await query.CountAsync(cancellationToken);
        var reports = await query
            .Include(item => item.Activities)
            .Include(item => item.Deliveries)
            .OrderByDescending(item => item.PeriodStart)
            .ThenByDescending(item => item.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<WeeklyReportDto>(reports.Select(Map).ToList(), page, pageSize, total);
    }

    public async Task<WeeklyReportDto> ReviewReportAsync(Guid id, CancellationToken cancellationToken)
    {
        var report = await LoadReportAsync(id, cancellationToken);
        if (report.Status is WeeklyReportStatus.Sent or WeeklyReportStatus.SendFailed)
            throw new ConflictException("El reporte ya tuvo un intento de envío.");
        report.Status = WeeklyReportStatus.Reviewed;
        report.ReviewedAtUtc = timeProvider.GetUtcNow();
        report.ReviewedByUserId = currentUser.UserId;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(report);
    }

    public async Task<WeeklyReportDto> SendReportAsync(
        Guid id,
        SendReportRequest request,
        CancellationToken cancellationToken)
    {
        var report = await LoadReportAsync(id, cancellationToken);
        if (report.Status != WeeklyReportStatus.Reviewed)
            throw new ConflictException("El reporte debe revisarse antes de enviarlo.");
        ValidateRecipients(request.Recipients);
        if (string.IsNullOrWhiteSpace(request.Subject)) throw new ValidationException("El asunto del correo es obligatorio.");

        var body = string.IsNullOrWhiteSpace(request.Message)
            ? report.PrintableHtml
            : $"<p>{WebUtility.HtmlEncode(request.Message)}</p>{report.PrintableHtml}";
        var delivery = new EmailDelivery
        {
            Recipients = string.Join(';', request.Recipients),
            Subject = request.Subject.Trim(),
            Status = EmailDeliveryStatus.Pending,
            AttemptedAtUtc = timeProvider.GetUtcNow()
        };
        delivery.WeeklyReport = report;
        dbContext.EmailDeliveries.Add(delivery);

        try
        {
            await emailSender.SendAsync(request.Recipients, request.Subject.Trim(), body, cancellationToken);
            delivery.Status = EmailDeliveryStatus.Sent;
            report.Status = WeeklyReportStatus.Sent;
            report.SentAtUtc = timeProvider.GetUtcNow();
            report.SentByUserId = currentUser.UserId;
        }
        catch (Exception exception) when (exception is SmtpException or InvalidOperationException)
        {
            delivery.Status = EmailDeliveryStatus.Failed;
            delivery.ErrorMessage = exception.Message.Length > 1000 ? exception.Message[..1000] : exception.Message;
            report.Status = WeeklyReportStatus.SendFailed;
            report.SentByUserId = currentUser.UserId;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(report);
    }

    private async Task ValidateActivityAsync(SaveActivityRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ActivityType) || string.IsNullOrWhiteSpace(request.Description))
            throw new ValidationException("Tipo y descripción de actividad son obligatorios.");
        if (request.ClientId is not null && !await dbContext.Clients.AnyAsync(item => item.Id == request.ClientId, cancellationToken))
            throw new NotFoundException("No se encontró el cliente relacionado.");
        if (request.StudentId is not null && !await dbContext.Students.AnyAsync(item => item.Id == request.StudentId, cancellationToken))
            throw new NotFoundException("No se encontró el alumno relacionado.");
        if (request.LegalCaseId is not null && !await dbContext.LegalCases.AnyAsync(item => item.Id == request.LegalCaseId, cancellationToken))
            throw new NotFoundException("No se encontró el expediente relacionado.");
    }

    private async Task<WeeklyReport> LoadReportAsync(Guid id, CancellationToken cancellationToken) =>
        await dbContext.WeeklyReports.Include(item => item.Activities).Include(item => item.Deliveries)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
        ?? throw new NotFoundException("No se encontró el reporte.");

    private static void ValidateRecipients(IReadOnlyList<string> recipients)
    {
        if (recipients.Count == 0) throw new ValidationException("Debe indicar al menos un destinatario.");
        try
        {
            foreach (var recipient in recipients) _ = new MailAddress(recipient);
        }
        catch (FormatException)
        {
            throw new ValidationException("Uno o más destinatarios no son válidos.");
        }
    }

    private static DateTimeOffset ToUtcBoundary(DateOnly date)
    {
        var local = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(local, ClinicTimeZone);
    }

    private static string BuildReportHtml(
        DateOnly start,
        DateOnly end,
        IReadOnlyList<SecretariatActivity> activities,
        IReadOnlyDictionary<Guid, string> responsibleNames,
        string tenantName)
    {
        var html = new StringBuilder()
            .Append("<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Reporte semanal</title>")
            .Append("<style>body{font-family:Arial,sans-serif;margin:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:8px;text-align:left}th{background:#eee}</style>")
            .Append("</head><body>").Append(InstitutionalReportHeader.Html(tenantName))
            .Append("<h1>Reporte semanal de actividades</h1><p>Período: ")
            .Append(start).Append(" al ").Append(end)
            .Append("</p><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Responsable</th></tr></thead><tbody>");
        foreach (var activity in activities)
        {
            var occurredAtLocal = TimeZoneInfo.ConvertTime(activity.OccurredAtUtc, ClinicTimeZone);
            var responsible = activity.CreatedByUserId is { } userId
                ? responsibleNames.GetValueOrDefault(userId, "Usuario no disponible")
                : "Sistema";
            html.Append("<tr><td>").Append(occurredAtLocal.ToString("yyyy-MM-dd HH:mm"))
                .Append("</td><td>").Append(WebUtility.HtmlEncode(activity.ActivityType))
                .Append("</td><td>").Append(WebUtility.HtmlEncode(activity.Description))
                .Append("</td><td>").Append(WebUtility.HtmlEncode(responsible))
                .Append("</td></tr>");
        }
        return html.Append("</tbody></table></body></html>").ToString();
    }

    private static ActivityDto Map(SecretariatActivity item) => new(
        item.Id, item.OccurredAtUtc, item.ActivityType, item.Description, item.ClientId, item.StudentId,
        item.LegalCaseId, item.IsCorrected, item.CorrectionReason, item.CreatedByUserId);

    private static WeeklyReportDto Map(WeeklyReport item) => new(
        item.Id, item.PeriodStart, item.PeriodEnd, item.Status, item.PrintableHtml, item.ReviewedAtUtc,
        item.ReviewedByUserId, item.SentAtUtc, item.SentByUserId, item.Activities.Count,
        item.Deliveries.OrderByDescending(value => value.AttemptedAtUtc).Select(value => new EmailDeliveryDto(
            value.Id, value.Recipients, value.Subject, value.Status, value.AttemptedAtUtc, value.ErrorMessage)).ToList());
}
