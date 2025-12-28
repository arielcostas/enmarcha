using System.Globalization;
using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries;

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
        public required string GtfsId { get; set; }

        [JsonPropertyName("code")]
        public string? Code { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("lat")]
        public required double Lat { get; set; }

        [JsonPropertyName("lon")]
        public required double Lon { get; set; }

        [JsonPropertyName("routes")]
        public List<Route>? Routes { get; set; }
    }

    public record Route
    {
        [JsonPropertyName("gtfsId")]
        public required string GtfsId { get; set; }
        [JsonPropertyName("shortName")]
        public required string ShortName { get; set; }

        [JsonPropertyName("color")]
        public string? Color { get; set; }

        [JsonPropertyName("textColor")]
        public string? TextColor { get; set; }
    }
}
