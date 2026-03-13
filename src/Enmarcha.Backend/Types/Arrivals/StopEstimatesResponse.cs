using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Types.Arrivals;

public class StopEstimatesResponse
{
    [JsonPropertyName("arrivals")] public List<ArrivalEstimate> Arrivals { get; set; } = [];
}

public class ArrivalEstimate
{
    [JsonPropertyName("tripId")] public required string TripId { get; set; }

    [JsonPropertyName("patternId")] public string? PatternId { get; set; }

    [JsonPropertyName("estimate")] public required ArrivalDetails Estimate { get; set; }

    [JsonPropertyName("delay")] public DelayBadge? Delay { get; set; }
}
