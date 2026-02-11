using NetTopologySuite.Features;
using NetTopologySuite.IO.VectorTiles;
using NetTopologySuite.IO.VectorTiles.Mapbox;

using Microsoft.AspNetCore.Mvc;

using Microsoft.Extensions.Caching.Memory;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Services;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api/tiles")]
public class TileController : ControllerBase
{
    private readonly ILogger<TileController> _logger;
    private readonly IMemoryCache _cache;
    private readonly HttpClient _httpClient;
    private readonly FeedService _feedService;
    private readonly AppConfiguration _config;

    public TileController(
        ILogger<TileController> logger,
        IMemoryCache cache,
        HttpClient httpClient,
        FeedService feedService,
        IOptions<AppConfiguration> configOptions
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
        _feedService = feedService;
        _config = configOptions.Value;
    }

    [HttpGet("stops/{z:int}/{x:int}/{y:int}")]
    public async Task<IActionResult> Stops(int z, int x, int y)
    {
        using var activity = Telemetry.Source.StartActivity("GenerateStopsTile");
        activity?.SetTag("tile.z", z);
        activity?.SetTag("tile.x", x);
        activity?.SetTag("tile.y", y);

        if (z is < 9 or > 20)
        {
            return BadRequest("Zoom level out of range (9-20)");
        }

        var cacheHit = _cache.TryGetValue($"stops-tile-{z}-{x}-{y}", out byte[]? cachedTile);
        activity?.SetTag("cache.hit", cacheHit);

        if (cacheHit && cachedTile != null)
        {
            Response.Headers.Append("X-Cache-Hit", "true");
            return File(cachedTile, "application/x-protobuf");
        }

        // Calculate bounding box in EPSG:4326
        var n = Math.Pow(2, z);
        var lonMin = x / n * 360.0 - 180.0;
        var lonMax = (x + 1) / n * 360.0 - 180.0;

        var latMaxRad = Math.Atan(Math.Sinh(Math.PI * (1 - 2 * y / n)));
        var latMax = latMaxRad * 180.0 / Math.PI;

        var latMinRad = Math.Atan(Math.Sinh(Math.PI * (1 - 2 * (y + 1) / n)));
        var latMin = latMinRad * 180.0 / Math.PI;

        var requestContent = StopTileRequestContent.Query(new StopTileRequestContent.Bbox(lonMin, latMin, lonMax, latMax));
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = requestContent
        });

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopTileResponse>>();

        if (responseBody is not { IsSuccess: true })
        {
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, "Error fetching stop data from OTP");
            _logger.LogError(
                "Error fetching stop data, received {StatusCode} {ResponseBody}",
                response.StatusCode,
                await response.Content.ReadAsStringAsync()
            );
            return StatusCode(500, "Error fetching stop data");
        }

        var tileDef = new NetTopologySuite.IO.VectorTiles.Tiles.Tile(x, y, z);
        VectorTile vt = new() { TileId = tileDef.Id };
        var stopsLayer = new Layer { Name = "stops" };

        responseBody.Data?.StopsByBbox?.ForEach(stop =>
        {
            var idParts = stop.GtfsId.Split(':', 2);
            string feedId = idParts[0];
            string codeWithinFeed = _feedService.NormalizeStopCode(feedId, stop.Code ?? string.Empty);

            if (_feedService.IsStopHidden($"{feedId}:{codeWithinFeed}"))
            {
                return;
            }

            // TODO: Duplicate from ArrivalsController
            var (Color, TextColor) = _feedService.GetFallbackColourForFeed(idParts[0]);
            var distinctRoutes = GetDistinctRoutes(feedId, stop.Routes ?? []);

            Feature feature = new()
            {
                Geometry = new NetTopologySuite.Geometries.Point(stop.Lon, stop.Lat),
                Attributes = new AttributesTable
                {
                    // The ID will be used to request the arrivals
                    { "id", stop.GtfsId },
                    // The feed is the first part of the GTFS ID
                    { "feed", idParts[0] },
                    // The public identifier, usually feed:code or feed:id, recognisable by users and in other systems
                    { "code", $"{idParts[0]}:{codeWithinFeed}" },
                    { "name", _feedService.NormalizeStopName(feedId, stop.Name) },
                    { "icon", GetIconNameForFeed(feedId) },
                    { "transitKind", GetTransitKind(feedId) }
                }
            };

            stopsLayer.Features.Add(feature);
        });

        vt.Layers.Add(stopsLayer);

        using var ms = new MemoryStream();
        vt.Write(ms, minLinealExtent: 1, minPolygonalExtent: 2);

        _cache.Set($"stops-tile-{z}-{x}-{y}", ms.ToArray(), TimeSpan.FromMinutes(15));
        Response.Headers.Append("X-Cache-Hit", "false");

        return File(ms.ToArray(), "application/x-protobuf");
    }

    private string GetIconNameForFeed(string feedId)
    {
        return feedId switch
        {
            "vitrasa" => "stop-vitrasa",
            "tussa" => "stop-tussa",
            "tranvias" => "stop-tranvias",
            "xunta" => "stop-xunta",
            "renfe" => "stop-renfe",
            "feve" => "stop-feve",
            _ => "stop-generic",
        };
    }

    private string GetTransitKind(string feedId)
    {
        return feedId switch
        {
            "vitrasa" or "tussa" or "tranvias" or "shuttle" => "bus",
            "xunta" => "coach",
            "renfe" or "feve" => "train",
            _ => "unknown"
        };
    }

    private List<StopTileResponse.Route> GetDistinctRoutes(string feedId, List<StopTileResponse.Route> routes)
    {
        List<StopTileResponse.Route> distinctRoutes = [];
        HashSet<string> seen = new();

        foreach (var route in routes)
        {
            var seenId = _feedService.GetUniqueRouteShortName(feedId, route.ShortName ?? string.Empty);
            route.ShortName = seenId;

            if (seen.Contains(seenId))
            {
                continue;
            }

            seen.Add(seenId);
            distinctRoutes.Add(route);
        }

        return [.. distinctRoutes.OrderBy(
            r => r.ShortName,
            Comparer<string?>.Create(SortingHelper.SortRouteShortNames)
        )];
    }
}
