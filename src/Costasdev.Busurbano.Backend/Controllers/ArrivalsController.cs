using System.Net;
using Costasdev.Busurbano.Backend.GraphClient;
using Costasdev.Busurbano.Backend.GraphClient.App;
using Costasdev.Busurbano.Backend.Types;
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

    public ArrivalsController(
        ILogger<ArrivalsController> logger,
        IMemoryCache cache,
        HttpClient httpClient
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
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

        var requestContent = ArrivalsAtStopContent.Query(new(id, reduced ? 4 : 10));
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
        List<Arrival> arrivals = [];
        foreach (var item in stop.Arrivals)
        {
            var departureTime = todayLocal.AddSeconds(item.ScheduledDepartureSeconds);
            var minutesToArrive = (int)(departureTime - nowLocal).TotalMinutes;
            //var isRunning = departureTime < nowLocal;

            Arrival arrival = new()
            {
                Route = new RouteInfo
                {
                    ShortName = item.Trip.RouteShortName,
                    Colour = item.Trip.Route.Color,
                    TextColour = item.Trip.Route.TextColor
                },
                Headsign = new HeadsignInfo
                {
                    Destination = item.Headsign
                },
                Estimate = new ArrivalDetails
                {
                    Minutes = minutesToArrive,
                    Precission = departureTime < nowLocal ? ArrivalPrecission.Past : ArrivalPrecission.Scheduled
                }
            };

            arrivals.Add(arrival);
        }

        return Ok(new StopArrivalsResponse
        {
            StopCode = stop.Code,
            StopName = stop.Name,
            Arrivals = arrivals
        });
    }

    [LoggerMessage(LogLevel.Error, "Error fetching stop data, received {statusCode} {responseBody}")]
    partial void LogErrorFetchingStopData(HttpStatusCode statusCode, string responseBody);
}
