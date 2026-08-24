using System.Globalization;
using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries;

public class AllStopsBasicsContent : IGraphRequest
{
    public static string Query()
    {
        return string.Create(CultureInfo.InvariantCulture, $$"""
                                                                    query Query {
                                                                         stops {
                                                                             code
                                                                             name
                                                                             lat
                                                                             lon
                                                                             routes {
                                                                                 gtfsId
                                                                                 shortName
                                                                                 longName
                                                                                 color
                                                                                 textColor
                                                                             }
                                                                         }
                                                                     }

                                                             """);
    }
}

public class AllStopsBasicsResponse : AbstractGraphResponse
{
    [JsonPropertyName("stops")] public Stop[] Stops { get; set; }

    public class Stop
    {
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("name")] public required string Name { get; set; }
        [JsonPropertyName("lat")] public double Lat { get; set; }
        [JsonPropertyName("lon")] public double Lon { get; set; }
        [JsonPropertyName("routes")] public List<StopRoute> Routes { get; set; } = [];
    }

    public class StopRoute
    {
        [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }
        [JsonPropertyName("shortName")] public string? ShortName { get; set; }
        [JsonPropertyName("longName")] public string? LongName { get; set; }
        [JsonPropertyName("color")] public string? Color { get; set; }
        [JsonPropertyName("textColor")] public string? TextColor { get; set; }
    }
}
