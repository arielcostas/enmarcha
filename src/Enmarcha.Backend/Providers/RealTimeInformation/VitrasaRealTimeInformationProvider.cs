using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Enmarcha.Backend.Dto;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using HeadsignInfo = Enmarcha.Backend.Dto.HeadsignInfo;
using RouteInfo = Enmarcha.Backend.Dto.RouteInfo;
using StopArrivalsResponse = Enmarcha.Sources.OpenTripPlannerGql.Queries.V2.StopArrivalsResponse;

namespace Enmarcha.Backend.Providers.RealTimeInformation;

public class VitrasaRealTimeInformationProvider : IRealTimeInformationProvider
{
    private readonly HttpClient _httpClient;
    private readonly ShapeTraversalService _shapeService;

    public VitrasaRealTimeInformationProvider(HttpClient httpClient, ShapeTraversalService shapeService)
    {
        _httpClient = httpClient;
        _shapeService = shapeService;
    }

    public async Task<(List<StopEstimate> arrivals, IEnumerable<DataSource>?)> ApplyRealtimeInformation(
        StopArrivalsResponse.StopItem stop,
        List<StopEstimate> arrivals
    )
    {
        try
        {
            Epsg25829? stopLocation = _shapeService.TransformToEpsg25829(stop.Lat, stop.Lon);

            var url =
                $"https://datos.vigo.org/vci_api_app/api2.jsp?tipo=TRANSPORTE-ESTIMACION-PARADA&ttl=1&id={stop.Code}";
            var response = await _httpClient.GetAsync(url);

            var json = await response.Content.ReadAsStringAsync();
            var responseBody = JsonSerializer.Deserialize<VitrasaRealtimeEstimateResponse>(json);
            var estimates = responseBody!.Estimates
                .Where(e => !string.IsNullOrWhiteSpace(e.Route) && !e.Route.Trim().EndsWith('*'))
                .ToList();

            var usedTripIds = new HashSet<string>();
            var newArrivals = new List<StopEstimate>();

            // Probably a stupid way to iterate
            arrivals.ForEach(arr =>
            {
                var shiftParts = arr.TripId.Split("_", 3);
                if (shiftParts.Length != 3)
                {
                    return;
                }

                arr.Circulation?.ShiftName = shiftParts[1];
                arr.Circulation?.ShiftTrip = shiftParts[2];
            });

            foreach (var estimate in estimates)
            {
                var estimateRouteNormalized = NormaliseRouteNameForMatching(estimate.Route);

                var bestMatch = arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.ShortName.Trim() == estimate.Line.Trim())
                    .Select(a =>
                    {
                        // Use tripHeadsign from GTFS if available, otherwise fall back to stop-level headsign
                        string scheduleHeadsign = a.Headsign.Destination;
                        if (a.RawOtpArrival is not null &&
                            !string.IsNullOrWhiteSpace(a.RawOtpArrival.Trip.TripHeadsign))
                        {
                            scheduleHeadsign = a.RawOtpArrival.Trip.TripHeadsign;
                        }

                        var arrivalRouteNormalized = NormaliseRouteNameForMatching(scheduleHeadsign);
                        string? arrivalLongNameNormalized = null;
                        string? arrivalLastStopNormalized = null;

                        if (a.RawOtpArrival is not null)
                        {
                            if (a.RawOtpArrival.Trip.Route.LongName != null)
                            {
                                arrivalLongNameNormalized =
                                    NormaliseRouteNameForMatching(a.RawOtpArrival.Trip.Route.LongName);
                            }

                            var lastStop = a.RawOtpArrival.Trip.Stoptimes.LastOrDefault();
                            if (lastStop != null)
                            {
                                arrivalLastStopNormalized = NormaliseRouteNameForMatching(lastStop.Stop.Name);
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
                    .Where(x => x.TimeDiff is >= -7
                        and <= 75) // Allow 7m early (RealTime < Schedule) or 75m late (RealTime > Schedule)
                    .OrderBy(x => Math.Abs(x.TimeDiff)) // Best time fit
                    .FirstOrDefault();

                if (bestMatch is null)
                {
                    //_logger.LogInformation("Adding unmatched Vitrasa real-time arrival for line {Line} in {Minutes}m",
                    //estimate.Line, estimate.Minutes);

                    // Try to find a "template" arrival with the same line to copy colors from
                    var template = arrivals
                        .FirstOrDefault(a => a.Route.ShortName.Trim() == estimate.Line.Trim());

                    newArrivals.Add(new StopEstimate
                    {
                        TripId = $"vitrasa:rtonly:{estimate.Line}:{estimate.Route}:{estimate.Minutes}",
                        RealTimeOnly = true,
                        Route = new RouteInfo
                        {
                            GtfsId = $"vitrasa:{estimate.Line}",
                            OriginalShortName = estimate.Line,
                            ShortName = estimate.Line,
                            Colour = template?.Route.Colour ?? "FFFFFF",
                            TextColour = template?.Route.TextColour ?? "000000"
                        },
                        Headsign = new HeadsignInfo()
                        {
                            Destination = estimate.Route
                        },
                        Estimate = new EstimateDetails
                        {
                            Minutes = estimate.Minutes,
                            Confidence = ArrivalConfidence.RealtimeCirculating,
                            Relationship = ArrivalRelationship.New
                        }
                    });

                    continue;
                }

                var bestMatchArrival = bestMatch.Arrival;

                var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
                var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);

                var scheduledMinutes = bestMatchArrival.Estimate.Minutes;
                bestMatchArrival.Estimate.Minutes = estimate.Minutes;
                bestMatchArrival.Estimate.DelayMinutes = estimate.Minutes - scheduledMinutes;
                bestMatchArrival.Estimate.Confidence =
                    (bestMatchArrival.RawOtpArrival?.Trip.DepartureStoptime.ScheduledDeparture -
                     DateTime.UtcNow.TimeOfDay.TotalSeconds) > 0
                        ? ArrivalConfidence.RealtimeCirculating
                        : ArrivalConfidence.RealtimeBeforeDeparture;

                // Prefer real-time headsign UNLESS it's just the last stop name (which is less informative)
                if (!string.IsNullOrWhiteSpace(estimate.Route))
                {
                    bool isJustLastStop = false;

                    if (bestMatchArrival.RawOtpArrival is not null)
                    {
                        var lastStop = bestMatchArrival.RawOtpArrival.Trip.Stoptimes.LastOrDefault();
                        if (lastStop != null)
                        {
                            var arrivalLastStopNormalized = NormaliseRouteNameForMatching(lastStop.Stop.Name);
                            isJustLastStop = estimateRouteNormalized == arrivalLastStopNormalized;
                        }
                    }

                    // Use real-time headsign unless it's just the final stop name
                    if (!isJustLastStop)
                    {
                        bestMatchArrival.Headsign.Destination = estimate.Route;
                    }
                }

                // Calculate position
                if (stopLocation != null)
                {
                    Position? currentPosition = null;

                    if (bestMatchArrival.RawOtpArrival is { Trip.Geometry.Points: not null } otpArrival)
                    {
                        var decodedPoints = ShapeDecoder.Decode(otpArrival.Trip.Geometry.Points)
                            .Select(p => new Position { Latitude = p.Lat, Longitude = p.Lon })
                            .ToList();

                        var shape = _shapeService.CreateShapeFromWgs84(decodedPoints);

                        // Ensure meters is positive
                        var meters = Math.Max(0, estimate.Meters);
                        var result = _shapeService.GetBusPosition(shape, stopLocation, meters);

                        currentPosition = result.BusPosition;

                        // Populate Shape GeoJSON
                        List<object> features =
                        [
                            new
                            {
                                type = "Feature",
                                geometry = new
                                {
                                    type = "LineString",
                                    coordinates = decodedPoints.Select(p => new[] { p.Longitude, p.Latitude })
                                        .ToList()
                                },
                                properties = new { type = "route" }
                            }
                        ];

                        // Add stops if available
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

                        bestMatchArrival.Shape = new
                        {
                            type = "FeatureCollection",
                            features
                        };
                    }

                    if (currentPosition != null)
                    {
                        bestMatchArrival.CurrentPosition = currentPosition;
                    }
                }

                usedTripIds.Add(bestMatchArrival.TripId);
            }

            arrivals.AddRange(newArrivals);
        }
        catch (Exception ex)
        {
            // FIXME: Exception handling
        }

        return (arrivals, []);
    }

    private string NormaliseRouteNameForMatching(string name)
    {
        var normalized = name.Trim().ToLowerInvariant();
        // Remove diacritics/accents
        normalized = Regex.Replace(normalized.Normalize(System.Text.NormalizationForm.FormD), @"\p{Mn}", "");
        // Keep only alphanumeric
        return Regex.Replace(normalized, @"[^a-z0-9]", "");
    }

    private static bool IsRouteMatch(string a, string b)
    {
        return a == b || a.Contains(b) || b.Contains(a);
    }
}

public class VitrasaRealtimeEstimateResponse
{
    [JsonPropertyName("parada")] public required StopInfo[] StopInfos { get; set; }
    [JsonIgnore] public StopInfo Stop => StopInfos[0];
    [JsonPropertyName("estimaciones")] public required List<VitrasaRealtimeEstimate> Estimates { get; set; }

    public class StopInfo
    {
        [JsonPropertyName("nombre")] public required string Name { get; set; }
        [JsonPropertyName("stop_vitrasa")] public int Id { get; set; }
        [JsonPropertyName("latitud")] public decimal Latitude { get; set; }
        [JsonPropertyName("longitud")] public decimal Longitude { get; set; }
    }
}

public class VitrasaRealtimeEstimate
{
    [JsonPropertyName("linea")] public required string Line { get; set; }
    [JsonPropertyName("ruta")] public required string Route { get; set; }
    [JsonPropertyName("minutos")] public int Minutes { get; set; }
    [JsonPropertyName("metros")] public int Meters { get; set; }
}
