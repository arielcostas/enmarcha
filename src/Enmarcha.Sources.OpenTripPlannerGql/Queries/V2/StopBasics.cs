using System.Globalization;
using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries.V2;

public class StopBasicsContent : IGraphRequest<StopBasicsContent.Args>
{
    public record Args(string Id);

    public static string Query(Args args)
    {
        return string.Create(CultureInfo.InvariantCulture, $$"""
                                                                    query Query {
                                                                         stop(id: "{{args.Id}}") {
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

public class StopBasicsResponse : AbstractGraphResponse
{
    [JsonPropertyName("stop")] public StopStop? Stop { get; set; }

    public class StopStop
    {
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("name")] public required string Name { get; set; }
        [JsonPropertyName("lat")] public double Lat { get; set; }
        [JsonPropertyName("lon")] public double Lon { get; set; }
        [JsonPropertyName("routes")] public IEnumerable<StopRoute> Routes { get; set; } = [];
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
