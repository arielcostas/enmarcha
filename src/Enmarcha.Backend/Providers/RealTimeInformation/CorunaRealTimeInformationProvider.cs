using Enmarcha.Backend.Dto;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using HeadsignInfo = Enmarcha.Backend.Dto.HeadsignInfo;
using RouteInfo = Enmarcha.Backend.Dto.RouteInfo;
using StopArrivalsResponse = Enmarcha.Sources.OpenTripPlannerGql.Queries.V2.StopArrivalsResponse;
using VehicleOperation = Enmarcha.Backend.Dto.VehicleOperation;
using Enmarcha.Sources.TranviasCoruna;

namespace Enmarcha.Backend.Providers.RealTimeInformation;

public class CorunaRealTimeInformationProvider : IRealTimeInformationProvider
{
    private readonly CorunaRealtimeEstimatesProvider _realtime;
    private readonly ILogger<CorunaRealTimeInformationProvider> _logger;
    private readonly ShapeTraversalService _shapeService;

    public CorunaRealTimeInformationProvider(
        CorunaRealtimeEstimatesProvider realtime,
        ILogger<CorunaRealTimeInformationProvider> logger,
        ShapeTraversalService shapeService
    )
    {
        _realtime = realtime;
        _logger = logger;
        _shapeService = shapeService;
    }

    public async Task<(List<StopEstimate> arrivals, IEnumerable<DataSource>? dataSources)> ApplyRealtimeInformation(
        StopArrivalsResponse.StopItem stop,
        List<StopEstimate> arrivals
    )
    {
        if (!int.TryParse(stop.Code, out var numericStopId))
        {
            return (arrivals, null);
        }

        try
        {
            Epsg25829? stopLocation = _shapeService.TransformToEpsg25829(stop.Lat, stop.Lon);

            var realtime = await _realtime.GetEstimatesForStop(numericStopId);
            System.Diagnostics.Activity.Current?.SetTag("realtime.count", realtime.Count);

            var usedTripIds = new HashSet<string>();
            var newArrivals = new List<StopEstimate>();
            // TODO: Use context.Routes too, since that will contain routes that may not have any trips
            var routeTemplates = arrivals
                .GroupBy(a => a.Route.RouteIdInGtfs.Trim())
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var estimate in realtime)
            {
                var bestMatch = arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.RouteIdInGtfs.Trim() == estimate.RouteId.Trim())
                    .Where(a => a.Operation != VehicleOperation.Arrival)
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
                    var goodEnoughMatch = arrivals
                        .Where(a => !usedTripIds.Contains(a.TripId))
                        .Where(a => a.Route.RouteIdInGtfs.Trim() == estimate.RouteId.Trim())
                        .Where(a => a.Operation != VehicleOperation.Arrival)
                        .Select(a => new
                        {
                            Arrival = a,
                            TimeDiff = estimate.Minutes - a.Estimate.Minutes, // RealTime - Schedule
                            RouteMatch = true
                        })
                        .Where(x => x.RouteMatch) // Strict route matching
                        .Where(x => x.TimeDiff is >= -10
                            and <= 25) // Allow 10m early (RealTime < Schedule) or 25m late (RealTime > Schedule)
                        .OrderBy(x => x.TimeDiff < 0 ? Math.Abs(x.TimeDiff) * 2 : x.TimeDiff) // Best time fit
                        .FirstOrDefault();

                    if (goodEnoughMatch != null)
                    {
                        bestMatch = goodEnoughMatch;
                        _logger.LogInformation(
                            "Using good enough match for trip {TripId} with time difference of {TimeDiff} minutes",
                            bestMatch.Arrival.TripId, bestMatch.TimeDiff);
                    }
                }

                // TODO: Ñapa, de algún modo no debería haber dos veces el mismo IF
                if (bestMatch == null)
                {
                    routeTemplates.TryGetValue(estimate.RouteId.Trim(), out var template);

                    var templateBusInfo = GetBusInfoByNumber(estimate.VehicleNumber);
                    newArrivals.Add(new StopEstimate
                    {
                        TripId = $"tranvias:rtonly_{estimate.RouteId}_{estimate.VehicleNumber}",
                        RealTimeOnly = true,
                        Route = new RouteInfo
                        {
                            GtfsId = template?.Route.GtfsId ?? $"tranvias:{estimate.RouteId}",
                            OriginalShortName = template?.Route.ShortName ?? estimate.RouteId,
                            ShortName = template?.Route.ShortName ?? estimate.RouteId,
                            Colour = template?.Route.Colour ?? "FFFFFF",
                            TextColour = template?.Route.TextColour ?? "000000"
                        },
                        Headsign = new HeadsignInfo
                        {
                            Destination = template?.Headsign.Destination ?? $"Línea {estimate.RouteId}"
                        },
                        Estimate = new EstimateDetails
                        {
                            Minutes = estimate.Minutes,
                            Confidence = ArrivalConfidence.RealtimeCirculating
                        },
                        VehicleInformation = new VehicleInformation
                        {
                            CompanyNumber = estimate.VehicleNumber,
                            Make = templateBusInfo?.Make,
                            Model = templateBusInfo?.Model,
                            Year = templateBusInfo?.Year
                        }
                    });
                    continue;
                }

                var arrival = bestMatch.Arrival;

                var scheduledMinutes = arrival.Estimate.Minutes;
                arrival.Estimate.Minutes = estimate.Minutes;
                arrival.Estimate.DelayMinutes = estimate.Minutes - scheduledMinutes;
                arrival.Estimate.Confidence =
                    arrival.RawOtpArrival?.Trip.DepartureStoptime.ScheduledDeparture -
                    DateTime.UtcNow.TimeOfDay.TotalSeconds > 0
                        ? ArrivalConfidence.RealtimeCirculating
                        : ArrivalConfidence.RealtimeBeforeDeparture;

                // Populate vehicle information
                var busInfo = GetBusInfoByNumber(estimate.VehicleNumber);
                arrival.VehicleInformation = new VehicleInformation
                {
                    CompanyNumber = estimate.VehicleNumber,
                    Make = busInfo?.Make,
                    Model = busInfo?.Model,
                    Year = busInfo?.Year
                };

                // Calculate position
                if (stopLocation != null)
                {
                    Position? currentPosition = null;

                    if (arrival.RawOtpArrival is { Trip.Geometry.Points: not null } otpArrival)
                    {
                        var decodedPoints = ShapeDecoder.Decode(otpArrival.Trip.Geometry.Points)
                            .Select(p => new Position { Latitude = p.Lat, Longitude = p.Lon })
                            .ToList();

                        var shape = _shapeService.CreateShapeFromWgs84(decodedPoints);

                        // Ensure meters is positive
                        var meters = Math.Max(0, estimate.Metres);
                        var result = _shapeService.GetBusPosition(shape, stopLocation, meters);

                        currentPosition = result.BusPosition;

                        if (currentPosition != null)
                        {
                            _logger.LogInformation(
                                "Calculated position from OTP geometry for trip {TripId}: {Lat}, {Lon}", arrival.TripId,
                                currentPosition.Latitude, currentPosition.Longitude);
                        }
                    }

                    if (currentPosition != null)
                    {
                        arrival.CurrentPosition = currentPosition;
                    }
                }

                usedTripIds.Add(arrival.TripId);
            }

            arrivals.AddRange(newArrivals);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Tranvías real-time data for stop {Stop}", stop.Code);
        }

        return (arrivals, null);
    }

    private static bool IsRouteMatch(string a, string b)
    {
        return a == b || a.Contains(b) || b.Contains(a);
    }

    private (string Make, string Model, string Year)? GetBusInfoByNumber(string identifier)
    {
        int number = int.Parse(identifier);

        return number switch
        {
            // 2000
            >= 326 and <= 336 => ("MB", "O405N2 Venus", "2000"),
            337 => ("MB", "O405G Alce", "2000"),
            // 2002-2003
            >= 340 and <= 344 => ("MAN", "NG313F Delfos Venus", "2002"),
            >= 345 and <= 347 => ("MAN", "NG313F Delfos Venus", "2003"),
            // 2004
            >= 348 and <= 349 => ("MAN", "NG313F Delfos Venus", "2004"),
            >= 350 and <= 355 => ("MAN", "NL263F Luxor II", "2004"),
            // 2005
            >= 356 and <= 359 => ("MAN", "NL263F Luxor II", "2005"),
            >= 360 and <= 362 => ("MAN", "NG313F Delfos", "2005"),
            // 2007
            >= 363 and <= 370 => ("MAN", "NL273F Luxor II", "2007"),
            // 2008
            >= 371 and <= 377 => ("MAN", "NL273F Luxor II", "2008"),
            // 2009
            >= 378 and <= 387 => ("MAN", "NL273F Luxor II", "2009"),
            // 2012
            >= 388 and <= 392 => ("MAN", "NL283F Ceres", "2012"),
            >= 393 and <= 395 => ("MAN", "NG323F Ceres", "2012"),
            // 2013
            >= 396 and <= 403 => ("MAN", "NL283F Ceres", "2013"),
            // 2014
            >= 404 and <= 407 => ("MB", "Citaro C2", "2014"),
            >= 408 and <= 411 => ("MAN", "NL283F Ceres", "2014"),
            // 2015
            >= 412 and <= 414 => ("MB", "Citaro C2 G", "2015"),
            >= 415 and <= 419 => ("MB", "Citaro C2", "2015"),
            // 2016
            >= 420 and <= 427 => ("MB", "Citaro C2", "2016"),
            // 2024
            428 => ("MAN", "Lion's City 12 E", "2024"),
            // 2025
            429 => ("MAN", "Lion's City 18", "2025"),
            >= 430 and <= 432 => ("MAN", "Lion's City 12", "2025"),
            _ => null
        };
    }
}
