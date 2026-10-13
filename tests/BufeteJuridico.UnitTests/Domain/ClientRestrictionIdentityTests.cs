using BufeteJuridico.Domain.Clients;

namespace BufeteJuridico.UnitTests.Domain;

public sealed class ClientRestrictionIdentityTests
{
    [Theory]
    [InlineData("1234567890123")]
    [InlineData("1234 56789 0123")]
    [InlineData("1234-56789-0123")]
    public void Separators_do_not_change_identity(string input) => Assert.Equal("1234567890123", ClientRestrictionIdentity.Normalize(input));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1234")]
    [InlineData("12345678901234")]
    [InlineData("1234567890123x")]
    [InlineData("１２３４５６７８９０１２３")]
    public void Invalid_or_ambiguous_identities_are_rejected(string? input) => Assert.Throws<ArgumentException>(() => ClientRestrictionIdentity.Normalize(input));
}
