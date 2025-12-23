using Costasdev.Busurbano.Backend.GraphClient.App;
using Costasdev.Busurbano.Backend.Types.Arrivals;
using Costasdev.VigoTransitApi;

namespace Costasdev.Busurbano.Backend.Services.Processors;

public class VitrasaRealTimeProcessor : IArrivalsProcessor
{
    private readonly VigoTransitApiClient _api;
    private readonly FeedService _feedService;
    private readonly ILogger<VitrasaRealTimeProcessor> _logger;

    public VitrasaRealTimeProcessor(HttpClient http, FeedService feedService, ILogger<VitrasaRealTimeProcessor> logger)
    {
        _api = new VigoTransitApiClient(http);
        _feedService = feedService;
        _logger = logger;
    }

    public async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("vitrasa:")) return;

        var normalizedCode = _feedService.NormalizeStopCode("vitrasa", context.StopCode);
        if (!int.TryParse(normalizedCode, out var numericStopId)) return;

        try
        {
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
                    if (delayMinutes != 0)
                    {
                        arrival.Delay = new DelayBadge { Minutes = delayMinutes };
                    }

                    // Prefer real-time headsign if available and different
                    if (!string.IsNullOrWhiteSpace(estimate.Route))
                    {
                        arrival.Headsign.Destination = estimate.Route;
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
                            ShortName = estimate.Line,
                            Colour = template?.Route.Colour ?? "FFFFFF",
                            TextColour = template?.Route.TextColour ?? "000000"
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
