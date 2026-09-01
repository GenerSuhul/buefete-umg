using BufeteJuridico.Api.Infrastructure.Configuration;

namespace BufeteJuridico.IntegrationTests;

public sealed class DevelopmentEnvironmentLoaderTests
{
    [Fact]
    public void Parse_supports_comments_blank_lines_and_values_containing_equals()
    {
        var values = DevelopmentEnvironmentLoader.Parse([
            "# comentario",
            "",
            "Jwt__Issuer=BufeteJuridicoUMG",
            "Jwt__SigningKey=abc=def=="
        ]);

        Assert.Equal("BufeteJuridicoUMG", values["Jwt__Issuer"]);
        Assert.Equal("abc=def==", values["Jwt__SigningKey"]);
    }

    [Theory]
    [InlineData("SIN_SEPARADOR")]
    [InlineData("1INVALIDA=valor")]
    [InlineData("MALA-CLAVE=valor")]
    public void Parse_rejects_invalid_entries(string line)
    {
        Assert.Throws<InvalidOperationException>(() => DevelopmentEnvironmentLoader.Parse([line]));
    }
}
