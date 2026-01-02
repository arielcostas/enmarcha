using System.Net;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api/stops")]
public partial class ArrivalsController : ControllerBase
{
    private readonly ILogger<ArrivalsController> _logger;
    private readonly IMemoryCache _cache;
    private readonly HttpClient _httpClient;
    private readonly ArrivalsPipeline _pipeline;
    private readonly FeedService _feedService;
    private readonly AppConfiguration _config;

    public ArrivalsController(
        ILogger<ArrivalsController> logger,
        IMemoryCache cache,
        HttpClient httpClient,
        ArrivalsPipeline pipeline,
        FeedService feedService,
        IOptions<AppConfiguration> configOptions
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
        _pipeline = pipeline;
        _feedService = feedService;
        _config = configOptions.Value;
    }

    [HttpGet("arrivals")]
    public async Task<IActionResult> GetArrivals(
        [FromQuery] string id,
        [FromQuery] bool reduced
    )
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
        var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);
        var todayLocal = nowLocal.Date;

        var requestContent = ArrivalsAtStopContent.Query(
            new ArrivalsAtStopContent.Args(id, reduced)
        );

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = requestContent
        });

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<ArrivalsAtStopResponse>>();

        if (responseBody is not { IsSuccess: true } || responseBody.Data?.Stop == null)
        {
            LogErrorFetchingStopData(response.StatusCode, await response.Content.ReadAsStringAsync());
            return StatusCode(500, "Error fetching stop data");
        }

        var stop = responseBody.Data.Stop;
        _logger.LogInformation("Fetched {Count} arrivals for stop {StopName} ({StopId})", stop.Arrivals.Count, stop.Name, id);

        List<Arrival> arrivals = [];
        foreach (var item in stop.Arrivals)
        {
            // Discard trip without pickup at stop
            if (item.PickupTypeParsed.Equals(ArrivalsAtStopResponse.PickupType.None))
            {
                continue;
            }

            // Discard on last stop
            if (item.Trip.ArrivalStoptime.Stop.GtfsId == id)
            {
                continue;
            }

            // Calculate departure time using the service day in the feed's timezone (Europe/Madrid)
            // This ensures we treat ScheduledDepartureSeconds as relative to the local midnight of the service day
            var serviceDayLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(item.ServiceDay), tz);
            var departureTime = serviceDayLocal.Date.AddSeconds(item.ScheduledDepartureSeconds);

            var minutesToArrive = (int)(departureTime - nowLocal).TotalMinutes;
            //var isRunning = departureTime < nowLocal;

            Arrival arrival = new()
            {
                TripId = item.Trip.GtfsId,
                Route = new RouteInfo
                {
                    GtfsId = item.Trip.Route.GtfsId,
                    ShortName = item.Trip.RouteShortName,
                    Colour = item.Trip.Route.Color ?? "FFFFFF",
                    TextColour = item.Trip.Route.TextColor ?? "000000"
                },
                Headsign = new HeadsignInfo
                {
                    Destination = item.Headsign
                },
                Estimate = new ArrivalDetails
                {
                    Minutes = minutesToArrive,
                    Precision = departureTime < nowLocal.AddMinutes(-1) ? ArrivalPrecision.Past : ArrivalPrecision.Scheduled
                },
                RawOtpTrip = item
            };

            arrivals.Add(arrival);
        }

        await _pipeline.ExecuteAsync(new ArrivalsContext
        {
            StopId = id,
            StopCode = stop.Code,
            IsReduced = reduced,
            Arrivals = arrivals,
            NowLocal = nowLocal,
            StopLocation = new Position { Latitude = stop.Lat, Longitude = stop.Lon }
        });

        var feedId = id.Split(':')[0];

        // Time after an arrival's time to still include it in the response. This is useful without real-time data, for delayed buses.
        var timeThreshold = GetThresholdForFeed(id);

        var (fallbackColor, fallbackTextColor) = _feedService.GetFallbackColourForFeed(feedId);

        return Ok(new StopArrivalsResponse
        {
            StopCode = _feedService.NormalizeStopCode(feedId, stop.Code),
            StopName = _feedService.NormalizeStopName(feedId, stop.Name),
            StopLocation = new Position
            {
                Latitude = stop.Lat,
                Longitude = stop.Lon
            },
            Routes = [.. stop.Routes
                .OrderBy(
                    r => r.ShortName,
                    Comparer<string?>.Create(SortingHelper.SortRouteShortNames)
                )
                .Select(r => new RouteInfo
                {
                    GtfsId = r.GtfsId,
                    ShortName = _feedService.NormalizeRouteShortName(feedId, r.ShortName ?? ""),
                    Colour = r.Color ?? fallbackColor,
                    TextColour = r.TextColor is null or "000000" ?
                        ContrastHelper.GetBestTextColour(r.Color ?? fallbackColor) :
                        r.TextColor
                })],
            Arrivals = [.. arrivals.Where(a => a.Estimate.Minutes >= timeThreshold)]
        });

    }

    private static int GetThresholdForFeed(string id)
    {
        string feedId = id.Split(':', 2)[0];

        if (feedId is "vitrasa" or "tranvias" or "tussa")
        {
            return 0;
        }

        return -30;
    }

    [HttpGet]
    public async Task<IActionResult> GetStops([FromQuery] string ids)
    {
        if (string.IsNullOrWhiteSpace(ids))
        {
            return BadRequest("Ids parameter is required");
        }

        var stopIds = ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var requestContent = StopsInfoContent.Query(new StopsInfoContent.Args(stopIds));

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = requestContent
        });

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopsInfoResponse>>();

        if (responseBody is not { IsSuccess: true } || responseBody.Data?.Stops == null)
        {
            return StatusCode(500, "Error fetching stops data");
        }

        var result = responseBody.Data.Stops.ToDictionary(
            s => s.GtfsId,
            s =>
            {
                var feedId = s.GtfsId.Split(':', 2)[0];
                var (fallbackColor, _) = _feedService.GetFallbackColourForFeed(feedId);

                return new
                {
                    id = s.GtfsId,
                    code = _feedService.NormalizeStopCode(feedId, s.Code ?? ""),
                    name = s.Name,
                    routes = s.Routes
                        .OrderBy(r => r.ShortName, Comparer<string?>.Create(SortingHelper.SortRouteShortNames))
                        .Select(r => new
                        {
                            shortName = _feedService.NormalizeRouteShortName(feedId, r.ShortName ?? ""),
                            colour = r.Color ?? fallbackColor,
                            textColour = r.TextColor is null or "000000" ?
                                ContrastHelper.GetBestTextColour(r.Color ?? fallbackColor) :
                                r.TextColor
                        })
                        .ToList()
                };
            }
        );

        return Ok(result);
    }

    [HttpGet("search")]
    public IActionResult SearchStops([FromQuery] string q)
    {
        // Placeholder for future implementation with Postgres and fuzzy searching
        return Ok(new List<object>());
    }

    [LoggerMessage(LogLevel.Error, "Error fetching stop data, received {statusCode} {responseBody}")]
    partial void LogErrorFetchingStopData(HttpStatusCode statusCode, string responseBody);
}
