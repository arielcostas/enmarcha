using System.Globalization;
using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries;

public class StopTileRequestContent : IGraphRequest<StopTileRequestContent.TileRequestParams>
{
    public record TileRequestParams(
        double MinLon,
        double MinLat,
        double MaxLon,
        double MaxLat,
        string[]? Feeds = null
    );

    public static string Query(TileRequestParams req)
    {
        var feedsFilter = req.Feeds != null && req.Feeds.Length > 0
            ? $"feeds: [{string.Join(", ", req.Feeds.Select(f => $"\"{f}\""))}]"
            : string.Empty;

        return string.Create(CultureInfo.InvariantCulture, $@"
        query Query {{
            stopsByBbox(
                minLat: {req.MinLat:F6}
                minLon: {req.MinLon:F6}
                maxLon: {req.MaxLon:F6}
                maxLat: {req.MaxLat:F6}
                {feedsFilter}
            ) {{
                gtfsId
                code
                name
                desc
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

        [JsonPropertyName("desc")]
        public string? Desc { get; set; }

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
