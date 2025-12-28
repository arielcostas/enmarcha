using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Types.Otp;

public class OtpResponse
{
    [JsonPropertyName("plan")]
    public OtpPlan? Plan { get; set; }

    [JsonPropertyName("error")]
    public OtpError? Error { get; set; }
}

public class OtpError
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("msg")]
    public string? Msg { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

public class OtpPlan
{
    [JsonPropertyName("date")]
    public long Date { get; set; }

    [JsonPropertyName("from")]
    public OtpPlace? From { get; set; }

    [JsonPropertyName("to")]
    public OtpPlace? To { get; set; }

    [JsonPropertyName("itineraries")]
    public List<OtpItinerary> Itineraries { get; set; } = new();
}

public class OtpItinerary
{
    [JsonPropertyName("duration")]
    public long Duration { get; set; }

    [JsonPropertyName("startTime")]
    public long StartTime { get; set; }

    [JsonPropertyName("endTime")]
    public long EndTime { get; set; }

    [JsonPropertyName("walkTime")]
    public long WalkTime { get; set; }

    [JsonPropertyName("transitTime")]
    public long TransitTime { get; set; }

    [JsonPropertyName("waitingTime")]
    public long WaitingTime { get; set; }

    [JsonPropertyName("walkDistance")]
    public double WalkDistance { get; set; }

    [JsonPropertyName("legs")]
    public List<OtpLeg> Legs { get; set; } = new();
}

public class OtpLeg
{
    [JsonPropertyName("startTime")]
    public long StartTime { get; set; }

    [JsonPropertyName("endTime")]
    public long EndTime { get; set; }

    [JsonPropertyName("mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("route")]
    public string? Route { get; set; }

    [JsonPropertyName("routeShortName")]
    public string? RouteShortName { get; set; }

    [JsonPropertyName("routeLongName")]
    public string? RouteLongName { get; set; }

    [JsonPropertyName("agencyName")]
    public string? AgencyName { get; set; }

    [JsonPropertyName("from")]
    public OtpPlace? From { get; set; }

    [JsonPropertyName("to")]
    public OtpPlace? To { get; set; }

    [JsonPropertyName("legGeometry")]
    public OtpGeometry? LegGeometry { get; set; }

    [JsonPropertyName("steps")]
    public List<OtpWalkStep> Steps { get; set; } = [];

    [JsonPropertyName("headsign")]
    public string? Headsign { get; set; }

    [JsonPropertyName("distance")]
    public double Distance { get; set; }

    [JsonPropertyName("routeColor")]
    public string? RouteColor { get; set; }

    [JsonPropertyName("routeTextColor")]
    public string? RouteTextColor { get; set; }

    [JsonPropertyName("intermediateStops")]
    public List<OtpPlace> IntermediateStops { get; set; } = [];
}

public class OtpPlace
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("lat")]
    public double Lat { get; set; }

    [JsonPropertyName("lon")]
    public double Lon { get; set; }

    [JsonPropertyName("stopId")]
    public string? StopId { get; set; }

    [JsonPropertyName("stopCode")]
    public string? StopCode { get; set; }
}

public class OtpGeometry
{
    [JsonPropertyName("points")]
    public string? Points { get; set; }

    [JsonPropertyName("length")]
    public int Length { get; set; }
}

public class OtpWalkStep
{
    [JsonPropertyName("distance")]
    public double Distance { get; set; }

    [JsonPropertyName("relativeDirection")]
    public string? RelativeDirection { get; set; }

    [JsonPropertyName("streetName")]
    public string? StreetName { get; set; }

    [JsonPropertyName("absoluteDirection")]
    public string? AbsoluteDirection { get; set; }

    [JsonPropertyName("lat")]
    public double Lat { get; set; }

    [JsonPropertyName("lon")]
    public double Lon { get; set; }
}
