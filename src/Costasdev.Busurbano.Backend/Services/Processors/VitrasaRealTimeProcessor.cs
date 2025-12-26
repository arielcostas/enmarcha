using Costasdev.Busurbano.Backend.Configuration;
using Costasdev.Busurbano.Backend.Types;
using Costasdev.Busurbano.Backend.Types.Arrivals;
using Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;
using Costasdev.VigoTransitApi;
using Microsoft.Extensions.Options;

namespace Costasdev.Busurbano.Backend.Services.Processors;

public class VitrasaRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly VigoTransitApiClient _api;
    private readonly FeedService _feedService;
    private readonly ILogger<VitrasaRealTimeProcessor> _logger;
    private readonly ShapeTraversalService _shapeService;
    private readonly AppConfiguration _configuration;

    public VitrasaRealTimeProcessor(
        HttpClient http,
        FeedService feedService,
        ILogger<VitrasaRealTimeProcessor> logger,
        ShapeTraversalService shapeService,
        IOptions<AppConfiguration> options)
    {
        _api = new VigoTransitApiClient(http);
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
                        var arrivalRouteNormalized = _feedService.NormalizeRouteNameForMatching(a.Headsign.Destination);
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
                    _logger.LogInformation("Matched Vitrasa real-time for line {Line}: {Scheduled}m -> {RealTime}m (diff: {Diff}m)",
                        arrival.Route.ShortName, arrival.Estimate.Minutes, estimate.Minutes, bestMatch.TimeDiff);

                    var scheduledMinutes = arrival.Estimate.Minutes;
                    arrival.Estimate.Minutes = estimate.Minutes;
                    arrival.Estimate.Precision = ArrivalPrecision.Confident;

                    // Calculate delay badge
                    var delayMinutes = estimate.Minutes - scheduledMinutes;
                    arrival.Delay = new DelayBadge { Minutes = delayMinutes };

                    // Prefer real-time headsign if available and different
                    if (!string.IsNullOrWhiteSpace(estimate.Route))
                    {
                        arrival.Headsign.Destination = estimate.Route;
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

                            if (currentPosition != null)
                            {
                                _logger.LogInformation("Calculated position from OTP geometry for trip {TripId}: {Lat}, {Lon}", arrival.TripId, currentPosition.Latitude, currentPosition.Longitude);
                            }

                            // Populate Shape GeoJSON
                            if (!context.IsReduced && currentPosition != null)
                            {
                                var features = new List<object>();
                                features.Add(new
                                {
                                    type = "Feature",
                                    geometry = new
                                    {
                                        type = "LineString",
                                        coordinates = decodedPoints.Select(p => new[] { p.Longitude, p.Latitude }).ToList()
                                    },
                                    properties = new { type = "route" }
                                });

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
