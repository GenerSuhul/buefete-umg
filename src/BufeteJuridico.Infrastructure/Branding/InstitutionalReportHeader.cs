namespace BufeteJuridico.Infrastructure.Branding;

internal static class InstitutionalReportHeader
{
    private static readonly Lazy<string> Logo = new(() =>
    {
        using var stream = typeof(InstitutionalReportHeader).Assembly.GetManifestResourceStream(
            "BufeteJuridico.Infrastructure.Branding.umg.png")
            ?? throw new InvalidOperationException("No se encontró el logotipo institucional.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return Convert.ToBase64String(buffer.ToArray());
    });

    public static string Html =>
        $"<header style=\"display:flex;align-items:center;gap:18px;border-bottom:2px solid #0c365f;padding-bottom:16px;margin-bottom:24px\">" +
        $"<img src=\"data:image/png;base64,{Logo.Value}\" alt=\"Universidad Mariano Gálvez\" width=\"72\" height=\"72\" style=\"object-fit:contain\">" +
        "<div><strong style=\"font-size:20px;color:#0c365f\">Bufete Popular UMG</strong>" +
        "<div>Universidad Mariano Gálvez de Guatemala</div><div>Sede Petén</div></div></header>";
}
