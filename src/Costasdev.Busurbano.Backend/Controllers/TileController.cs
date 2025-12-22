using Costasdev.Busurbano.Backend.GraphClient;
using Costasdev.Busurbano.Backend.GraphClient.App;

using NetTopologySuite.Features;
using NetTopologySuite.IO.VectorTiles;
using NetTopologySuite.IO.VectorTiles.Mapbox;

using Microsoft.AspNetCore.Mvc;

using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;
using Costasdev.Busurbano.Backend.Helpers;

namespace Costasdev.Busurbano.Backend.Controllers;

[ApiController]
[Route("api/tiles")]
public class TileController : ControllerBase
{
    private readonly ILogger<TileController> _logger;
    private readonly IMemoryCache _cache;
    private readonly HttpClient _httpClient;

    public TileController(
        ILogger<TileController> logger,
        IMemoryCache cache,
        HttpClient httpClient
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
    }

    private static readonly string[] HiddenStops =
    [
        "vitrasa:20223", // Castrelos (Pavillón - U1)
        "vitrasa:20146", // García Barbón, 7 (A, 18A)
        "vitrasa:20220", // COIA-SAMIL (15)
        "vitrasa:20001", // Samil por Beiramar (15B)
        "vitrasa:20002", // Samil por Torrecedeira (15C)
        "vitrasa:20144", // Samil por Coia (C3d, C3i)
        "vitrasa:20145"  // Samil por Bouzs (C3d, C3i)
    ];

    [HttpGet("stops/{z:int}/{x:int}/{y:int}")]
    public async Task<IActionResult> Stops(int z, int x, int y)
    {
        if (z < 9 || z > 16)
        {
            return BadRequest("Zoom level out of range (9-16)");
        }

        var cacheHit = _cache.TryGetValue($"stops-tile-{z}-{x}-{y}", out byte[]? cachedTile);
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
        var request = new HttpRequestMessage(HttpMethod.Post, "http://100.67.54.115:3957/otp/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = requestContent
        });

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopTileResponse>>();

        if (responseBody is not { IsSuccess: true })
        {
            _logger.LogError(
                "Error fetching stop data, received {StatusCode} {ResponseBody}",
                response.StatusCode,
                await response.Content.ReadAsStringAsync()
            );
            return StatusCode(500, "Error fetching stop data");
        }

        var tileDef = new NetTopologySuite.IO.VectorTiles.Tiles.Tile(x, y, z);
        VectorTile vt = new() { TileId = tileDef.Id };
        var lyr = new Layer { Name = "stops" };

        responseBody.Data?.StopsByBbox?.ForEach(stop =>
        {
            var idParts = stop.GtfsId.Split(':', 2);
            string codeWithinFeed = stop.Code ?? string.Empty;

            // TODO: Refactor this, maybe do it client-side or smth
            if (idParts[0] == "vitrasa")
            {
                var digits = new string(codeWithinFeed.Where(char.IsDigit).ToArray());
                if (int.TryParse(digits, out int code))
                {
                    codeWithinFeed = code.ToString();
                }
            }

            if (HiddenStops.Contains($"{idParts[0]}:{codeWithinFeed}"))
            {
                return;
            }

            var fallbackColours = GetFallbackColourForFeed(idParts[0]);

            Feature feature = new()
            {
                Geometry = new NetTopologySuite.Geometries.Point(stop.Lon, stop.Lat),
                Attributes = new AttributesTable
                {
                    // The ID will be used to request the arrivals
                    { "id", stop.GtfsId },
                    // The feed is the first part of the GTFS ID, corresponding to the feed where the info comes from, used for icons probably
                    { "feed", idParts[0] },
                    // The public identifier, usually feed:code or feed:id, recognisable by users and in other systems
                    { "code", $"{idParts[0]}:{codeWithinFeed}" },
                    // The name of the stop
                    { "name", stop.Name },
                    // Routes
                    { "routes", JsonSerializer.Serialize(stop.Routes?
                    .DistinctBy(r => r.ShortName)
                    .OrderBy(
                        r => r.ShortName,
                        Comparer<string?>.Create(SortingHelper.SortRouteShortNames)
                    ).Select(r => {
                        var colour = r.Color ?? fallbackColours.Color;
                        string textColour;

                        if (r.Color is null) // None is present, use fallback
                        {
                            textColour = fallbackColours.TextColor;
                        }
                        else if (r.TextColor is null || r.TextColor.EndsWith("000000"))
                        {
                            // Text colour not provided, or default-black; check the better contrasting
                            textColour = ContrastHelper.GetBestTextColour(colour);
                        }
                        else
                        {
                            // Use provided text colour
                            textColour = r.TextColor;
                        }

                        return new {
                            shortName = r.ShortName,
                            colour,
                            textColour
                        };
                    })) }
                }
            };

            lyr.Features.Add(feature);
        });

        vt.Layers.Add(lyr);

        using var ms = new MemoryStream();
        vt.Write(ms, minLinealExtent: 1, minPolygonalExtent: 2);

        _cache.Set($"stops-tile-{z}-{x}-{y}", ms.ToArray(), TimeSpan.FromMinutes(15));
        Response.Headers.Append("X-Cache-Hit", "false");

        return File(ms.ToArray(), "application/x-protobuf");
    }

    private static (string Color, string TextColor) GetFallbackColourForFeed(string feed)
    {
        return feed switch
        {
            "vitrasa" => ("#95D516", "#000000"),
            "santiago" => ("#508096", "#FFFFFF"),
            "coruna" => ("#E61C29", "#FFFFFF"),
            "xunta" => ("#007BC4", "#FFFFFF"),
            "renfe" => ("#870164", "#FFFFFF"),
            "feve" => ("#EE3D32", "#FFFFFF"),
            _ => ("#000000", "#FFFFFF"),

        };
    }

}
