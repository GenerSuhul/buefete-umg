using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Clients;

public sealed class ClientRestriction : AuditableEntity
{
    public string Dpi { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string SourceTenantCode { get; set; } = string.Empty;
    public string IssuedByName { get; set; } = string.Empty;
}

public static class ClientRestrictionIdentity
{
    public static string Normalize(string? value)
    {
        var text = value?.Trim() ?? string.Empty;
        if (text.Any(c => !(c is >= '0' and <= '9') && c != ' ' && c != '-'))
            throw new ArgumentException("El DPI sólo admite dígitos y separadores.");
        var key = string.Concat(text.Where(c => c is >= '0' and <= '9'));
        if (key.Length != 13) throw new ArgumentException("El DPI debe contener los 13 dígitos del CUI.");
        return key;
    }
}
