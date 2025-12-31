using System.Text.Json.Serialization;
using Enmarcha.Backend.Types;
using Newtonsoft.Json;

namespace Enmarcha.Backend.Types.Arrivals;

public class Arrival
{
    [JsonPropertyName("tripId")] public required string TripId { get; set; }

    [JsonPropertyName("route")] public required RouteInfo Route { get; set; }

    [JsonPropertyName("headsign")] public required HeadsignInfo Headsign { get; set; }

    [JsonPropertyName("estimate")] public required ArrivalDetails Estimate { get; set; }

    [JsonPropertyName("delay")] public DelayBadge? Delay { get; set; }

    [JsonPropertyName("shift")] public ShiftBadge? Shift { get; set; }

    [JsonPropertyName("shape")] public object? Shape { get; set; }

    [JsonPropertyName("currentPosition")] public Position? CurrentPosition { get; set; }

    [JsonPropertyName("stopShapeIndex")] public int? StopShapeIndex { get; set; }

    [JsonPropertyName("vehicleInformation")]
    public VehicleBadge? VehicleInformation { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public List<string> NextStops { get; set; } = [];

    [System.Text.Json.Serialization.JsonIgnore]
    public object? RawOtpTrip { get; set; }
}

public class RouteInfo
{
    [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }

    public string RouteIdInGtfs => GtfsId.Split(':', 2)[1];

    [JsonPropertyName("shortName")] public required string ShortName { get; set; }

    [JsonPropertyName("colour")] public required string Colour { get; set; }

    [JsonPropertyName("textColour")] public required string TextColour { get; set; }
}

public class HeadsignInfo
{
    [JsonPropertyName("badge")] public string? Badge { get; set; }

    [JsonPropertyName("destination")] public required string Destination { get; set; }

    [JsonPropertyName("marquee")] public string? Marquee { get; set; }
}

public class ArrivalDetails
{
    [JsonPropertyName("minutes")] public required int Minutes { get; set; }

    [JsonPropertyName("precision")] public ArrivalPrecision Precision { get; set; } = ArrivalPrecision.Scheduled;
}

[System.Text.Json.Serialization.JsonConverter(typeof(JsonStringEnumConverter))]
public enum ArrivalPrecision
{
    [JsonStringEnumMemberName("confident")]
    Confident = 0,
    [JsonStringEnumMemberName("unsure")] Unsure = 1,

    [JsonStringEnumMemberName("scheduled")]
    Scheduled = 2,
    [JsonStringEnumMemberName("past")] Past = 3
}

public class DelayBadge
{
    [JsonPropertyName("minutes")] public int Minutes { get; set; }
}

public class ShiftBadge
{
    [JsonPropertyName("shiftName")] public required string ShiftName { get; set; }

    [JsonPropertyName("shiftTrip")] public required string ShiftTrip { get; set; }
}

public class VehicleBadge
{
    [JsonPropertyName("identifier")] public required string Identifier { get; set; }

    [JsonPropertyName("make")] public string? Make { get; set; }
    [JsonPropertyName("model")] public string? Model { get; set; }
    [JsonPropertyName("kind")] public string? Kind { get; set; }
    [JsonPropertyName("year")] public string? Year { get; set; }


}
