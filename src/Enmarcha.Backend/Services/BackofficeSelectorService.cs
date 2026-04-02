using Enmarcha.Backend.Configuration;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Services;

public class BackofficeSelectorService(
    HttpClient httpClient,
    IOptions<AppConfiguration> config,
    IMemoryCache cache,
    ILogger<BackofficeSelectorService> logger)
{
    public async Task<SelectorTransitData> GetTransitDataAsync()
    {
        const string cacheKey = "backoffice_transit";
        if (cache.TryGetValue(cacheKey, out SelectorTransitData? cached) && cached is not null)
            return cached;

        var feeds = config.Value.OtpFeeds;
        var today = DateTime.Today.ToString("yyyy-MM-dd");
        var query = RoutesListContent.Query(new RoutesListContent.Args(feeds, today));

        List<RoutesListResponse.RouteItem> routes = [];
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, $"{config.Value.OpenTripPlannerBaseUrl}/gtfs/v1");
            req.Content = JsonContent.Create(new GraphClientRequest { Query = query });
            var resp = await httpClient.SendAsync(req);
            resp.EnsureSuccessStatusCode();
            var body = await resp.Content.ReadFromJsonAsync<GraphClientResponse<RoutesListResponse>>();
            routes = body?.Data?.Routes ?? [];
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch routes from OTP");
        }

        var routeDtos = routes
            .Select(r =>
            {
                var (feedId, routeId) = SplitGtfsId(r.GtfsId);
                var color = NormalizeColor(r.Color);
                return new SelectorRouteItem(feedId, r.GtfsId, $"route#{feedId}:{routeId}", r.ShortName, r.LongName, r.Agency?.Name, r.Agency?.GtfsId, color);
            })
            .OrderBy(r => r.ShortName)
            .ToList();

        // Group by the full agency gtfsId (feedId:agencyId) so that feeds with
        // multiple agencies each get their own entry.
        var agencyDtos = routeDtos
            .Where(r => r.AgencyGtfsId is not null && r.AgencyName is not null)
            .GroupBy(r => r.AgencyGtfsId!)
            .Select(g => new SelectorAgencyItem(g.Key, $"agency#{g.Key}", g.First().AgencyName!))
            .ToList();

        var result = new SelectorTransitData(agencyDtos, routeDtos);
        cache.Set(cacheKey, result, TimeSpan.FromHours(1));
        return result;
    }

    public async Task<List<SelectorStopItem>> GetStopsByBboxAsync(
        double minLon, double minLat, double maxLon, double maxLat)
    {
        // Cache per coarse grid (~0.1° cells, roughly 8 km) to reuse across small pans
        var cacheKey = $"stops_{minLon:F1}_{minLat:F1}_{maxLon:F1}_{maxLat:F1}";
        if (cache.TryGetValue(cacheKey, out List<SelectorStopItem>? cached) && cached is not null)
            return cached;

        var query = StopTileRequestContent.Query(
            new StopTileRequestContent.TileRequestParams(minLon, minLat, maxLon, maxLat));
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, $"{config.Value.OpenTripPlannerBaseUrl}/gtfs/v1");
            req.Content = JsonContent.Create(new GraphClientRequest { Query = query });
            var resp = await httpClient.SendAsync(req);
            resp.EnsureSuccessStatusCode();
            var body = await resp.Content.ReadFromJsonAsync<GraphClientResponse<StopTileResponse>>();
            var stops = (body?.Data?.StopsByBbox ?? [])
                .Select(s =>
                {
                    var (feedId, stopId) = SplitGtfsId(s.GtfsId);
                    var routeItems = (s.Routes ?? []).Select(r =>
                    {
                        var (rf, ri) = SplitGtfsId(r.GtfsId);
                        return new SelectorRouteItem(rf, r.GtfsId, $"route#{rf}:{ri}", r.ShortName, null, null, null, NormalizeColor(r.Color));
                    }).ToList();
                    return new SelectorStopItem(s.GtfsId, $"stop#{feedId}:{stopId}", s.Name, s.Code, s.Lat, s.Lon, routeItems);
                })
                .ToList();
            cache.Set(cacheKey, stops, TimeSpan.FromMinutes(30));
            return stops;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch stops from OTP for bbox {MinLon},{MinLat} to {MaxLon},{MaxLat}",
                minLon, minLat, maxLon, maxLat);
            return [];
        }
    }

    private static (string FeedId, string EntityId) SplitGtfsId(string gtfsId)
    {
        var parts = gtfsId.Split(':', 2);
        return (parts[0], parts.Length > 1 ? parts[1] : gtfsId);
    }

    private static string? NormalizeColor(string? color)
    {
        if (string.IsNullOrWhiteSpace(color)) return null;
        return color.StartsWith('#') ? color : '#' + color;
    }
}

public record SelectorTransitData(List<SelectorAgencyItem> Agencies, List<SelectorRouteItem> Routes);
/// <param name="AgencyGtfsId">Full GTFS agency id in the form <c>feedId:agencyId</c>.</param>
public record SelectorAgencyItem(string AgencyGtfsId, string Selector, string Name);
public record SelectorRouteItem(string FeedId, string GtfsId, string Selector, string? ShortName, string? LongName, string? AgencyName, string? AgencyGtfsId, string? Color);
public record SelectorStopItem(string GtfsId, string Selector, string Name, string? Code, double Lat, double Lon, List<SelectorRouteItem> Routes);
