using System.Globalization;
using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Backend.GraphClient.App;

public class StopTileRequestContent : IGraphRequest<StopTileRequestContent.Bbox>
{
    public record Bbox(double MinLon, double MinLat, double MaxLon, double MaxLat);

    public static string Query(Bbox bbox)
    {
        return string.Create(CultureInfo.InvariantCulture, $@"
        query Query {{
            stopsByBbox(
                minLat: {bbox.MinLat:F6}
                minLon: {bbox.MinLon:F6}
                maxLon: {bbox.MaxLon:F6}
                maxLat: {bbox.MaxLat:F6}
            ) {{
                gtfsId
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
            }}
        }}
        ");
    }
}

public class StopTileResponse : AbstractGraphResponse
{
    [JsonPropertyName("stopsByBbox")]
    public List<Stop>? StopsByBbox { get; set; }

    public record Stop
    {
        [JsonPropertyName("gtfsId")]
        public required string GtfsId { get; init; }

        [JsonPropertyName("code")]
        public string? Code { get; init; }

        [JsonPropertyName("name")]
        public required string Name { get; init; }

        [JsonPropertyName("lat")]
        public required double Lat { get; init; }

        [JsonPropertyName("lon")]
        public required double Lon { get; init; }

        [JsonPropertyName("routes")]
        public List<Route>? Routes { get; init; }
    }

    public record Route
    {
        [JsonPropertyName("gtfsId")]
        public required string GtfsId { get; init; }
        [JsonPropertyName("shortName")]
        public required string ShortName { get; init; }

        [JsonPropertyName("color")]
        public string? Color { get; init; }

        [JsonPropertyName("textColor")]
        public string? TextColor { get; init; }
    }
}
