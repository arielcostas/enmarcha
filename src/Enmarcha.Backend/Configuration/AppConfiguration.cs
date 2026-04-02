namespace Enmarcha.Backend.Configuration;

public class AppConfiguration
{
    public required string OpenTripPlannerBaseUrl { get; set; }
    public required string GeoapifyApiKey { get; set; }
    public string NominatimBaseUrl { get; set; } = "https://nominatim.openstreetmap.org";
    public string[] OtpFeeds { get; set; } = [];
    public OpenTelemetryConfiguration? OpenTelemetry { get; set; }
    public VapidConfiguration? Vapid { get; set; }
}

public class OpenTelemetryConfiguration
{
    public string? Endpoint { get; set; }
    public string? Headers { get; set; }
}

public class VapidConfiguration
{
    /// <summary>
    /// VAPID subject — typically "mailto:admin@yourdomain.com" or a URL.
    /// </summary>
    public required string Subject { get; set; }

    /// <summary>
    /// Base64url-encoded VAPID public key. Safe to expose to browsers.
    /// </summary>
    public required string PublicKey { get; set; }

    /// <summary>
    /// Base64url-encoded VAPID private key. Store in user secrets or environment variables only.
    /// Generate a key pair with: VapidHelper.GenerateVapidKeys() from the WebPush NuGet package.
    /// </summary>
    public required string PrivateKey { get; set; }
}
