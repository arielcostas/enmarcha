using System.Net;
using Costasdev.Busurbano.Backend.GraphClient;
using Costasdev.Busurbano.Backend.GraphClient.App;
using Costasdev.Busurbano.Backend.Services;
using Costasdev.Busurbano.Backend.Types.Arrivals;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Costasdev.Busurbano.Backend.Controllers;

[ApiController]
[Route("api/stops")]
public partial class ArrivalsController : ControllerBase
{
    private readonly ILogger<ArrivalsController> _logger;
    private readonly IMemoryCache _cache;
    private readonly HttpClient _httpClient;
    private readonly ArrivalsPipeline _pipeline;
    private readonly FeedService _feedService;

    public ArrivalsController(
        ILogger<ArrivalsController> logger,
        IMemoryCache cache,
        HttpClient httpClient,
        ArrivalsPipeline pipeline,
        FeedService feedService
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
        _pipeline = pipeline;
        _feedService = feedService;
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

        var request = new HttpRequestMessage(HttpMethod.Post, "http://100.67.54.115:3957/otp/gtfs/v1");
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
            if (item.PickupTypeParsed.Equals(ArrivalsAtStopResponse.PickupType.None))
            {
                continue;
            }

            if (item.Trip.Geometry?.Points != null)
            {
                _logger.LogDebug("Trip {TripId} has geometry", item.Trip.GtfsId);
            }

            // Calculate departure time using the service day in the feed's timezone (Europe/Madrid)
            // This ensures we treat ScheduledDepartureSeconds as relative to the local midnight of the service day
            var serviceDayLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(item.ServiceDay), tz);
            var departureTime = serviceDayLocal.Date.AddSeconds(item.ScheduledDepartureSeconds);

            var minutesToArrive = (int)(departureTime - nowLocal).TotalMinutes;
            //var isRunning = departureTime < nowLocal;

            // TODO: Handle this properly, since many times it's "tomorrow" but not handled properly
            if (minutesToArrive < ArrivalsAtStopContent.PastArrivalMinutesIncluded)
            {
                continue;
            }

            Arrival arrival = new()
            {
                TripId = item.Trip.GtfsId,
                Route = new RouteInfo
                {
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
            NowLocal = nowLocal
        });

        var feedId = id.Split(':')[0];

        return Ok(new StopArrivalsResponse
        {
            StopCode = _feedService.NormalizeStopCode(feedId, stop.Code),
            StopName = _feedService.NormalizeStopName(feedId, stop.Name),
            Arrivals = arrivals
        });
    }

    private static bool ShouldFetchPastArrivals(string id)
    {
        string feedId = id.Split(':', 2)[0];
        return feedId == "xunta";
    }

    [LoggerMessage(LogLevel.Error, "Error fetching stop data, received {statusCode} {responseBody}")]
    partial void LogErrorFetchingStopData(HttpStatusCode statusCode, string responseBody);
}
