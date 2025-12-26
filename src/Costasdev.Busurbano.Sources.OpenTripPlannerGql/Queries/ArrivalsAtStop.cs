using System.Globalization;
using System.Text.Json.Serialization;
using Costasdev.Busurbano.Sources.OpenTripPlannerGql;

namespace Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;

public class ArrivalsAtStopContent : IGraphRequest<ArrivalsAtStopContent.Args>
{
    public record Args(string Id, bool Reduced);

    public static string Query(Args args)
    {
        var startTime = DateTimeOffset.UtcNow.AddMinutes(-75);
        var startTimeUnix = startTime.ToUnixTimeSeconds();
        var geometryField = args.Reduced ? "" : @"tripGeometry { points }";

        return string.Create(CultureInfo.InvariantCulture, $@"
        query Query {{
            stop(id:""{args.Id}"") {{
                code
                name
                lat
                lon
                routes {{
                    gtfsId
                    shortName
                    color
                    textColor
                }}
                arrivals: stoptimesWithoutPatterns(numberOfDepartures: 100, startTime: {startTimeUnix}, timeRange: 14400) {{
                    headsign
                    scheduledDeparture
                    serviceDay
                    pickupType

                    trip {{
                        gtfsId
                        serviceId
                        routeShortName
                        route {{
                            gtfsId
                            color
                            textColor
                            longName
                        }}
                        departureStoptime {{
                            scheduledDeparture
                        }}
                        {geometryField}
                        stoptimes {{
                            stop {{
                                name
                                lat
                                lon
                            }}
                            scheduledDeparture
                        }}
                    }}
                }}
            }}
        }}
        ");
    }
}

public class ArrivalsAtStopResponse : AbstractGraphResponse
{
    [JsonPropertyName("stop")] public required StopItem Stop { get; set; }

    public class StopItem
    {
        [JsonPropertyName("code")] public required string Code { get; set; }

        [JsonPropertyName("name")] public required string Name { get; set; }

        [JsonPropertyName("lat")] public double Lat { get; set; }

        [JsonPropertyName("lon")] public double Lon { get; set; }

        [JsonPropertyName("routes")] public List<RouteDetails> Routes { get; set; } = [];

        [JsonPropertyName("arrivals")] public List<Arrival> Arrivals { get; set; } = [];
    }

    public class Arrival
    {
        [JsonPropertyName("headsign")] public required string Headsign { get; set; }

        [JsonPropertyName("scheduledDeparture")]
        public int ScheduledDepartureSeconds { get; set; }

        [JsonPropertyName("serviceDay")]
        public long ServiceDay { get; set; }

        [JsonPropertyName("pickupType")] public required string PickupTypeOriginal { get; set; }

        public PickupType PickupTypeParsed => PickupType.Parse(PickupTypeOriginal);

        [JsonPropertyName("trip")] public required TripDetails Trip { get; set; }
    }

    public class TripDetails
    {
        [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }

        [JsonPropertyName("serviceId")] public required string ServiceId { get; set; }

        [JsonPropertyName("routeShortName")] public required string RouteShortName { get; set; }

        [JsonPropertyName("departureStoptime")]
        public required DepartureStoptime DepartureStoptime { get; set; }

        [JsonPropertyName("route")] public required RouteDetails Route { get; set; }

        [JsonPropertyName("tripGeometry")] public GeometryDetails? Geometry { get; set; }

        [JsonPropertyName("stoptimes")] public List<StoptimeDetails> Stoptimes { get; set; } = [];
    }

    public class GeometryDetails
    {
        [JsonPropertyName("points")] public string? Points { get; set; }
    }

    public class StoptimeDetails
    {
        [JsonPropertyName("stop")] public required StopDetails Stop { get; set; }
        [JsonPropertyName("scheduledDeparture")] public int ScheduledDeparture { get; set; }
    }

    public class StopDetails
    {
        [JsonPropertyName("name")] public required string Name { get; set; }
        [JsonPropertyName("lat")] public double Lat { get; set; }
        [JsonPropertyName("lon")] public double Lon { get; set; }
    }

    public class DepartureStoptime
    {
        [JsonPropertyName("scheduledDeparture")]
        public int ScheduledDeparture { get; set; }
    }

    public class RouteDetails
    {
        [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }
        public string GtfsIdValue => GtfsId.Split(':', 2)[1];

        [JsonPropertyName("shortName")] public string? ShortName { get; set; }

        [JsonPropertyName("color")] public string? Color { get; set; }

        [JsonPropertyName("textColor")] public string? TextColor { get; set; }

        [JsonPropertyName("longName")] public string? LongName { get; set; }
    }

    public class PickupType
    {
        private readonly string _value;

        private PickupType(string value)
        {
            _value = value;
        }

        public static PickupType Parse(string value)
        {
            return value switch
            {
                "SCHEDULED" => Scheduled,
                "NONE" => None,
                "CALL_AGENCY" => CallAgency,
                "COORDINATE_WITH_DRIVER" => CoordinateWithDriver,
                _ => throw new ArgumentException("Unsupported pickup type ", value)
            };
        }

        public static readonly PickupType Scheduled = new PickupType("SCHEDULED");
        public static readonly PickupType None = new PickupType("NONE");
        public static readonly PickupType CallAgency = new PickupType("CALL_AGENCY");
        public static readonly PickupType CoordinateWithDriver = new PickupType("COORDINATE_WITH_DRIVER");

        public override bool Equals(object? other)
        {
            if (other is not PickupType otherPt)
            {
                return false;
            }

            return otherPt._value == _value;
        }

        public override int GetHashCode()
        {
            return _value.GetHashCode();
        }
    }
}
