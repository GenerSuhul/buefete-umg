using NAPS2.Images;
using NAPS2.Images.Gdi;
using NAPS2.Pdf;
using NAPS2.Scan;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:17654");
builder.Services.AddSingleton<ScannerCoordinator>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .SetIsOriginAllowed(origin =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
        (uri.IsLoopback || AllowedOrigins().Contains(origin, StringComparer.OrdinalIgnoreCase)))
    .AllowAnyHeader()
    .AllowAnyMethod()
    .WithExposedHeaders("X-Scan-Filename", "X-Scan-Device", "X-Scan-Page-Count", "X-Scan-Provider")));

var app = builder.Build();
app.UseCors();

app.MapGet("/health", () => Results.Ok(new
{
    ready = OperatingSystem.IsWindows(),
    provider = "NAPS2",
    version = "2.0.0",
    license = "LGPL-2.1-or-later",
    drivers = new[] { "WIA", "TWAIN", "ESCL" }
}));

app.MapGet("/devices", async (ScannerCoordinator scanner, CancellationToken cancellationToken) =>
{
    if (!OperatingSystem.IsWindows())
        return Results.Problem("El agente local de escaneo requiere Windows.", statusCode: 501);

    try
    {
        return Results.Ok(await scanner.ListDevicesAsync(cancellationToken));
    }
    catch (Exception exception)
    {
        return Results.Problem(exception.Message, statusCode: 503,
            extensions: new Dictionary<string, object?> { ["code"] = "DEVICE_DISCOVERY_FAILED" });
    }
});

app.MapPost("/scan", async (ScanRequest request, ScannerCoordinator scanner, HttpContext context, CancellationToken cancellationToken) =>
{
    if (!OperatingSystem.IsWindows())
        return Results.Problem("El agente local de escaneo requiere Windows.", statusCode: 501);

    try
    {
        var result = await scanner.AcquireAsync(request, cancellationToken);
        context.Response.Headers["X-Scan-Filename"] = result.FileName;
        context.Response.Headers["X-Scan-Device"] = result.DeviceName;
        context.Response.Headers["X-Scan-Page-Count"] = result.PageCount.ToString();
        context.Response.Headers["X-Scan-Provider"] = result.Provider;
        return Results.File(result.Content, "application/pdf", result.FileName,
            lastModified: DateTimeOffset.UtcNow, entityTag: null, enableRangeProcessing: false);
    }
    catch (OperationCanceledException)
    {
        return Results.Problem("La adquisición fue cancelada.", statusCode: 409,
            extensions: new Dictionary<string, object?> { ["code"] = "CANCELLED_BY_USER" });
    }
    catch (Exception exception)
    {
        return Results.Problem($"No se pudo adquirir el documento: {exception.Message}", statusCode: 503,
            extensions: new Dictionary<string, object?> { ["code"] = "ACQUISITION_FAILED" });
    }
});

app.Run();

static HashSet<string> AllowedOrigins() =>
    (Environment.GetEnvironmentVariable("SCANNER_ALLOWED_ORIGINS") ?? string.Empty)
    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

internal sealed class ScannerCoordinator
{
    private static readonly Driver[] SupportedDrivers = [Driver.Wia, Driver.Twain, Driver.Escl];
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<IReadOnlyList<ScannerDeviceResponse>> ListDevicesAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var result = new List<ScannerDeviceResponse>();
            foreach (var driver in SupportedDrivers)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    using var scanningContext = CreateContext(driver);
                    var controller = new ScanController(scanningContext);
                    var devices = await controller.GetDeviceList(driver);
                    result.AddRange(devices.Select(device => new ScannerDeviceResponse(
                        EncodeDeviceId(driver, device.ID), device.Name, DriverName(driver), device.ID)));
                }
                catch
                {
                    // Un controlador ausente no debe ocultar los dispositivos encontrados por los demás.
                }
            }

            return result
                .DistinctBy(device => $"{device.Driver}:{device.NativeId}", StringComparer.OrdinalIgnoreCase)
                .OrderBy(device => device.Name, StringComparer.CurrentCultureIgnoreCase)
                .ToArray();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<ScanResult> AcquireAsync(ScanRequest request, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        var outputDirectory = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "bufete-scanner-agent"));
        var outputPath = Path.GetFullPath(Path.Combine(outputDirectory, $"{Guid.NewGuid():N}.pdf"));
        if (!outputPath.StartsWith(outputDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("La ruta temporal de digitalización no es válida.");

        try
        {
            var (driver, nativeId) = DecodeDeviceId(request.DeviceId);
            if (!SupportedDrivers.Contains(driver)) throw new InvalidOperationException("El controlador solicitado no está permitido.");

            using var scanningContext = CreateContext(driver);
            var controller = new ScanController(scanningContext);
            var device = (await controller.GetDeviceList(driver))
                .FirstOrDefault(candidate => string.Equals(candidate.ID, nativeId, StringComparison.Ordinal))
                ?? throw new InvalidOperationException("El escáner seleccionado ya no está disponible.");

            var options = new ScanOptions
            {
                Device = device,
                Driver = driver,
                Dpi = Math.Clamp(request.ResolutionDpi, 75, 1200),
                BitDepth = ParseBitDepth(request.ColorMode),
                PaperSource = request.Duplex ? PaperSource.Duplex : request.UseFeeder ? PaperSource.Feeder : PaperSource.Flatbed,
                Quality = 90,
                MaxQuality = false,
                UseNativeUI = false
            };

            var images = new List<ProcessedImage>();
            await foreach (var image in controller.Scan(options, cancellationToken)) images.Add(image);
            if (images.Count == 0) throw new InvalidOperationException("El escáner no devolvió ninguna página.");

            Directory.CreateDirectory(outputDirectory);
            var exporter = new PdfExporter(scanningContext);
            await exporter.Export(outputPath, images);
            var content = await File.ReadAllBytesAsync(outputPath, cancellationToken);
            return new ScanResult(content, $"escaneo-{DateTime.Now:yyyyMMdd-HHmmss}.pdf", device.Name, images.Count, $"NAPS2-{DriverName(driver)}");
        }
        finally
        {
            if (File.Exists(outputPath)) File.Delete(outputPath);
            _gate.Release();
        }
    }

    private static ScanningContext CreateContext(Driver driver)
    {
        var context = new ScanningContext(new GdiImageContext());
        if (driver == Driver.Twain) context.SetUpWin32Worker();
        return context;
    }

    private static BitDepth ParseBitDepth(string? value) => value?.ToLowerInvariant() switch
    {
        "grayscale" => BitDepth.Grayscale,
        "blackandwhite" => BitDepth.BlackAndWhite,
        _ => BitDepth.Color
    };

    private static string DriverName(Driver driver) => driver switch
    {
        Driver.Wia => "WIA",
        Driver.Twain => "TWAIN",
        Driver.Escl => "ESCL",
        _ => driver.ToString().ToUpperInvariant()
    };

    private static string EncodeDeviceId(Driver driver, string nativeId) =>
        $"{DriverName(driver)}:{Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(nativeId))}";

    private static (Driver Driver, string NativeId) DecodeDeviceId(string encoded)
    {
        var separator = encoded.IndexOf(':');
        if (separator <= 0 || separator == encoded.Length - 1) throw new InvalidOperationException("El identificador del escáner no es válido.");
        if (!Enum.TryParse<Driver>(encoded[..separator], true, out var driver)) throw new InvalidOperationException("El controlador del escáner no es válido.");
        try
        {
            return (driver, System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(encoded[(separator + 1)..])));
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("El identificador del escáner está dañado.");
        }
    }
}

internal sealed record ScanRequest(
    string DeviceId,
    int ResolutionDpi = 300,
    string ColorMode = "Color",
    bool Duplex = false,
    bool UseFeeder = true);

internal sealed record ScannerDeviceResponse(string Id, string Name, string Driver, string NativeId);
internal sealed record ScanResult(byte[] Content, string FileName, string DeviceName, int PageCount, string Provider);
