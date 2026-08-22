using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Catalogs;
using BufeteJuridico.Domain.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BufeteJuridico.Infrastructure.Persistence;

internal sealed class DatabaseInitializer(
    BufeteDbContext dbContext,
    IPasswordHasher<UserAccount> passwordHasher,
    IOptions<BootstrapAdminOptions> adminOptions,
    TimeProvider timeProvider)
    : IDatabaseInitializer
{
    private static readonly string[] SecretariatPermissionCodes =
    [
        Permissions.ClientsRead,
        Permissions.ClientsWrite,
        Permissions.StudentsRead,
        Permissions.StudentsWrite,
        Permissions.CatalogsRead,
        Permissions.CasesRead,
        Permissions.CasesWrite,
        Permissions.CasesAssign,
        Permissions.CaseTimelineWrite,
        Permissions.DocumentsRead,
        Permissions.DocumentsWrite,
        Permissions.ScannerUse,
        Permissions.ActivitiesRead,
        Permissions.ActivitiesWrite,
        Permissions.ReportsGenerate,
        Permissions.ReportsSend
    ];

    private static readonly string[] StudentPermissionCodes =
    [
        Permissions.StudentSelfRead,
        Permissions.CasesAssignedRead,
        Permissions.DocumentsRead
    ];

    public async Task InitialiseAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);
        await SeedPermissionsAndRolesAsync(cancellationToken);
        await SeedAdministratorAsync(cancellationToken);
        await SeedProcessCatalogAsync(cancellationToken);
        await SeedStudentRequirementsAsync(cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedPermissionsAndRolesAsync(CancellationToken cancellationToken)
    {
        var existingPermissions = await dbContext.Permissions.ToDictionaryAsync(item => item.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);
        foreach (var definition in Permissions.All)
        {
            if (!existingPermissions.ContainsKey(definition.Code))
            {
                var permission = new Permission
                {
                    Code = definition.Code,
                    Module = definition.Module,
                    Description = definition.Description
                };
                dbContext.Permissions.Add(permission);
                existingPermissions[definition.Code] = permission;
            }
        }

        await EnsureRoleAsync("Administrador", "Acceso total al sistema.", Permissions.All.Select(item => item.Code), existingPermissions, cancellationToken);
        await EnsureRoleAsync("Secretaria", "Operación integral del bufete sin administración de usuarios.", SecretariatPermissionCodes, existingPermissions, cancellationToken);
        await EnsureRoleAsync("Alumno", "Acceso al perfil propio y a expedientes asignados.", StudentPermissionCodes, existingPermissions, cancellationToken);
    }

    private async Task EnsureRoleAsync(
        string name,
        string description,
        IEnumerable<string> defaultPermissionCodes,
        IReadOnlyDictionary<string, Permission> permissions,
        CancellationToken cancellationToken)
    {
        var normalizedName = TextNormalization.Normalize(name);
        var role = await dbContext.Roles
            .Include(item => item.Permissions)
            .ThenInclude(item => item.Permission)
            .SingleOrDefaultAsync(item => item.NormalizedName == normalizedName, cancellationToken);
        if (role is null)
        {
            role = new Role
            {
                Name = name,
                NormalizedName = normalizedName,
                Description = description,
                IsSystem = true,
                IsActive = true
            };
            dbContext.Roles.Add(role);
        }

        var existingCodes = role.Permissions
            .Select(item => item.Permission.Code)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var desiredCodes = defaultPermissionCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var obsolete = role.Permissions.Where(item => !desiredCodes.Contains(item.Permission.Code)).ToList();
        if (obsolete.Count > 0)
        {
            dbContext.RolePermissions.RemoveRange(obsolete);
            foreach (var item in obsolete) role.Permissions.Remove(item);
        }
        foreach (var code in desiredCodes)
        {
            if (!existingCodes.Contains(code))
            {
                var rolePermission = new RolePermission { Role = role, Permission = permissions[code] };
                role.Permissions.Add(rolePermission);
                dbContext.RolePermissions.Add(rolePermission);
            }
        }
    }

    private async Task SeedAdministratorAsync(CancellationToken cancellationToken)
    {
        if (await dbContext.Users.AnyAsync(cancellationToken)) return;
        var options = adminOptions.Value;
        if (string.IsNullOrWhiteSpace(options.Username) ||
            string.IsNullOrWhiteSpace(options.Email) ||
            string.IsNullOrWhiteSpace(options.FullName) ||
            string.IsNullOrWhiteSpace(options.Password))
        {
            throw new InvalidOperationException("BootstrapAdmin está incompleto y no existe ningún usuario en la base de datos.");
        }

        var adminRole = dbContext.Roles.Local.FirstOrDefault(item => item.NormalizedName == "ADMINISTRADOR");
        adminRole ??= await dbContext.Roles.SingleAsync(
            item => item.NormalizedName == "ADMINISTRADOR",
            cancellationToken);
        var user = new UserAccount
        {
            Username = options.Username.Trim(),
            NormalizedUsername = TextNormalization.Normalize(options.Username),
            Email = options.Email.Trim(),
            NormalizedEmail = TextNormalization.Normalize(options.Email),
            FullName = options.FullName.Trim(),
            IsActive = true,
            ParticipationStartDate = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime)
        };
        user.PasswordHash = passwordHasher.HashPassword(user, options.Password);
        user.Roles.Add(new UserRole
        {
            User = user,
            Role = adminRole,
            AssignedAtUtc = timeProvider.GetUtcNow()
        });
        dbContext.Users.Add(user);
    }

    private async Task SeedProcessCatalogAsync(CancellationToken cancellationToken)
    {
        var definitions = BuildProcessSeeds();
        foreach (var seed in definitions)
        {
            var processType = await dbContext.ProcessTypes.Include(item => item.Requirements)
                .SingleOrDefaultAsync(item => item.Code == seed.Code, cancellationToken);
            if (processType is null)
            {
                processType = new ProcessType
                {
                    Code = seed.Code,
                    Name = seed.Name,
                    Description = seed.Description,
                    IsActive = true
                };
                dbContext.ProcessTypes.Add(processType);
            }

            foreach (var requirement in seed.Requirements)
            {
                if (processType.Requirements.Any(item => item.Code == requirement.Code)) continue;
                var entity = ToEntity(requirement, RequirementScope.Process);
                entity.ProcessType = processType;
                dbContext.RequirementDefinitions.Add(entity);
            }
        }
    }

    private async Task SeedStudentRequirementsAsync(CancellationToken cancellationToken)
    {
        foreach (var seed in StudentRequirementSeeds())
        {
            if (await dbContext.RequirementDefinitions.AnyAsync(item =>
                    item.Scope == RequirementScope.StudentEnrollment && item.Code == seed.Code,
                cancellationToken))
                continue;
            dbContext.RequirementDefinitions.Add(ToEntity(seed, RequirementScope.StudentEnrollment));
        }
    }

    private static RequirementDefinition ToEntity(RequirementSeed seed, RequirementScope scope) => new()
    {
        Scope = scope,
        Code = seed.Code,
        Label = seed.Label,
        Kind = seed.Kind,
        IsRequired = seed.Required,
        IsConditional = seed.Conditional,
        ConditionDescription = seed.Condition,
        DocumentNature = seed.Nature,
        MaximumAgeDays = seed.MaximumAgeDays,
        Subject = seed.Subject,
        Instructions = seed.Instructions,
        SortOrder = seed.Order,
        IsActive = true
    };

    private static IReadOnlyList<ProcessSeed> BuildProcessSeeds()
    {
        static RequirementSeed Document(string code, string label, int order, DocumentNature nature = DocumentNature.Original, int? age = null, string? subject = null, bool conditional = false, string? condition = null) =>
            new(code, label, RequirementKind.Document, true, conditional, condition, nature, age, subject, null, order);
        static RequirementSeed Data(string code, string label, int order, string? subject = null, bool conditional = false, string? condition = null) =>
            new(code, label, RequirementKind.Data, true, conditional, condition, DocumentNature.NotApplicable, null, subject, null, order);
        static RequirementSeed Condition(string code, string label, int order, string? instructions = null) =>
            new(code, label, RequirementKind.Condition, true, false, null, DocumentNature.NotApplicable, null, null, instructions, order);

        return
        [
            new("FIJACION_PENSION", "Juicio oral de fijación de pensión alimenticia", "Catálogo parcial confirmado por el cliente.",
            [
                Document("MATRIMONIO", "Certificación original y reciente de matrimonio", 1, age: 183),
                Document("NACIMIENTO_HIJOS", "Certificación de nacimiento de hijos menores", 2, age: 183, subject: "Hijos"),
                Document("DPI_SOLICITANTE", "Copia del DPI del solicitante", 3, DocumentNature.Copy, subject: "Solicitante"),
                Data("NOMBRE_DEMANDADO", "Nombre completo de la persona demandada", 4, "Contraparte"),
                Data("DIRECCION_DEMANDADO", "Dirección donde vive o trabaja la persona demandada", 5, "Contraparte")
            ]),
            new("AUMENTO_DISMINUCION_PENSION", "Juicio oral de aumento o disminución de pensión alimenticia", "Catálogo parcial confirmado por el cliente.",
            [
                Document("MATRIMONIO", "Certificación original y reciente de matrimonio", 1, age: 183),
                Document("NACIMIENTO_HIJOS", "Certificación de nacimiento de hijos menores", 2, age: 183),
                Data("DPI_DEMANDADO", "Número de DPI de la persona demandada", 3, "Contraparte"),
                Document("DPI_SOLICITANTE", "Copia del DPI del solicitante", 4, DocumentNature.Copy),
                Data("NOMBRE_DIRECCION_DEMANDADO", "Nombre y dirección donde vive o trabaja la persona demandada", 5, "Contraparte"),
                Document("SENTENCIA_CONVENIO", "Certificación original de sentencia o convenio que fijó la pensión", 6)
            ]),
            new("DIVORCIO_CAUSAL", "Juicio oral de divorcio por causal determinada", "Catálogo parcial confirmado por el cliente.",
            [
                Document("MATRIMONIO", "Certificación original y reciente de matrimonio", 1, age: 183),
                Document("NACIMIENTO_HIJOS", "Certificación de hijos en común", 2),
                Document("DPI_SOLICITANTE", "Copia del DPI del solicitante", 3, DocumentNature.Copy),
                Data("DPI_DEMANDADO", "Número de DPI de la persona demandada", 4, "Contraparte"),
                Data("NOMBRE_DIRECCION_DEMANDADO", "Nombre y dirección donde vive o trabaja la persona demandada", 5, "Contraparte"),
                Document("CARENCIA_BIENES", "Carencia de bienes original y reciente", 6),
                Document("NACIMIENTO_CONYUGES", "Certificación de nacimiento de ambos cónyuges", 7),
                Document("CONSTANCIA_INGRESOS", "Constancia de ingresos", 8, conditional: true, condition: "Aplicabilidad pendiente de confirmación institucional"),
                Data("FECHA_SEPARACION", "Fecha aproximada de separación", 9)
            ]),
            new("PATERNIDAD_FILIACION", "Juicio oral de paternidad y filiación", "Catálogo parcial confirmado por el cliente.",
            [
                Document("MATRIMONIO", "Certificación original y reciente de matrimonio", 1, age: 183),
                Document("NACIMIENTO_HIJOS", "Certificación de nacimiento de hijos cuyo reconocimiento se pretende", 2, age: 183),
                Document("DPI_SOLICITANTE", "Copia del DPI del solicitante", 3, DocumentNature.Copy),
                Data("NOMBRE_DIRECCION_DEMANDADO", "Nombre y dirección donde vive o trabaja la persona demandada", 4, "Contraparte"),
                Condition("CAPACIDAD_ADN", "Capacidad económica para pagar prueba de ADN en INACIF", 5, "Condición a confirmar en el momento procesal oportuno")
            ]),
            new("GUARDA_CUSTODIA", "Juicio oral de guarda y custodia", "Catálogo parcial confirmado por el cliente.",
            [
                Document("MATRIMONIO", "Certificación original y reciente de matrimonio", 1, age: 183),
                Document("NACIMIENTO_HIJOS", "Certificación de nacimiento de hijos menores", 2, age: 183),
                Document("DPI_SOLICITANTE", "Copia del DPI del solicitante", 3, DocumentNature.Copy),
                Data("DPI_DEMANDADO", "Número de DPI de la persona demandada", 4, "Contraparte"),
                Data("NOMBRE_DIRECCION_DEMANDADO", "Nombre y dirección donde vive o trabaja la persona demandada", 5, "Contraparte")
            ]),
            new("COBRO_PENSIONES", "Juicio ejecutivo de cobro de pensiones alimenticias atrasadas", "Catálogo parcial confirmado por el cliente.",
            [
                Document("MATRIMONIO", "Certificación original y reciente de matrimonio", 1, age: 183),
                Document("NACIMIENTO_HIJOS", "Certificación de nacimiento de hijos menores", 2, age: 183),
                Document("DPI_SOLICITANTE", "Copia del DPI del solicitante", 3, DocumentNature.Copy),
                Data("DPI_DEMANDADO", "Número de DPI de la persona demandada", 4, "Contraparte"),
                Data("NOMBRE_DIRECCION_DEMANDADO", "Nombre y dirección donde vive o trabaja la persona demandada", 5, "Contraparte"),
                Document("SENTENCIA_CONVENIO", "Certificación original de sentencia o convenio que fijó la pensión", 6),
                Document("ESTADO_CUENTA", "Estado de cuenta del período reclamado", 7)
            ]),
            new("CAMBIO_NOMBRE", "Cambio de nombre en vía judicial", "Tipo confirmado; requisitos pendientes de entrega.", [])
        ];
    }

    private static IReadOnlyList<RequirementSeed> StudentRequirementSeeds() =>
    [
        new("SOLICITUD", "Solicitud o memorial dirigido a la Dirección", RequirementKind.Document, true, false, null, DocumentNature.Original, null, "Alumno", null, 1),
        new("DPI", "Copia del DPI", RequirementKind.Document, true, false, null, DocumentNature.Copy, null, "Alumno", null, 2),
        new("CV", "Curriculum Vitae", RequirementKind.Document, true, false, null, DocumentNature.Original, null, "Alumno", null, 3),
        new("FOTOGRAFIAS", "Tres fotografías recientes tamaño cédula a color", RequirementKind.Document, true, false, null, DocumentNature.Original, null, "Alumno", null, 4),
        new("CERTIFICACION_CURSOS", "Certificación original de Derecho Procesal Civil y Mercantil I y II", RequirementKind.Document, true, false, null, DocumentNature.Original, null, "Alumno", null, 5),
        new("BOLETA_INSCRIPCION", "Boleta o constancia de inscripción aplicable", RequirementKind.Document, true, false, null, DocumentNature.Copy, null, "Alumno", null, 6),
        new("PAGO_BUFETE", "Constancia de pago de inscripción al Bufete Popular", RequirementKind.Document, true, false, null, DocumentNature.Copy, null, "Alumno", null, 7),
        new("PAGO_ANUAL_UMG", "Constancia o fotocopia del pago anual a la UMG", RequirementKind.Document, true, false, null, DocumentNature.Copy, null, "Alumno", null, 8),
        new("INSCRIPCION_PENSUM", "Inscripción anual para alumno con pensum cerrado", RequirementKind.Document, false, true, "Aplica únicamente si cerró pensum", DocumentNature.Copy, null, "Alumno", null, 9)
    ];

    private sealed record ProcessSeed(string Code, string Name, string Description, IReadOnlyList<RequirementSeed> Requirements);

    private sealed record RequirementSeed(
        string Code,
        string Label,
        RequirementKind Kind,
        bool Required,
        bool Conditional,
        string? Condition,
        DocumentNature Nature,
        int? MaximumAgeDays,
        string? Subject,
        string? Instructions,
        int Order);
}
