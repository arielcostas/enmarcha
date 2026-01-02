using System.Net;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Services.Geocoding;
using Enmarcha.Backend.Types.Planner;
using FuzzySharp;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api/planner")]
public partial class RoutePlannerController : ControllerBase
{
    private readonly ILogger<RoutePlannerController> _logger;
    private readonly OtpService _otpService;
    private readonly IGeocodingService _geocodingService;
    private readonly AppConfiguration _config;
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly FeedService _feedService;

    private const string GaliciaBounds = "-9.3,43.8,-6.7,41.7";

    public RoutePlannerController(
        ILogger<RoutePlannerController> logger,
        OtpService otpService,
        IGeocodingService geocodingService,
        IOptions<AppConfiguration> config,
        HttpClient httpClient,
        IMemoryCache cache,
        FeedService feedService
    )
    {
        _logger = logger;
        _otpService = otpService;
        _geocodingService = geocodingService;
        _config = config.Value;
        _httpClient = httpClient;
        _cache = cache;
        _feedService = feedService;
    }

    [HttpGet("autocomplete")]
    public async Task<ActionResult<List<PlannerSearchResult>>> Autocomplete([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty");
        }

        var nominatimTask = _geocodingService.GetAutocompleteAsync(query);
        var stopsTask = GetCachedStopsAsync();

        await Task.WhenAll(nominatimTask, stopsTask);

        var geocodingResults = await nominatimTask;
        var allStops = await stopsTask;

        // Fuzzy search stops
        var fuzzyResults = Process.ExtractSorted(
            query,
            allStops.Select(s => s.Name ?? string.Empty),
            cutoff: 60
        ).Take(4).Select(r => allStops[r.Index]).ToList();

        // Merge results: geocoding first, then stops, deduplicating by coordinates (approx)
        var finalResults = new List<PlannerSearchResult>(geocodingResults);

        foreach (var res in fuzzyResults)
        {
            if (!finalResults.Any(f => Math.Abs(f.Lat - res.Lat) < 0.00001 && Math.Abs(f.Lon - res.Lon) < 0.00001))
            {
                finalResults.Add(res);
            }
        }

        return Ok(finalResults);
    }

    [HttpGet("reverse")]
    public async Task<ActionResult<PlannerSearchResult>> Reverse([FromQuery] double lat, [FromQuery] double lon)
    {
        var result = await _geocodingService.GetReverseGeocodeAsync(lat, lon);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    [HttpGet("plan")]
    public async Task<ActionResult<RoutePlan>> Plan(
        [FromQuery] double fromLat,
        [FromQuery] double fromLon,
        [FromQuery] double toLat,
        [FromQuery] double toLon,
        [FromQuery] DateTimeOffset? time,
        [FromQuery] bool arriveBy = false)
    {
        try
        {
            var requestContent = PlanConnectionContent.Query(
                new PlanConnectionContent.Args(fromLat, fromLon, toLat, toLon, time ?? DateTimeOffset.Now, arriveBy)
            );

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
            request.Content = JsonContent.Create(new GraphClientRequest
            {
                Query = requestContent
            });

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<PlanConnectionResponse>>();

            if (responseBody is not { IsSuccess: true })
            {
                LogErrorFetchingRoutes(response.StatusCode, await response.Content.ReadAsStringAsync());
                return StatusCode(500, "An error occurred while planning the route.");
            }

            var plan = _otpService.MapPlanResponse(responseBody.Data!);
            return Ok(plan);
        }
        catch (Exception e)
        {
            _logger.LogError("Exception planning route: {e}", e);
            return StatusCode(500, "An error occurred while planning the route.");
        }
    }

    [LoggerMessage(LogLevel.Error, "Error fetching route planning, received {statusCode} {responseBody}")]
    partial void LogErrorFetchingRoutes(HttpStatusCode? statusCode, string responseBody);

    private async Task<List<PlannerSearchResult>> GetCachedStopsAsync()
    {
        const string cacheKey = "otp_all_stops";
        if (_cache.TryGetValue(cacheKey, out List<PlannerSearchResult>? cachedStops) && cachedStops != null)
        {
            return cachedStops;
        }

        try
        {
            // Galicia bounds: minLon, minLat, maxLon, maxLat
            var bbox = new StopTileRequestContent.Bbox(-9.3, 41.7, -6.7, 43.8);
            var query = StopTileRequestContent.Query(bbox);

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
            request.Content = JsonContent.Create(new GraphClientRequest { Query = query });

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopTileResponse>>();

            if (responseBody is not { IsSuccess: true } || responseBody.Data?.StopsByBbox == null)
            {
                _logger.LogError("Error fetching stops from OTP for caching");
                return new List<PlannerSearchResult>();
            }

            var stops = responseBody.Data.StopsByBbox.Select(s =>
            {
                var feedId = s.GtfsId.Split(':')[0];
                var name = _feedService.NormalizeStopName(feedId, s.Name);
                var code = _feedService.NormalizeStopCode(feedId, s.Code ?? string.Empty);

                return new PlannerSearchResult
                {
                    Name = name,
                    Label = string.IsNullOrWhiteSpace(code) ? name : $"{name} ({code})",
                    Lat = s.Lat,
                    Lon = s.Lon,
                    Layer = "stop"
                };
            }).ToList();

            _cache.Set(cacheKey, stops, TimeSpan.FromHours(18));
            return stops;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception fetching stops from OTP for caching");
            return new List<PlannerSearchResult>();
        }
    }
}
