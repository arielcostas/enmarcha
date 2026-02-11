using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Costasdev.VigoTransitApi;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Services.Processors;

public class VitrasaRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly VigoTransitApiClient _api;
    private readonly FeedService _feedService;
    private readonly ILogger<VitrasaRealTimeProcessor> _logger;
    private readonly ShapeTraversalService _shapeService;
    private readonly AppConfiguration _configuration;

    public VitrasaRealTimeProcessor(
        VigoTransitApiClient api,
        FeedService feedService,
        ILogger<VitrasaRealTimeProcessor> logger,
        ShapeTraversalService shapeService,
        IOptions<AppConfiguration> options)
    {
        _api = api;
        _feedService = feedService;
        _logger = logger;
        _shapeService = shapeService;
        _configuration = options.Value;
    }

    public override async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("vitrasa:")) return;

        var normalizedCode = _feedService.NormalizeStopCode("vitrasa", context.StopCode);
        if (!int.TryParse(normalizedCode, out var numericStopId)) return;

        try
        {
            // Load schedule
            var todayDate = context.NowLocal.Date.ToString("yyyy-MM-dd");

            Epsg25829? stopLocation = null;
            if (context.StopLocation != null)
            {
                stopLocation = _shapeService.TransformToEpsg25829(context.StopLocation.Latitude, context.StopLocation.Longitude);
            }

            var realtime = await _api.GetStopEstimates(numericStopId);
            var estimates = realtime.Estimates
                .Where(e => !string.IsNullOrWhiteSpace(e.Route) && !e.Route.Trim().EndsWith('*'))
                .ToList();

            System.Diagnostics.Activity.Current?.SetTag("realtime.count", estimates.Count);

            var usedTripIds = new HashSet<string>();
            var newArrivals = new List<Arrival>();

            foreach (var estimate in estimates)
            {
                var estimateRouteNormalized = _feedService.NormalizeRouteNameForMatching(estimate.Route);

                var bestMatch = context.Arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.ShortName.Trim() == estimate.Line.Trim())
                    .Select(a =>
                    {
                        // Use tripHeadsign from GTFS if available, otherwise fall back to stop-level headsign
                        string scheduleHeadsign = a.Headsign.Destination;
                        if (a.RawOtpTrip is ArrivalsAtStopResponse.Arrival otpArr && !string.IsNullOrWhiteSpace(otpArr.Trip.TripHeadsign))
                        {
                            scheduleHeadsign = otpArr.Trip.TripHeadsign;
                        }
                        var arrivalRouteNormalized = _feedService.NormalizeRouteNameForMatching(scheduleHeadsign);
                        string? arrivalLongNameNormalized = null;
                        string? arrivalLastStopNormalized = null;

                        if (a.RawOtpTrip is ArrivalsAtStopResponse.Arrival otpArrival)
                        {
                            if (otpArrival.Trip.Route.LongName != null)
                            {
                                arrivalLongNameNormalized = _feedService.NormalizeRouteNameForMatching(otpArrival.Trip.Route.LongName);
                            }

                            var lastStop = otpArrival.Trip.Stoptimes.LastOrDefault();
                            if (lastStop != null)
                            {
                                arrivalLastStopNormalized = _feedService.NormalizeRouteNameForMatching(lastStop.Stop.Name);
                            }
                        }

                        // Strict route matching logic ported from VitrasaTransitProvider
                        // Check against Headsign, LongName, and LastStop
                        var routeMatch = IsRouteMatch(estimateRouteNormalized, arrivalRouteNormalized);

                        if (!routeMatch && arrivalLongNameNormalized != null)
                        {
                            routeMatch = IsRouteMatch(estimateRouteNormalized, arrivalLongNameNormalized);
                        }

                        if (!routeMatch && arrivalLastStopNormalized != null)
                        {
                            routeMatch = IsRouteMatch(estimateRouteNormalized, arrivalLastStopNormalized);
                        }

                        return new
                        {
                            Arrival = a,
                            TimeDiff = estimate.Minutes - a.Estimate.Minutes, // RealTime - Schedule
                            RouteMatch = routeMatch
                        };
                    })
                    .Where(x => x.RouteMatch) // Strict route matching
                    .Where(x => x.TimeDiff >= -7 && x.TimeDiff <= 75) // Allow 7m early (RealTime < Schedule) or 75m late (RealTime > Schedule)
                    .OrderBy(x => Math.Abs(x.TimeDiff)) // Best time fit
                    .FirstOrDefault();

                if (bestMatch != null)
                {
                    var arrival = bestMatch.Arrival;

                    var scheduledMinutes = arrival.Estimate.Minutes;
                    arrival.Estimate.Minutes = estimate.Minutes;
                    arrival.Estimate.Precision = ArrivalPrecision.Confident;

                    // Calculate delay badge
                    var delayMinutes = estimate.Minutes - scheduledMinutes;
                    arrival.Delay = new DelayBadge { Minutes = delayMinutes };

                    string scheduledHeadsign = arrival.Headsign.Destination;
                    if (arrival.RawOtpTrip is ArrivalsAtStopResponse.Arrival otpArr && !string.IsNullOrWhiteSpace(otpArr.Trip.TripHeadsign))
                    {
                        scheduledHeadsign = otpArr.Trip.TripHeadsign;
                    }

                    _logger.LogDebug("Matched RT estimate: Line {Line}, RT: {RTRoute} ({RTMin}m), Scheduled: {ScheduledRoute} ({ScheduledMin}m), Delay: {Delay}m",
                        estimate.Line, estimate.Route, estimate.Minutes, scheduledHeadsign, scheduledMinutes, delayMinutes);

                    // Prefer real-time headsign UNLESS it's just the last stop name (which is less informative)
                    if (!string.IsNullOrWhiteSpace(estimate.Route))
                    {
                        bool isJustLastStop = false;

                        if (arrival.RawOtpTrip is ArrivalsAtStopResponse.Arrival otpArrival)
                        {
                            var lastStop = otpArrival.Trip.Stoptimes.LastOrDefault();
                            if (lastStop != null)
                            {
                                var arrivalLastStopNormalized = _feedService.NormalizeRouteNameForMatching(lastStop.Stop.Name);
                                isJustLastStop = estimateRouteNormalized == arrivalLastStopNormalized;
                            }
                        }

                        _logger.LogDebug("Headsign: RT='{RT}' vs Scheduled='{Scheduled}', IsJustLastStop={Last}, WillUseRT={Use}",
                            estimate.Route, scheduledHeadsign, isJustLastStop, !isJustLastStop);

                        // Use real-time headsign unless it's just the final stop name
                        if (!isJustLastStop)
                        {
                            arrival.Headsign.Destination = estimate.Route;
                        }
                    }

                    // Calculate position
                    if (stopLocation != null)
                    {
                        Position? currentPosition = null;
                        int? stopShapeIndex = null;

                        if (arrival.RawOtpTrip is ArrivalsAtStopResponse.Arrival otpArrival &&
                            otpArrival.Trip.Geometry?.Points != null)
                        {
                            var decodedPoints = Decode(otpArrival.Trip.Geometry.Points)
                                .Select(p => new Position { Latitude = p.Lat, Longitude = p.Lon })
                                .ToList();

                            var shape = _shapeService.CreateShapeFromWgs84(decodedPoints);

                            // Ensure meters is positive
                            var meters = Math.Max(0, estimate.Meters);
                            var result = _shapeService.GetBusPosition(shape, stopLocation, meters);

                            currentPosition = result.BusPosition;
                            stopShapeIndex = result.StopIndex;

                            // Populate Shape GeoJSON
                            if (!context.IsReduced && currentPosition != null)
                            {
                                var features = new List<object>
                                {
                                    new
                                    {
                                        type = "Feature",
                                        geometry = new
                                        {
                                            type = "LineString",
                                            coordinates = decodedPoints.Select(p => new[] { p.Longitude, p.Latitude }).ToList()
                                        },
                                        properties = new { type = "route" }
                                    }
                                };

                                // Add stops if available
                                if (otpArrival.Trip.Stoptimes != null)
                                {
                                    foreach (var stoptime in otpArrival.Trip.Stoptimes)
                                    {
                                        features.Add(new
                                        {
                                            type = "Feature",
                                            geometry = new
                                            {
                                                type = "Point",
                                                coordinates = new[] { stoptime.Stop.Lon, stoptime.Stop.Lat }
                                            },
                                            properties = new
                                            {
                                                type = "stop",
                                                name = stoptime.Stop.Name
                                            }
                                        });
                                    }
                                }

                                arrival.Shape = new
                                {
                                    type = "FeatureCollection",
                                    features = features
                                };
                            }
                        }

                        if (currentPosition != null)
                        {
                            arrival.CurrentPosition = currentPosition;
                            arrival.StopShapeIndex = stopShapeIndex;
                        }
                    }

                    usedTripIds.Add(arrival.TripId);
                }
                else
                {
                    _logger.LogInformation("Adding unmatched Vitrasa real-time arrival for line {Line} in {Minutes}m",
                        estimate.Line, estimate.Minutes);

                    // Try to find a "template" arrival with the same line to copy colors from
                    var template = context.Arrivals
                        .FirstOrDefault(a => a.Route.ShortName.Trim() == estimate.Line.Trim());

                    newArrivals.Add(new Arrival
                    {
                        TripId = $"vitrasa:rt:{estimate.Line}:{estimate.Route}:{estimate.Minutes}",
                        Route = new RouteInfo
                        {
                            GtfsId = $"vitrasa:{estimate.Line}",
                            ShortName = estimate.Line,
                            Colour = template?.Route.Colour ?? "FFFFFF",
                            TextColour = template?.Route.TextColour ?? "000000",
                        },
                        Headsign = new HeadsignInfo
                        {
                            Destination = estimate.Route
                        },
                        Estimate = new ArrivalDetails
                        {
                            Minutes = estimate.Minutes,
                            Precision = ArrivalPrecision.Confident
                        }
                    });
                }
            }

            context.Arrivals.AddRange(newArrivals);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Vitrasa real-time data for stop {StopId}", context.StopId);
        }
    }

    private static bool IsRouteMatch(string a, string b)
    {
        return a == b || a.Contains(b) || b.Contains(a);
    }
}
