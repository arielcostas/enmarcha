using Costasdev.Busurbano.Backend.Types;
using Costasdev.Busurbano.Backend.Types.Arrivals;
using Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;
using Costasdev.Busurbano.Sources.TranviasCoruna;
using Arrival = Costasdev.Busurbano.Backend.Types.Arrivals.Arrival;

namespace Costasdev.Busurbano.Backend.Services.Processors;

public class CorunaRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly CorunaRealtimeEstimatesProvider _realtime;
    private readonly FeedService _feedService;
    private readonly ILogger<CorunaRealTimeProcessor> _logger;
    private readonly ShapeTraversalService _shapeService;

    public CorunaRealTimeProcessor(
        HttpClient http,
        FeedService feedService,
        ILogger<CorunaRealTimeProcessor> logger,
        ShapeTraversalService shapeService)
    {
        _realtime = new CorunaRealtimeEstimatesProvider(http);
        _feedService = feedService;
        _logger = logger;
        _shapeService = shapeService;
    }

    public override async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("coruna:")) return;

        var normalizedCode = _feedService.NormalizeStopCode("coruna", context.StopCode);
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

            var realtime = await _realtime.GetEstimatesForStop(numericStopId);

            var usedTripIds = new HashSet<string>();
            var newArrivals = new List<Arrival>();

            foreach (var estimate in realtime)
            {
                var bestMatch = context.Arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.RouteIdInGtfs.Trim() == estimate.RouteId.Trim())
                    .Select(a =>
                    {
                        return new
                        {
                            Arrival = a,
                            TimeDiff = estimate.Minutes - a.Estimate.Minutes, // RealTime - Schedule
                            RouteMatch = true
                        };
                    })
                    .Where(x => x.RouteMatch) // Strict route matching
                    .Where(x => x.TimeDiff >= -7 && x.TimeDiff <= 75) // Allow 7m early (RealTime < Schedule) or 75m late (RealTime > Schedule)
                    .OrderBy(x => Math.Abs(x.TimeDiff)) // Best time fit
                    .FirstOrDefault();

                if (bestMatch == null)
                {
                    continue;
                }

                var arrival = bestMatch.Arrival;
                _logger.LogInformation("Matched Coruña real-time for line {Line}: {Scheduled}m -> {RealTime}m (diff: {Diff}m)",
                    arrival.Route.ShortName, arrival.Estimate.Minutes, estimate.Minutes, bestMatch.TimeDiff);

                var scheduledMinutes = arrival.Estimate.Minutes;
                arrival.Estimate.Minutes = estimate.Minutes;
                arrival.Estimate.Precision = ArrivalPrecision.Confident;

                // Calculate delay badge
                var delayMinutes = estimate.Minutes - scheduledMinutes;
                if (delayMinutes != 0)
                {
                    arrival.Delay = new DelayBadge { Minutes = delayMinutes };
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
                        var meters = Math.Max(0, estimate.Metres);
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
