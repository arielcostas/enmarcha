using System.Text.Json.Serialization;

namespace Enmarcha.Sources.OpenTripPlannerGql.Queries;

public class RoutesListContent : IGraphRequest<RoutesListContent.Args>
{
    public record Args(string[] Feeds, string ServiceDate);

    public static string Query(Args args)
    {
        var feedsArg = args.Feeds.Length > 0
            ? $"(feeds: [{string.Join(", ", args.Feeds.Select(f => $"\"{f}\""))}])"
            : "";
        return $$"""
        query Query {
          routes{{feedsArg}} {
            gtfsId
            shortName
            longName
            color
            textColor
            sortOrder
            agency {
              name
            }
            patterns {
              tripsForDate(serviceDate: "{{args.ServiceDate}}") {
                id
              }
            }
          }
        }
        """;
    }
}

public class RoutesListResponse : AbstractGraphResponse
{
    [JsonPropertyName("routes")] public List<RouteItem> Routes { get; set; } = [];

    public class RouteItem
    {
        [JsonPropertyName("gtfsId")] public required string GtfsId { get; set; }
        [JsonPropertyName("shortName")] public string? ShortName { get; set; }
        [JsonPropertyName("longName")] public string? LongName { get; set; }
        [JsonPropertyName("color")] public string? Color { get; set; }
        [JsonPropertyName("textColor")] public string? TextColor { get; set; }
        [JsonPropertyName("sortOrder")] public int? SortOrder { get; set; }
        [JsonPropertyName("agency")] public AgencyItem? Agency { get; set; }
        [JsonPropertyName("patterns")] public List<PatternItem> Patterns { get; set; } = [];
    }

    public class AgencyItem
    {
        [JsonPropertyName("name")] public string? Name { get; set; }
    }

    public class PatternItem
    {
        [JsonPropertyName("tripsForDate")] public List<TripItem> TripsForDate { get; set; } = [];
    }

    public class TripItem
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
    }
}
