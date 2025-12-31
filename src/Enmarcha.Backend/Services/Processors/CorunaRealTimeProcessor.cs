using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Sources.TranviasCoruna;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Arrival = Enmarcha.Backend.Types.Arrivals.Arrival;

namespace Enmarcha.Backend.Services.Processors;

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
        if (!context.StopId.StartsWith("tranvias:")) return;

        var normalizedCode = _feedService.NormalizeStopCode("tranvias", context.StopCode);
        if (!int.TryParse(normalizedCode, out var numericStopId)) return;

        try
        {
            Epsg25829? stopLocation = null;
            if (context.StopLocation != null)
            {
                stopLocation =
                    _shapeService.TransformToEpsg25829(context.StopLocation.Latitude, context.StopLocation.Longitude);
            }

            var realtime = await _realtime.GetEstimatesForStop(numericStopId);

            var usedTripIds = new HashSet<string>();

            foreach (var estimate in realtime)
            {
                var bestMatch = context.Arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.RouteIdInGtfs.Trim() == estimate.RouteId.Trim())
                    .Select(a => new
                    {
                        Arrival = a,
                        TimeDiff = estimate.Minutes - a.Estimate.Minutes, // RealTime - Schedule
                        RouteMatch = true
                    })
                    .Where(x => x.RouteMatch) // Strict route matching
                    .Where(x => x.TimeDiff is >= -5
                        and <= 15) // Allow 5m early (RealTime < Schedule) or 15m late (RealTime > Schedule)
                    .OrderBy(x => x.TimeDiff < 0 ? Math.Abs(x.TimeDiff) * 2 : x.TimeDiff) // Best time fit
                    .FirstOrDefault();

                if (bestMatch == null)
                {
                    continue;
                }

                var arrival = bestMatch.Arrival;

                var scheduledMinutes = arrival.Estimate.Minutes;
                arrival.Estimate.Minutes = estimate.Minutes;
                arrival.Estimate.Precision = ArrivalPrecision.Confident;

                // Calculate delay badge
                var delayMinutes = estimate.Minutes - scheduledMinutes;
                if (delayMinutes != 0)
                {
                    arrival.Delay = new DelayBadge { Minutes = delayMinutes };
                }

                // Populate vehicle information
                var busInfo = GetBusInfoByNumber(estimate.VehicleNumber);
                arrival.VehicleInformation = new VehicleBadge
                {
                    Identifier = estimate.VehicleNumber,
                    Make = busInfo?.Make,
                    Model = busInfo?.Model,
                    Kind = busInfo?.Kind,
                    Year = busInfo?.Year
                };

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
                            _logger.LogInformation(
                                "Calculated position from OTP geometry for trip {TripId}: {Lat}, {Lon}", arrival.TripId,
                                currentPosition.Latitude, currentPosition.Longitude);
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
                                features
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Tranvías real-time data for stop {StopId}", context.StopId);
        }
    }

    private static bool IsRouteMatch(string a, string b)
    {
        return a == b || a.Contains(b) || b.Contains(a);
    }

    private (string Make, string Model, string Kind, string Year)? GetBusInfoByNumber(string identifier)
    {
        int number = int.Parse(identifier);

        return number switch
        {
            // 2000
            >= 326 and <= 336 => ("MB", "O405N2 Venus", "RIG", "2000"),
            337 => ("MB", "O405G Alce", "ART", "2000"),
            // 2002-2003
            >= 340 and <= 344 => ("MAN", "NG313F Delfos Venus", "ART", "2002"),
            >= 345 and <= 347 => ("MAN", "NG313F Delfos Venus", "ART", "2003"),
            // 2004
            >= 348 and <= 349 => ("MAN", "NG313F Delfos Venus", "ART", "2004"),
            >= 350 and <= 355 => ("MAN", "NL263F Luxor II", "RIG", "2004"),
            // 2005
            >= 356 and <= 359 => ("MAN", "NL263F Luxor II", "RIG", "2005"),
            >= 360 and <= 362 => ("MAN", "NG313F Delfos", "ART", "2005"),
            // 2007
            >= 363 and <= 370 => ("MAN", "NL273F Luxor II", "RIG", "2007"),
            // 2008
            >= 371 and <= 377 => ("MAN", "NL273F Luxor II", "RIG", "2008"),
            // 2009
            >= 378 and <= 387 => ("MAN", "NL273F Luxor II", "RIG", "2009"),
            // 2012
            >= 388 and <= 392 => ("MAN", "NL283F Ceres", "RIG", "2012"),
            >= 393 and <= 395 => ("MAN", "NG323F Ceres", "ART", "2012"),
            // 2013
            >= 396 and <= 403 => ("MAN", "NL283F Ceres", "RIG", "2013"),
            // 2014
            >= 404 and <= 407 => ("MB", "Citaro C2", "RIG", "2014"),
            >= 408 and <= 411 => ("MAN", "NL283F Ceres", "RIG", "2014"),
            // 2015
            >= 412 and <= 414 => ("MB", "Citaro C2 G", "ART", "2015"),
            >= 415 and <= 419 => ("MB", "Citaro C2", "RIG", "2015"),
            // 2016
            >= 420 and <= 427 => ("MB", "Citaro C2", "RIG", "2016"),
            // 2024
            428 => ("MAN", "Lion's City 12 E", "RIG", "2024"),
            // 2025
            429 => ("MAN", "Lion's City 18", "RIG", "2025"),
            >= 430 and <= 432 => ("MAN", "Lion's City 12", "RIG", "2025"),
            _ => null
        };
    }
}
