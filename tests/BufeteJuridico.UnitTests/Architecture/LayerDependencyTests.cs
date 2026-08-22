using System.Reflection;

namespace BufeteJuridico.UnitTests.Architecture;

public sealed class LayerDependencyTests
{
    [Fact]
    public void Domain_must_not_reference_outer_layers()
    {
        AssertDoesNotReference(
            BufeteJuridico.Domain.AssemblyReference.Assembly,
            "BufeteJuridico.Application",
            "BufeteJuridico.Infrastructure",
            "BufeteJuridico.Api");
    }

    [Fact]
    public void Application_must_not_reference_infrastructure_or_api()
    {
        AssertDoesNotReference(
            BufeteJuridico.Application.AssemblyReference.Assembly,
            "BufeteJuridico.Infrastructure",
            "BufeteJuridico.Api");
    }

    private static void AssertDoesNotReference(Assembly assembly, params string[] forbiddenNames)
    {
        var references = assembly
            .GetReferencedAssemblies()
            .Select(reference => reference.Name)
            .Where(name => name is not null)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var forbiddenName in forbiddenNames)
        {
            Assert.DoesNotContain(forbiddenName, references);
        }
    }
}
