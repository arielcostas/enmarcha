namespace Enmarcha.Backend.Configuration;

public class AppConfiguration
{
    public required string OpenTripPlannerBaseUrl { get; set; }
    public required string GeoapifyApiKey { get; set; }
    public string NominatimBaseUrl { get; set; } = "https://nominatim.openstreetmap.org";
}
