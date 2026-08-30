using System.Text.Json.Serialization;
using Enmarcha.Backend.Types;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Sources.OpenTripPlannerGql.Queries.V2;

namespace Enmarcha.Backend.Dto;

public class StopEstimatesResponse
{
    [JsonPropertyName("estimates")] public required List<StopEstimate> Estimates { get; set; }
    [JsonPropertyName("sources")] public List<DataSource> DataSources { get; set; } = [];
}

public class DataSource
{
    public required string DatasetName { get; set; }
    public required string SourceName { get; set; }
    public required string Url { get; set; }
}

public class StopEstimate
{
    [JsonPropertyName("tripId")] public required string TripId { get; set; }

    [JsonPropertyName("route")] public required RouteInfo Route { get; set; }
    [JsonPropertyName("headsign")] public required HeadsignInfo Headsign { get; set; }

    [JsonPropertyName("estimate")] public required EstimateDetails Estimate { get; set; }
    [JsonPropertyName("circulation")] public EstimateCirculation? Circulation { get; set; }

    [JsonPropertyName("shape")] public object? Shape { get; set; }
    [JsonPropertyName("currentPosition")] public Position? CurrentPosition { get; set; }

    [JsonPropertyName("vehicleInformation")]
    public VehicleInformation? VehicleInformation { get; set; }

    [JsonIgnore] public string? AgencyId { get; set; }
    [JsonPropertyName("operator")] public string? Operator { get; set; }
    [JsonPropertyName("operation")] public VehicleOperation Operation { get; set; } = VehicleOperation.PickupDropoff;

    [JsonPropertyName("patternId")] public string? PatternId { get; set; }

    [JsonIgnore] public List<string> NextStops { get; set; } = [];
    [JsonIgnore] public List<string> OriginStops { get; set; } = [];
    [JsonIgnore] public StopArrivalsResponse.Arrival? RawOtpArrival { get; set; }
    [JsonIgnore] public bool Delete { get; set; }
    [JsonIgnore] public bool RealTimeOnly { get; set; } = false;
}

public enum VehicleOperation
{
    [JsonStringEnumMemberName("PICKUP_DROPOFF")]
    PickupDropoff = 0,

    [JsonStringEnumMemberName("PICKUP_ONLY")]
    PickupOnly = 1,

    [JsonStringEnumMemberName("DROPOFF_ONLY")]
    DropoffOnly = 2,

    [JsonStringEnumMemberName("DEPARTURE")]
    Departure = 3,
    [JsonStringEnumMemberName("ARRIVAL")] Arrival = 4,

    [JsonStringEnumMemberName("CIRCULAR_TERMINUS")]
    CircularTerminus = 5
}

public enum SeatInformation
{
    Empty,
    ManySeatsAvailable,
    FewSeatsAvailable,
}

public class RouteInfo
{
    [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }
    [JsonPropertyName("shortName")] public required string ShortName { get; set; }
    [JsonPropertyName("colour")] public required string Colour { get; set; }
    [JsonPropertyName("textColour")] public required string TextColour { get; set; }

    public string RouteIdInGtfs => GtfsId.Split(':', 2)[1];

    public required string OriginalShortName { get; init; }
}

public class HeadsignInfo
{
    [JsonPropertyName("origin")] public string? Origin { get; set; }
    [JsonPropertyName("destination")] public required string Destination { get; set; }
    [JsonPropertyName("zonesBefore")] public string? ZonesBefore { get; set; }
    [JsonPropertyName("zonesAfter")] public string? ZonesAfter { get; set; }
}

public class EstimateDetails
{
    [JsonPropertyName("minutes")] public required int Minutes { get; set; }
    [JsonPropertyName("confidence")] public ArrivalConfidence Confidence { get; set; } = ArrivalConfidence.Schedule;
    [JsonPropertyName("delay")] public int DelayMinutes { get; set; }

    [JsonPropertyName("relationship")]
    public ArrivalRelationship Relationship { get; set; } = ArrivalRelationship.Scheduled;
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ArrivalConfidence
{
    [JsonStringEnumMemberName("REALTIME_CIRCULATING")]
    RealtimeCirculating = 0,

    [JsonStringEnumMemberName("REALTIME_BEFORE_DEPARTURE")]
    RealtimeBeforeDeparture = 1,
    [JsonStringEnumMemberName("SCHEDULE")] Schedule = 2
}

/**
 * A subset of GTFS-RT ScheduleRelationship, to account both for realtime-only trips and for cancelled trips.
 *
 * https://gtfs.org/documentation/realtime/reference/#enum-schedulerelationship_1
 */
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ArrivalRelationship
{
    [JsonStringEnumMemberName("scheduled")]
    Scheduled = 0,
    [JsonStringEnumMemberName("canceled")] Canceled = 1,
    [JsonStringEnumMemberName("new")] New = 2
}

// TODO: Make these optional without frontend going nuts
public class EstimateCirculation
{
    [JsonPropertyName("shiftName")] public string? ShiftName { get; set; }
    [JsonPropertyName("shiftTrip")] public string? ShiftTrip { get; set; }
    [JsonPropertyName("departureTime")] public string? DepartureTime { get; set; }
    [JsonPropertyName("tripName")] public string? TripName { get; set; }
    [JsonPropertyName("way")] public CirculationDirection Way { get; set; }
}

public enum CirculationDirection
{
    [JsonStringEnumMemberName("OUTBOUND")] Outbound,
    [JsonStringEnumMemberName("INBOUND")] Inbound
}

public class VehicleInformation
{
    [JsonPropertyName("plate")] public string? NumberPlate { get; set; }
    [JsonPropertyName("number")] public string? CompanyNumber { get; set; }

    [JsonPropertyName("make")] public string? Make { get; set; }
    [JsonPropertyName("model")] public string? Model { get; set; }
    [JsonPropertyName("year")] public string? Year { get; set; }
}
