namespace BufeteJuridico.Api.Infrastructure.Configuration;

internal static class DevelopmentEnvironmentLoader
{
    private const int MaximumParentLevels = 8;

    public static void LoadIfAvailable()
    {
        var environmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        if (!string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase))
            return;

        var environmentPath = FindEnvironmentFile(Directory.GetCurrentDirectory())
            ?? FindEnvironmentFile(AppContext.BaseDirectory);
        if (environmentPath is null)
            return;

        foreach (var entry in Parse(File.ReadLines(environmentPath)))
        {
            if (Environment.GetEnvironmentVariable(entry.Key) is null)
                Environment.SetEnvironmentVariable(entry.Key, entry.Value, EnvironmentVariableTarget.Process);
        }
    }

    internal static IReadOnlyDictionary<string, string> Parse(IEnumerable<string> lines)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var source in lines)
        {
            var line = source.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
                continue;

            var separator = line.IndexOf('=');
            if (separator <= 0)
                throw new InvalidOperationException("El archivo .env contiene una entrada sin el formato NOMBRE=VALOR.");

            var key = line[..separator].Trim();
            if (!IsValidEnvironmentVariableName(key))
                throw new InvalidOperationException($"El archivo .env contiene un nombre de variable inválido: {key}");

            values[key] = line[(separator + 1)..];
        }

        return values;
    }

    private static string? FindEnvironmentFile(string startPath)
    {
        var directory = new DirectoryInfo(Path.GetFullPath(startPath));
        for (var level = 0; directory is not null && level <= MaximumParentLevels; level++, directory = directory.Parent)
        {
            var solutionPath = Path.Combine(directory.FullName, "BufeteJuridico.slnx");
            var environmentPath = Path.Combine(directory.FullName, ".env");
            if (File.Exists(solutionPath) && File.Exists(environmentPath))
                return environmentPath;
        }

        return null;
    }

    private static bool IsValidEnvironmentVariableName(string value)
    {
        if (value.Length == 0 || !(char.IsLetter(value[0]) || value[0] == '_'))
            return false;
        return value.All(character => char.IsLetterOrDigit(character) || character == '_');
    }
}
