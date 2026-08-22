using BufeteJuridico.Application.Common;
using BufeteJuridico.Domain.Documents;

namespace BufeteJuridico.Infrastructure.Documents;

internal static class DocumentFileValidator
{
    private static readonly IReadOnlyDictionary<string, string[]> AllowedTypes =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"] = ["application/pdf"],
            [".jpg"] = ["image/jpeg"],
            [".jpeg"] = ["image/jpeg"],
            [".png"] = ["image/png"],
            [".webp"] = ["image/webp"]
        };

    public static string ValidateMetadata(string fileName, string contentType, long sizeBytes, long maximumSizeBytes)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            throw new ValidationException("El nombre del archivo es obligatorio.");
        if (sizeBytes <= 0 || sizeBytes > maximumSizeBytes)
            throw new ValidationException($"El archivo debe tener un tamaño entre 1 y {maximumSizeBytes} bytes.");

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AllowedTypes.TryGetValue(extension, out var contentTypes) ||
            !contentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
        {
            throw new ValidationException("Solo se admiten PDF, JPG, PNG y WEBP con tipo MIME válido.");
        }

        return extension;
    }

    public static async Task ValidateSignatureAsync(string extension, Stream content, CancellationToken cancellationToken)
    {
        if (!content.CanSeek)
            throw new ValidationException("No se pudo validar el contenido del archivo.");

        var header = new byte[12];
        var originalPosition = content.Position;
        var read = await content.ReadAsync(header, cancellationToken);
        content.Position = originalPosition;

        var valid = extension switch
        {
            ".pdf" => read >= 5 && header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46 && header[4] == 0x2D,
            ".jpg" or ".jpeg" => read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            ".png" => read >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            ".webp" => read >= 12 && header[..4].SequenceEqual("RIFF"u8.ToArray()) && header[8..12].SequenceEqual("WEBP"u8.ToArray()),
            _ => false
        };

        if (!valid) throw new ValidationException("El contenido real del archivo no coincide con su extensión.");
    }

    public static void ValidateContext(string extension, DocumentContextType contextType)
    {
        if (contextType == DocumentContextType.UserPhoto && extension == ".pdf")
            throw new ValidationException("La fotografía del usuario debe ser JPEG, PNG o WebP.");
    }
}
