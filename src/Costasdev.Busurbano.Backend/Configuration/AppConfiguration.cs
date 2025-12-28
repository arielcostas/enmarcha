namespace Costasdev.Busurbano.Backend.Configuration;

public class AppConfiguration
{
    public required string VitrasaScheduleBasePath { get; set; }
    public required string RenfeScheduleBasePath { get; set; }

    [Obsolete]
    public required string OtpGeocodingBaseUrl { get; set; } = "https://planificador-rutas-api.vigo.org/v1";
    [Obsolete]
    public required string OtpPlannerBaseUrl { get; set; } = "https://planificador-rutas.vigo.org/otp/routers/default";
    public required string OpenTripPlannerBaseUrl { get; set; }
    public string NominatimBaseUrl { get; set; } = "https://nominatim.openstreetmap.org";

    // Default Routing Parameters
    public double WalkSpeed { get; set; } = 1.4;
    public int MaxWalkDistance { get; set; } = 1000;
    public int MaxWalkTime { get; set; } = 20;
    public int NumItineraries { get; set; } = 4;

    // Comfort/Slack Parameters
    public int TransferSlackSeconds { get; set; } = 120; // Extra buffer for transfers
    public int MinTransferTimeSeconds { get; set; } = 120; // Minimum transfer time
    public double WalkReluctance { get; set; } = 2.0; // Slightly penalize walking to add slack
}
