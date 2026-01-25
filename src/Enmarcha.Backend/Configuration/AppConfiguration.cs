namespace Enmarcha.Backend.Configuration;

public class AppConfiguration
{
    public required string OpenTripPlannerBaseUrl { get; set; }
    public required string GeoapifyApiKey { get; set; }
    public string NominatimBaseUrl { get; set; } = "https://nominatim.openstreetmap.org";
    public OpenTelemetryConfiguration? OpenTelemetry { get; set; }
}

public class OpenTelemetryConfiguration
{
    public string? Endpoint { get; set; }
    public string? Headers { get; set; }
}
