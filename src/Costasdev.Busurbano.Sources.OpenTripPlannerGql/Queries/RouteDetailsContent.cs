using System.Globalization;
using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;

public class RouteDetailsContent : IGraphRequest<RouteDetailsContent.Args>
{
    public record Args(string Id, string ServiceDate);

    public static string Query(Args args)
    {
        return string.Create(CultureInfo.InvariantCulture, $$"""
        query Query {
          route(id: "{{args.Id}}") {
            gtfsId
            shortName
            longName
            color
            textColor

            patterns {
              id
              name
              headsign
              directionId
              code
              semanticHash

              patternGeometry {
                points
              }

              stops {
                gtfsId
                code
                name
                lat
                lon
              }

              tripsForDate(serviceDate: "{{args.ServiceDate}}") {
                stoptimes {
                  scheduledDeparture
                }
              }
            }
          }
        }
        """);
    }
}

public class RouteDetailsResponse : AbstractGraphResponse
{
    [JsonPropertyName("route")] public RouteItem? Route { get; set; }

    public class RouteItem
    {
        [JsonPropertyName("gtfsId")] public string? GtfsId { get; set; }
        [JsonPropertyName("shortName")] public string? ShortName { get; set; }
        [JsonPropertyName("longName")] public string? LongName { get; set; }
        [JsonPropertyName("color")] public string? Color { get; set; }
        [JsonPropertyName("textColor")] public string? TextColor { get; set; }
        [JsonPropertyName("patterns")] public List<PatternItem> Patterns { get; set; } = [];
    }

    public class PatternItem
    {
        [JsonPropertyName("id")] public required string Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("headsign")] public string? Headsign { get; set; }
        [JsonPropertyName("directionId")] public int DirectionId { get; set; }
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("semanticHash")] public string? SemanticHash { get; set; }
        [JsonPropertyName("patternGeometry")] public GeometryItem? PatternGeometry { get; set; }
        [JsonPropertyName("stops")] public List<StopItem> Stops { get; set; } = [];
        [JsonPropertyName("tripsForDate")] public List<TripItem> TripsForDate { get; set; } = [];
    }

    public class GeometryItem
    {
        [JsonPropertyName("points")] public string? Points { get; set; }
    }

    public class StopItem
    {
        [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("name")] public required string Name { get; set; }
        [JsonPropertyName("lat")] public double Lat { get; set; }
        [JsonPropertyName("lon")] public double Lon { get; set; }
    }

    public class TripItem
    {
        [JsonPropertyName("stoptimes")] public List<StoptimeItem> Stoptimes { get; set; } = [];
    }

    public class StoptimeItem
    {
        [JsonPropertyName("scheduledDeparture")] public int ScheduledDeparture { get; set; }
    }
}
