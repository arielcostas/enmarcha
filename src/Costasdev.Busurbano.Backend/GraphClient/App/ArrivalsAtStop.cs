using System.Globalization;
using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Backend.GraphClient.App;

public class ArrivalsAtStopContent : IGraphRequest<string>
{
    public static string Query(string id)
    {
        return string.Create(CultureInfo.InvariantCulture, $@"
        query Query {{
            stop(id:""{id}"") {{
                code
                name
                arrivals: stoptimesWithoutPatterns(numberOfDepartures:10) {{
                    trip {{
                        gtfsId
                        routeShortName
                        route {{
                            color
                            textColor
                        }}
                    }}
                    headsign
                    scheduledDeparture
                }}
            }}
        }}
        ");
    }
}

public class ArrivalsAtStopResponse : AbstractGraphResponse
{
    [JsonPropertyName("stop")]
    public StopItem Stop { get; set; }

    public class StopItem
    {
        [JsonPropertyName("code")]
        public required string Code { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("arrivals")]
        public List<Arrival> Arrivals { get; set; } = [];
    }

    public class Arrival
    {
        [JsonPropertyName("headsign")]
        public required string Headsign { get; set; }

        [JsonPropertyName("scheduledDeparture")]
        public int ScheduledDepartureSeconds { get; set; }

        [JsonPropertyName("trip")]
        public required TripDetails Trip { get; set; }
    }

    public class TripDetails
    {
        [JsonPropertyName("gtfsId")]
        public required string GtfsId { get; set; }

        [JsonPropertyName("routeShortName")]
        public required string RouteShortName { get; set; }

        [JsonPropertyName("route")]
        public required RouteDetails Route  { get; set; }
    }

    public class RouteDetails
    {
        [JsonPropertyName("color")]
        public required string Color { get; set; }

        [JsonPropertyName("textColor")]
        public required string TextColor { get; set; }
    }
}
