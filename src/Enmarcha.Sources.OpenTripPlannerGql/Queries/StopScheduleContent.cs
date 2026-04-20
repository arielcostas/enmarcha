using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries;

public class StopScheduleContent : IGraphRequest<StopScheduleContent.Args>
{
    public record Args(string Id, string Date);

    public static string Query(Args args)
    {
        return $@"
        query Query {{
            stop(id:""{args.Id}"") {{
                code
                name
                lat
                lon
                stoptimesForServiceDate(date:""{args.Date}"") {{
                    pattern {{
                        id
                        headsign
                        directionId
                        route {{
                            gtfsId
                            shortName
                            color
                            textColor
                        }}
                    }}
                    stoptimes {{
                        scheduledDeparture
                        pickupType
                        dropoffType
                        trip {{
                            gtfsId
                            tripHeadsign
                            departureStoptime {{
                                stop {{
                                    gtfsId
                                    name
                                }}
                            }}
                            arrivalStoptime {{
                                stop {{
                                    gtfsId
                                    name
                                }}
                            }}
                            route {{
                                agency {{
                                    name
                                }}
                            }}
                        }}
                    }}
                }}
            }}
        }}
        ";
    }
}

public class StopScheduleOtpResponse : AbstractGraphResponse
{
    [JsonPropertyName("stop")]
    public StopItem? Stop { get; set; }

    public class StopItem
    {
        [JsonPropertyName("code")]
        public required string Code { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("lat")]
        public double Lat { get; set; }

        [JsonPropertyName("lon")]
        public double Lon { get; set; }

        [JsonPropertyName("stoptimesForServiceDate")]
        public List<PatternStoptimes> StoptimesForServiceDate { get; set; } = [];
    }

    public class PatternStoptimes
    {
        [JsonPropertyName("pattern")]
        public required PatternRef Pattern { get; set; }

        [JsonPropertyName("stoptimes")]
        public List<Stoptime> Stoptimes { get; set; } = [];
    }

    public class PatternRef
    {
        [JsonPropertyName("id")]
        public required string Id { get; set; }

        [JsonPropertyName("headsign")]
        public string? Headsign { get; set; }

        [JsonPropertyName("directionId")]
        public int DirectionId { get; set; }

        [JsonPropertyName("route")]
        public required RouteRef Route { get; set; }
    }

    public class RouteRef
    {
        [JsonPropertyName("gtfsId")]
        public required string GtfsId { get; set; }

        [JsonPropertyName("shortName")]
        public string? ShortName { get; set; }

        [JsonPropertyName("color")]
        public string? Color { get; set; }

        [JsonPropertyName("textColor")]
        public string? TextColor { get; set; }
    }

    public class Stoptime
    {
        [JsonPropertyName("scheduledDeparture")]
        public int ScheduledDepartureSeconds { get; set; }

        [JsonPropertyName("pickupType")]
        public string? PickupType { get; set; }

        [JsonPropertyName("dropoffType")]
        public string? DropoffType { get; set; }

        [JsonPropertyName("trip")]
        public TripRef? Trip { get; set; }
    }

    public class TripRef
    {
        [JsonPropertyName("gtfsId")]
        public required string GtfsId { get; set; }

        [JsonPropertyName("tripHeadsign")]
        public string? TripHeadsign { get; set; }

        [JsonPropertyName("departureStoptime")]
        public TerminusStoptime? DepartureStoptime { get; set; }

        [JsonPropertyName("arrivalStoptime")]
        public TerminusStoptime? ArrivalStoptime { get; set; }

        [JsonPropertyName("route")]
        public TripRouteRef? Route { get; set; }
    }

    public class TerminusStoptime
    {
        [JsonPropertyName("stop")]
        public StopRef? Stop { get; set; }
    }

    public class StopRef
    {
        [JsonPropertyName("gtfsId")]
        public string? GtfsId { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }
    }

    public class TripRouteRef
    {
        [JsonPropertyName("agency")]
        public AgencyRef? Agency { get; set; }
    }

    public class AgencyRef
    {
        [JsonPropertyName("name")]
        public required string Name { get; set; }
    }
}

