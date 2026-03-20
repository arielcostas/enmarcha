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

        DateTime startTime = DateTime.UtcNow;
        var geocodingTask = _geocodingService.GetAutocompleteAsync(query).ContinueWith(t =>
        {
            var duration = DateTime.UtcNow - startTime;
            Response.Headers.Append("Server-Timing", $"geocoding;dur={(int)duration.TotalMilliseconds}");
            return t.Result;
        });
        var stopTask = SearchStops(query).ContinueWith(t =>
        {
            var duration = DateTime.UtcNow - startTime;
            Response.Headers.Append("Server-Timing", $"stop_search;dur={(int)duration.TotalMilliseconds}");
            return t.Result;
        });

        await Task.WhenAll(geocodingTask, stopTask);

        var geocodingResults = await geocodingTask;
        var stopResults = await stopTask;

        // Merge results: geocoding first, then stops, deduplicating by coordinates (approx)
        var finalResults = new List<PlannerSearchResult>(geocodingResults);

        foreach (var res in stopResults)
        {
            if (!finalResults.Any(f => Math.Abs(f.Lat - res.Lat) < 0.0001 && Math.Abs(f.Lon - res.Lon) < 0.0001))
            {
                finalResults.Add(res);
            }
        }

        return Ok(finalResults);
    }

    private async Task<List<PlannerSearchResult>> SearchStops(string query)
    {
        var stops = await GetCachedStopsAsync();

        // 1. Exact or prefix matches by stop code
        var codeMatches = stops
            .Where(s => s.StopCode != null && s.StopCode.StartsWith(query, StringComparison.OrdinalIgnoreCase))
            .OrderBy(s => s.StopCode?.Length) // Shorter codes (more exact matches) first
            .Take(5)
            .ToList();

        // 2. Fuzzy search stops by label (Name + Code)
        var fuzzyResults = Process.ExtractSorted(
            query,
            stops.Select(s => s.Label ?? string.Empty),
            cutoff: 60
        )
        .OrderByDescending(r => r.Score)
        .Take(6)
        .Select(r => stops[r.Index])
        .ToList();

        // Merge stops, prioritizing code matches
        var stopResults = codeMatches.Concat(fuzzyResults)
            .GroupBy(s => s.StopId)
            .Select(g => g.First())
            .Take(6)
            .ToList();

        return stopResults;
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
        const string cacheKey = "planner_mapped_stops";
        if (_cache.TryGetValue(cacheKey, out List<PlannerSearchResult>? cachedStops))
        {
            return cachedStops!;
        }

        var allStopsRaw = await _otpService.GetStopsByBboxAsync(-9.3, 41.7, -6.7, 43.8);

        var stops = allStopsRaw.Select(s =>
        {
            var feedId = s.GtfsId.Split(':')[0];
            var name = FeedService.NormalizeStopName(feedId, s.Name);
            var code = _feedService.NormalizeStopCode(feedId, s.Code ?? string.Empty);

            return new PlannerSearchResult
            {
                Name = name,
                Label = string.IsNullOrWhiteSpace(code) ? name : $"{name} ({feedId} {code}) -- {s.Desc}",
                Lat = s.Lat,
                Lon = s.Lon,
                Layer = "stop",
                StopId = s.GtfsId,
                StopCode = code
            };
        }).ToList();

        _cache.Set(cacheKey, stops, TimeSpan.FromHours(1));
        return stops;
    }
}
