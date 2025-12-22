using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Backend.Types.Arrivals;

public class Arrival
{
    [JsonPropertyName("route")]
    public required RouteInfo Route { get; set; }

    [JsonPropertyName("headsign")]
    public required HeadsignInfo Headsign { get; set; }

    [JsonPropertyName("estimate")]
    public required ArrivalDetails Estimate { get; set; }

    [JsonPropertyName("delay")]
    public DelayBadge? Delay { get; set; }

    [JsonPropertyName("shift")]
    public ShiftBadge? Shift { get; set; }
}

public class RouteInfo
{
    [JsonPropertyName("shortName")]
    public required string ShortName { get; set; }

    [JsonPropertyName("colour")]
    public required string Colour { get; set; }

    [JsonPropertyName("textColour")]
    public required string TextColour { get; set; }
}

public class HeadsignInfo
{
    [JsonPropertyName("badge")]
    public string? Badge { get; set; }

    [JsonPropertyName("destination")]
    public required string Destination { get; set; }

    [JsonPropertyName("marquee")]
    public string? Marquee { get; set; }
}

public class ArrivalDetails
{
    [JsonPropertyName("minutes")]
    public required int Minutes { get; set; }

    [JsonPropertyName("precission")]
    public ArrivalPrecission Precission { get; set; } = ArrivalPrecission.Scheduled;
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ArrivalPrecission
{
    [JsonStringEnumMemberName("confident")]
    Confident = 0,
    [JsonStringEnumMemberName("unsure")]
    Unsure = 1,
    [JsonStringEnumMemberName("scheduled")]
    Scheduled = 2,
    [JsonStringEnumMemberName("past")]
    Past = 3
}

public class DelayBadge
{
    [JsonPropertyName("minutes")]
    public int Minutes { get; set; }
}

public class ShiftBadge
{
    [JsonPropertyName("shiftName")]
    public string ShiftName { get; set; }

    [JsonPropertyName("shiftTrip")]
    public string ShiftTrip { get; set; }
}
