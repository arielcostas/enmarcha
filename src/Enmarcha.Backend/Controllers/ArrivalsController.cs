using System.Net;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Enmarcha.Backend.Types.Schedule;
using FuzzySharp;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Globalization;

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
    private readonly OtpService _otpService;

    public ArrivalsController(
        ILogger<ArrivalsController> logger,
        IMemoryCache cache,
        HttpClient httpClient,
        ArrivalsPipeline pipeline,
        FeedService feedService,
        IOptions<AppConfiguration> configOptions,
        OtpService otpService
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
        _pipeline = pipeline;
        _feedService = feedService;
        _config = configOptions.Value;
        _otpService = otpService;
    }

    [HttpGet("arrivals")]
    public async Task<IActionResult> GetArrivals(
        [FromQuery] string id,
        [FromQuery] bool reduced
    )
    {
        using var activity = Telemetry.Source.StartActivity("GetArrivals");
        activity?.SetTag("stop.id", id);
        activity?.SetTag("reduced", reduced);

        var result = await FetchAndProcessArrivalsAsync(id, reduced, nano: false);
        if (result is null) return StatusCode(500, "Error fetching stop data");
        var (stop, context) = result.Value;

        var feedId = id.Split(':')[0];
        var timeThreshold = GetThresholdForFeed(id);
        var (fallbackColor, fallbackTextColor) = _feedService.GetFallbackColourForFeed(feedId);

        return Ok(new StopArrivalsResponse
        {
            StopCode = _feedService.NormalizeStopCode(feedId, stop.Code),
            StopName = FeedService.NormalizeStopName(feedId, stop.Name),
            StopLocation = new Position { Latitude = stop.Lat, Longitude = stop.Lon },
            Routes = [.. _feedService.ConsolidateRoutes(feedId,
                stop.Routes
                    .OrderBy(r => SortingHelper.GetRouteSortKey(r.ShortName, r.GtfsId))
                    .Select(r => new RouteInfo
                    {
                        GtfsId = r.GtfsId,
                        ShortName = _feedService.NormalizeRouteShortName(feedId, r.ShortName ?? ""),
                        Colour = r.Color ?? fallbackColor,
                        TextColour = r.TextColor is null or "000000" ?
                            ContrastHelper.GetBestTextColour(r.Color ?? fallbackColor) :
                            r.TextColor
                    }))],
            Arrivals = [.. context.Arrivals.Where(a => a.Estimate.Minutes >= timeThreshold)],
            Usage = context.Usage
        });
    }

    [HttpGet("estimates")]
    public async Task<IActionResult> GetEstimates(
        [FromQuery] string stop,
        [FromQuery] string route,
        [FromQuery] string? via
    )
    {
        if (string.IsNullOrWhiteSpace(stop) || string.IsNullOrWhiteSpace(route))
            return BadRequest("'stop' and 'route' are required.");

        using var activity = Telemetry.Source.StartActivity("GetEstimates");
        activity?.SetTag("stop.id", stop);
        activity?.SetTag("route.id", route);
        activity?.SetTag("via.id", via);

        var result = await FetchAndProcessArrivalsAsync(stop, reduced: false, nano: true);
        if (result is null) return StatusCode(500, "Error fetching stop data");
        var (_, context) = result.Value;

        // Annotate each arrival with its OTP pattern ID
        foreach (var arrival in context.Arrivals)
        {
            if (arrival.RawOtpTrip is ArrivalsAtStopResponse.Arrival otpArrival)
                arrival.PatternId = otpArrival.Trip.Pattern?.Id;
        }

        // Filter by route GTFS ID
        var timeThreshold = GetThresholdForFeed(stop);
        var filtered = context.Arrivals
            .Where(a => a.Route.GtfsId == route && a.Estimate.Minutes >= timeThreshold)
            .ToList();

        // Optionally filter by via stop: keep only trips whose remaining stoptimes include the via stop
        if (!string.IsNullOrWhiteSpace(via))
        {
            filtered = filtered.Where(a =>
            {
                if (a.RawOtpTrip is not ArrivalsAtStopResponse.Arrival otpArrival) return false;
                var stoptimes = otpArrival.Trip.Stoptimes;
                var originIdx = stoptimes.FindIndex(s => s.Stop.GtfsId == stop);
                var searchFrom = originIdx >= 0 ? originIdx + 1 : 0;
                return stoptimes.Skip(searchFrom).Any(s => s.Stop.GtfsId == via);
            }).ToList();
        }

        var estimates = filtered.Select(a => new ArrivalEstimate
        {
            TripId = a.TripId,
            PatternId = a.PatternId,
            Estimate = a.Estimate,
            Delay = a.Delay
        }).ToList();

        return Ok(new StopEstimatesResponse { Arrivals = estimates });
    }

    private static VehicleOperation GetVehicleOperation(
        ArrivalsAtStopResponse.Arrival item
    )
    {
        var pickup = item.PickupTypeParsed;
        var dropoff = item.DropoffTypeParsed;

        if (item.StopPosition == 0)
        {
            return VehicleOperation.Departure;
        }

        if (item.StopPosition == item.Trip.Stoptimes.Count - 1)
        {
            return VehicleOperation.Arrival;
        }

        if (pickup == ArrivalsAtStopResponse.PickupType.None && dropoff == ArrivalsAtStopResponse.PickupType.None) return VehicleOperation.PickupDropoff;
        if (pickup != ArrivalsAtStopResponse.PickupType.None && dropoff != ArrivalsAtStopResponse.PickupType.None) return VehicleOperation.PickupDropoff;
        if (pickup != ArrivalsAtStopResponse.PickupType.None) return VehicleOperation.PickupOnly;
        if (dropoff != ArrivalsAtStopResponse.PickupType.None) return VehicleOperation.DropoffOnly;
        return VehicleOperation.PickupDropoff;
    }

    private async Task<(ArrivalsAtStopResponse.StopItem Stop, ArrivalsContext Context)?> FetchAndProcessArrivalsAsync(
        string id, bool reduced, bool nano)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
        var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);

        var feedId = id.Split(':')[0];

        var requestContent = ArrivalsAtStopContent.Query(new ArrivalsAtStopContent.Args(id, reduced || nano));

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1")
        {
            Content = JsonContent.Create(new GraphClientRequest { Query = requestContent })
        };

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<ArrivalsAtStopResponse>>();

        if (responseBody is not { IsSuccess: true } || responseBody.Data?.Stop == null)
        {
            LogErrorFetchingStopData(response.StatusCode, await response.Content.ReadAsStringAsync());
            return null;
        }

        var stop = responseBody.Data.Stop;
        _logger.LogInformation("Fetched {Count} arrivals for stop {StopName} ({StopId})", stop.Arrivals.Count, stop.Name, id);

        List<Arrival> arrivals = [];
        foreach (var item in stop.Arrivals)
        {
            //if (item.PickupTypeParsed.Equals(ArrivalsAtStopResponse.PickupType.None)) continue;
            //if (
            //    item.Trip.ArrivalStoptime.Stop.GtfsId == id &&
            //    item.Trip.DepartureStoptime.Stop.GtfsId != id
            //) continue;

            // Delete loop routes that aren't starting here
            if (
                item.Trip.ArrivalStoptime.Stop.GtfsId == id &&
                item.Trip.DepartureStoptime.Stop.GtfsId == id &&
                item.StopPosition != 1
            )
            {
                continue;
            }

            var serviceDayLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(item.ServiceDay), tz);
            var departureTime = serviceDayLocal.Date.AddSeconds(item.ScheduledDepartureSeconds);
            var minutesToArrive = (int)(departureTime - nowLocal).TotalMinutes;

            arrivals.Add(new Arrival
            {
                TripId = item.Trip.GtfsId,
                Route = new RouteInfo
                {
                    GtfsId = item.Trip.Route.GtfsId,
                    ShortName = item.Trip.RouteShortName,
                    Colour = item.Trip.Route.Color ?? "FFFFFF",
                    TextColour = item.Trip.Route.TextColor ?? "000000"
                },
                Headsign = new HeadsignInfo { Destination = item.Trip.TripHeadsign ?? item.Headsign },
                Estimate = new ArrivalDetails
                {
                    Minutes = minutesToArrive,
                    Precision = departureTime < nowLocal.AddMinutes(-1) ? ArrivalPrecision.Past : ArrivalPrecision.Scheduled
                },
                Operator = feedId == "xunta" ? item.Trip.Route.Agency?.Name : null,
                RawOtpTrip = item,
                Operation = GetVehicleOperation(item)
            });
        }

        var context = new ArrivalsContext
        {
            StopId = id,
            StopCode = stop.Code,
            IsReduced = reduced,
            IsNano = nano,
            Arrivals = arrivals,
            Routes = responseBody.Data.Stop.Routes,
            NowLocal = nowLocal,
            StopLocation = new Position { Latitude = stop.Lat, Longitude = stop.Lon }
        };

        await _pipeline.ExecuteAsync(context);

        return (stop, context);
    }

    private static int GetThresholdForFeed(string id)
    {
        string feedId = id.Split(':', 2)[0];

        if (feedId is "vitrasa" or "tranvias")
        {
            return 0;
        }

        if (feedId is "tussa" or "ourense" or "lugo")
        {
            return -5;
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

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1")
        {
            Content = JsonContent.Create(new GraphClientRequest
            {
                Query = requestContent
            })
        };

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopsInfoResponse>>();

        if (responseBody is not { IsSuccess: true } || responseBody.Data?.Stops == null)
        {
            return StatusCode(500, "Error fetching stops data");
        }

        // TODO: Remove stops that are null, since that means the feed publisher deleted them.
        var result = responseBody.Data.Stops
            .Where(s => s != null)
            .ToDictionary(
            s => s!.GtfsId,
            s =>
            {
                var feedId = s!.GtfsId.Split(':', 2)[0];
                var (fallbackColor, _) = _feedService.GetFallbackColourForFeed(feedId);

                return new
                {
                    id = s.GtfsId,
                    code = _feedService.NormalizeStopCode(feedId, s.Code ?? ""),
                    name = s.Name,
                    routes = _feedService.ConsolidateRoutes(feedId,
                        s.Routes
                            .OrderBy(r => r.ShortName, Comparer<string?>.Create(SortingHelper.SortRouteShortNames))
                            .Select(r => new RouteInfo
                            {
                                GtfsId = r.GtfsId,
                                ShortName = _feedService.NormalizeRouteShortName(feedId, r.ShortName ?? ""),
                                Colour = r.Color ?? fallbackColor,
                                TextColour = r.TextColor is null or "000000" ?
                                    ContrastHelper.GetBestTextColour(r.Color ?? fallbackColor) :
                                    r.TextColor
                            }))
                        .Select(r => new
                        {
                            shortName = r.ShortName,
                            colour = r.Colour,
                            textColour = r.TextColour
                        })
                        .ToList()
                };
            }
        );

        return Ok(result);
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchStops([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(new List<object>());
        }

        const string cacheKey = "arrivals_search_mapped_stops";
        if (!_cache.TryGetValue(cacheKey, out List<dynamic>? allStops) || allStops == null)
        {
            var allStopsRaw = await _otpService.GetStopsByBboxAsync(-9.3, 41.7, -6.7, 43.8);

            allStops = allStopsRaw.Select(s =>
            {
                var feedId = s.GtfsId.Split(':', 2)[0];
                var (fallbackColor, _) = _feedService.GetFallbackColourForFeed(feedId);
                var code = _feedService.NormalizeStopCode(feedId, s.Code ?? "");
                var name = FeedService.NormalizeStopName(feedId, s.Name);

                return (dynamic)new
                {
                    stopId = s.GtfsId,
                    stopCode = code,
                    name = name,
                    latitude = s.Lat,
                    longitude = s.Lon,
                    lines = _feedService.ConsolidateRoutes(feedId,
                        (s.Routes ?? [])
                            .OrderBy(r => r.ShortName, Comparer<string?>.Create(SortingHelper.SortRouteShortNames))
                            .Select(r => new RouteInfo
                            {
                                GtfsId = r.GtfsId,
                                ShortName = _feedService.NormalizeRouteShortName(feedId, r.ShortName ?? ""),
                                Colour = r.Color ?? fallbackColor,
                                TextColour = r.TextColor is null or "000000" ?
                                    ContrastHelper.GetBestTextColour(r.Color ?? fallbackColor) :
                                    r.TextColor
                            }))
                        .Select(r => new
                        {
                            line = r.ShortName,
                            colour = r.Colour,
                            textColour = r.TextColour
                        })
                        .ToList(),
                    label = string.IsNullOrWhiteSpace(code) ? name : $"{name} ({code})"
                };
            }).ToList();

            _cache.Set(cacheKey, allStops, TimeSpan.FromHours(1));
        }

        // 1. Exact or prefix matches by stop code
        var codeMatches = allStops
            .Where(s => s.stopCode != null && ((string)s.stopCode).StartsWith(q, StringComparison.OrdinalIgnoreCase))
            .OrderBy(s => ((string)s.stopCode).Length)
            .Take(10)
            .ToList();

        // 2. Fuzzy search stops by label
        var fuzzyResults = Process.ExtractSorted(
            q,
            allStops.Select(s => (string)s.label),
            cutoff: 60
        ).Take(15).Select(r => allStops[r.Index]).ToList();

        // Combine and deduplicate
        var results = codeMatches.Concat(fuzzyResults)
            .GroupBy(s => s.stopId)
            .Select(g => g.First())
            .Take(20)
            .ToList();

        return Ok(results);
    }

    [LoggerMessage(LogLevel.Error, "Error fetching stop data, received {statusCode} {responseBody}")]
    partial void LogErrorFetchingStopData(HttpStatusCode statusCode, string responseBody);

    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule(
        [FromQuery] string id,
        [FromQuery] string? date
    )
    {
        using var activity = Telemetry.Source.StartActivity("GetSchedule");
        activity?.SetTag("stop.id", id);

        if (string.IsNullOrWhiteSpace(id))
            return BadRequest("'id' is required.");

        string serviceDate;
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
                return BadRequest("Invalid date. Use yyyy-MM-dd.");

            serviceDate = parsedDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        }
        else
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
            var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);
            serviceDate = nowLocal.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        }

        var cacheKey = $"stop_schedule_{id}_{serviceDate}";
        if (_cache.TryGetValue(cacheKey, out StopScheduleResponse? cached) && cached != null)
            return Ok(cached);

        var rawStop = await GetStopScheduleFromOtpAsync(id, serviceDate);
        if (rawStop == null)
            return StatusCode(500, "Error fetching stop schedule from OTP");

        var feedId = id.Split(':')[0];
        var (fallbackColor, fallbackTextColor) = _feedService.GetFallbackColourForFeed(feedId);
        var showOperator = feedId == "xunta";

        var trips = rawStop.StoptimesForServiceDate
            .Where(p => p.Stoptimes.Count > 0)
            .SelectMany(p =>
            {
                var color = !string.IsNullOrWhiteSpace(p.Pattern.Route.Color) ? p.Pattern.Route.Color : fallbackColor;
                var textColor = p.Pattern.Route.TextColor is null or "000000"
                    ? ContrastHelper.GetBestTextColour(color)
                    : p.Pattern.Route.TextColor;
                var shortName = _feedService.NormalizeRouteShortName(feedId, p.Pattern.Route.ShortName ?? "");

                return p.Stoptimes.Select(s => new ScheduledTripDto
                {
                    ScheduledDeparture = s.ScheduledDepartureSeconds,
                    RouteId = p.Pattern.Route.GtfsId,
                    RouteShortName = shortName,
                    RouteColor = color,
                    RouteTextColor = textColor,
                    Headsign = s.Trip?.TripHeadsign ?? p.Pattern.Headsign,
                    OriginStop = s.Trip?.DepartureStoptime?.Stop?.Name,
                    DestinationStop = s.Trip?.ArrivalStoptime?.Stop?.Name,
                    Operator = showOperator ? s.Trip?.Route?.Agency?.Name : null,
                    PickupType = s.PickupType,
                    DropOffType = s.DropoffType,
                    IsFirstStop = s.Trip?.DepartureStoptime?.Stop?.GtfsId == id,
                    IsLastStop = s.Trip?.ArrivalStoptime?.Stop?.GtfsId == id
                });
            })
            .OrderBy(t => t.ScheduledDeparture)
            .ToList();

        var result = new StopScheduleResponse
        {
            StopCode = _feedService.NormalizeStopCode(feedId, rawStop.Code),
            StopName = FeedService.NormalizeStopName(feedId, rawStop.Name),
            StopLocation = new Position { Latitude = rawStop.Lat, Longitude = rawStop.Lon },
            Trips = trips
        };

        var tz2 = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
        var todayKey = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz2).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var cacheDuration = serviceDate == todayKey ? TimeSpan.FromHours(1) : TimeSpan.FromHours(6);
        _cache.Set(cacheKey, result, cacheDuration);

        return Ok(result);
    }

    private async Task<StopScheduleOtpResponse.StopItem?> GetStopScheduleFromOtpAsync(string id, string serviceDate)
    {
        var query = StopScheduleContent.Query(new StopScheduleContent.Args(id, serviceDate));
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1")
        {
            Content = JsonContent.Create(new GraphClientRequest { Query = query })
        };

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopScheduleOtpResponse>>();

        if (responseBody is not { IsSuccess: true } || responseBody.Data?.Stop == null)
        {
            LogErrorFetchingStopData(response.StatusCode, await response.Content.ReadAsStringAsync());
            return null;
        }

        return responseBody.Data.Stop;
    }
}
