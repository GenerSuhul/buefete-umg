using System.Net;
using System.Net.Mail;
using BufeteJuridico.Application.Operations;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Operations;

internal sealed class SmtpEmailSender(IOptions<SmtpOptions> options) : IEmailSender
{
    public async Task SendAsync(
        IReadOnlyList<string> recipients,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
            throw new InvalidOperationException("El envío SMTP no está habilitado.");
        if (string.IsNullOrWhiteSpace(settings.Host) || string.IsNullOrWhiteSpace(settings.FromAddress))
            throw new InvalidOperationException("La configuración SMTP está incompleta.");

        using var message = new MailMessage
        {
            From = new MailAddress(settings.FromAddress, settings.FromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };

        foreach (var recipient in recipients) message.To.Add(recipient);

        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = settings.UseSsl
        };

        if (!string.IsNullOrWhiteSpace(settings.Username))
            client.Credentials = new NetworkCredential(settings.Username, settings.Password);

        await client.SendMailAsync(message, cancellationToken);
    }
}
