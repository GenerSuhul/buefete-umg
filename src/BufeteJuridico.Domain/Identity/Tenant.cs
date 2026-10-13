using BufeteJuridico.Domain.Common;

namespace BufeteJuridico.Domain.Identity;

public sealed class Tenant : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;
    public string Status { get; set; } = "Provisioning";
    public bool IsActive { get; set; }
}
