namespace BufeteJuridico.Application.Authorization;

public static class Permissions
{
    public const string UsersRead = "users.read";
    public const string UsersWrite = "users.write";
    public const string UsersDeactivate = "users.deactivate";
    public const string RolesManage = "roles.manage";
    public const string ClientsRead = "clients.read";
    public const string ClientsWrite = "clients.write";
    public const string StudentsRead = "students.read";
    public const string StudentsWrite = "students.write";
    public const string StudentSelfRead = "students.self.read";
    public const string CatalogsRead = "catalogs.read";
    public const string CatalogsManage = "catalogs.manage";
    public const string CasesRead = "cases.read";
    public const string CasesWrite = "cases.write";
    public const string CasesAssignedRead = "cases.assigned.read";
    public const string CasesAssign = "cases.assign";
    public const string CaseTimelineWrite = "cases.timeline.write";
    public const string AssignedMemorialWrite = "cases.assigned.memorial.write";
    public const string DocumentsRead = "documents.read";
    public const string DocumentsWrite = "documents.write";
    public const string ScannerUse = "scanner.use";
    public const string ActivitiesRead = "activities.read";
    public const string ActivitiesWrite = "activities.write";
    public const string ReportsGenerate = "reports.generate";
    public const string ReportsSend = "reports.send";
    public const string AuditRead = "audit.read";
    public const string RetentionPreview = "retention.preview";
    public const string RecordsDelete = "records.delete";
    public const string DeletedRecordsRead = "records.deleted.read";
    public const string RecordsRestore = "records.restore";

    public static IReadOnlyList<PermissionDefinition> All { get; } =
    [
        new(UsersRead, "Usuarios", "Consultar usuarios internos"),
        new(UsersWrite, "Usuarios", "Crear y modificar usuarios internos"),
        new(UsersDeactivate, "Usuarios", "Dar de baja lógica usuarios internos"),
        new(RolesManage, "Usuarios", "Administrar roles y permisos"),
        new(ClientsRead, "Clientes", "Consultar clientes"),
        new(ClientsWrite, "Clientes", "Crear y modificar clientes y declaraciones"),
        new(StudentsRead, "Alumnos", "Consultar alumnos"),
        new(StudentsWrite, "Alumnos", "Crear y tramitar alumnos"),
        new(StudentSelfRead, "Alumnos", "Consultar el perfil propio"),
        new(CatalogsRead, "Catálogos", "Consultar tipos y requisitos"),
        new(CatalogsManage, "Catálogos", "Administrar tipos y requisitos"),
        new(CasesRead, "Expedientes", "Consultar expedientes"),
        new(CasesWrite, "Expedientes", "Crear y modificar expedientes"),
        new(CasesAssignedRead, "Expedientes", "Consultar expedientes asignados"),
        new(CasesAssign, "Expedientes", "Asignar alumnos a expedientes"),
        new(CaseTimelineWrite, "Seguimiento", "Registrar actuaciones y revisiones"),
        new(AssignedMemorialWrite, "Seguimiento", "Cargar memoriales en casos asignados"),
        new(DocumentsRead, "Documentos", "Consultar y descargar documentos"),
        new(DocumentsWrite, "Documentos", "Cargar y versionar documentos"),
        new(ScannerUse, "Documentos", "Operar sesiones de escaneo directo"),
        new(ActivitiesRead, "Actividades", "Consultar actividades de secretaría"),
        new(ActivitiesWrite, "Actividades", "Registrar actividades de secretaría"),
        new(ReportsGenerate, "Reportes", "Generar y revisar reportes"),
        new(ReportsSend, "Reportes", "Enviar reportes por correo"),
        new(AuditRead, "Auditoría", "Consultar trazabilidad global"),
        new(RetentionPreview, "Retención", "Consultar candidatos y vista previa"),
        new(RecordsDelete, "Administración", "Enviar clientes, alumnos y expedientes a eliminados"),
        new(DeletedRecordsRead, "Administración", "Consultar registros eliminados"),
        new(RecordsRestore, "Administración", "Restaurar registros eliminados")
    ];
}

public sealed record PermissionDefinition(string Code, string Module, string Description);
