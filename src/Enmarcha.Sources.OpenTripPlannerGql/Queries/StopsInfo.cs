using System.Globalization;
using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries;

public class StopsInfoContent : IGraphRequest<StopsInfoContent.Args>
{
    public record Args(IEnumerable<string> Ids);

    public static string Query(Args args)
    {
        var idsString = string.Join("\",\"", args.Ids);
        return string.Create(CultureInfo.InvariantCulture, $@"
        query Query {{
            stops(ids: [""{idsString}""]) {{
                gtfsId
                code
                name
                lat
                lon
                routes {{
                    shortName
                    color
                    textColor
                }}
            }}
        }}
        ");
    }
}

public class StopsInfoResponse : AbstractGraphResponse
{
    [JsonPropertyName("stops")] public List<StopItem>? Stops { get; set; }

    public class StopItem
    {
        [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }

        [JsonPropertyName("code")] public string? Code { get; set; }

        [JsonPropertyName("name")] public required string Name { get; set; }

        [JsonPropertyName("lat")] public double Lat { get; set; }

        [JsonPropertyName("lon")] public double Lon { get; set; }

        [JsonPropertyName("routes")] public List<RouteDetails> Routes { get; set; } = [];
    }

    public class RouteDetails
    {
        [JsonPropertyName("shortName")] public string? ShortName { get; set; }
        [JsonPropertyName("color")] public string? Color { get; set; }
        [JsonPropertyName("textColor")] public string? TextColor { get; set; }
    }
}
