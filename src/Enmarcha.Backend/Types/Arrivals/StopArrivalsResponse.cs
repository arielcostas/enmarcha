using System.Text.Json.Serialization;
using Enmarcha.Backend.Providers.StopUsage;

namespace Enmarcha.Backend.Types.Arrivals;

public class StopArrivalsResponse
{
    [JsonPropertyName("stopCode")]
    public required string StopCode { get; set; }

    [JsonPropertyName("stopName")]
    public required string StopName { get; set; }

    [JsonPropertyName("stopLocation")]
    public Position? StopLocation { get; set; }

    [JsonPropertyName("routes")]
    public List<RouteInfo> Routes { get; set; } = [];

    [JsonPropertyName("arrivals")]
    public List<Arrival> Arrivals { get; set; } = [];

    [JsonPropertyName("usage")]
    public List<BusStopUsagePoint>? Usage { get; set; }

    [JsonPropertyName("operator")]
    public required string OperatorName { get; set; }
}
