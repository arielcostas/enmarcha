using System.Text.Json.Serialization;
using Enmarcha.Backend.Types;

namespace Enmarcha.Backend.Types.Schedule;

public class StopScheduleResponse
{
    [JsonPropertyName("stopCode")]
    public required string StopCode { get; set; }

    [JsonPropertyName("stopName")]
    public required string StopName { get; set; }

    [JsonPropertyName("stopLocation")]
    public Position? StopLocation { get; set; }

    [JsonPropertyName("trips")]
    public List<ScheduledTripDto> Trips { get; set; } = [];
}

public class ScheduledTripDto
{
    /// <summary>Seconds from midnight of the service day.</summary>
    [JsonPropertyName("scheduledDeparture")]
    public int ScheduledDeparture { get; set; }

    [JsonPropertyName("routeId")]
    public required string RouteId { get; set; }

    [JsonPropertyName("routeShortName")]
    public string? RouteShortName { get; set; }

    [JsonPropertyName("routeColor")]
    public required string RouteColor { get; set; }

    [JsonPropertyName("routeTextColor")]
    public required string RouteTextColor { get; set; }

    [JsonPropertyName("headsign")]
    public string? Headsign { get; set; }

    [JsonPropertyName("originStop")]
    public string? OriginStop { get; set; }

    [JsonPropertyName("destinationStop")]
    public string? DestinationStop { get; set; }

    [JsonPropertyName("operator")]
    public string? Operator { get; set; }

    [JsonPropertyName("pickupType")]
    public string? PickupType { get; set; }

    [JsonPropertyName("dropOffType")]
    public string? DropOffType { get; set; }

    [JsonPropertyName("isFirstStop")]
    public bool IsFirstStop { get; set; }

    [JsonPropertyName("isLastStop")]
    public bool IsLastStop { get; set; }
}
