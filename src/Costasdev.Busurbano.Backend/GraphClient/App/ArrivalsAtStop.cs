using System.Globalization;
using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Backend.GraphClient.App;

public class ArrivalsAtStopContent : IGraphRequest<ArrivalsAtStopContent.Args>
{
    public record Args(string Id, int DepartureCount);

    public static string Query(Args args)
    {
        return string.Create(CultureInfo.InvariantCulture, $@"
        query Query {{
            stop(id:""{args.Id}"") {{
                code
                name
                arrivals: stoptimesWithoutPatterns(numberOfDepartures:{args.DepartureCount}) {{
                    headsign
                    scheduledDeparture
                    pickupType

                    trip {{
                        gtfsId
                        serviceId
                        routeShortName
                        route {{
                            color
                            textColor
                        }}
                        departureStoptime {{
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
    [JsonPropertyName("stop")] public StopItem Stop { get; set; }

    public class StopItem
    {
        [JsonPropertyName("code")] public required string Code { get; set; }

        [JsonPropertyName("name")] public required string Name { get; set; }

        [JsonPropertyName("arrivals")] public List<Arrival> Arrivals { get; set; } = [];
    }

    public class Arrival
    {
        [JsonPropertyName("headsign")] public required string Headsign { get; set; }

        [JsonPropertyName("scheduledDeparture")]
        public int ScheduledDepartureSeconds { get; set; }

        [JsonPropertyName("pickupType")] public required string PickupTypeOriginal { get; set; }

        public PickupType PickupTypeParsed => PickupTypeParsed.Parse(PickupTypeOriginal);

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
    }

    public class DepartureStoptime
    {
        [JsonPropertyName("scheduledDeparture")]
        public int ScheduledDeparture { get; set; }
    }

    public class RouteDetails
    {
        [JsonPropertyName("color")] public required string Color { get; set; }

        [JsonPropertyName("textColor")] public required string TextColor { get; set; }
    }

    public class PickupType
    {
        private readonly string _value;

        private PickupType(string value)
        {
            _value = value;
        }

        public PickupType Parse(string value)
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
