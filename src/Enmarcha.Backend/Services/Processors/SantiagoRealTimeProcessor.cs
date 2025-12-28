using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Sources.TranviasCoruna;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Enmarcha.Sources.Tussa;
using Arrival = Enmarcha.Backend.Types.Arrivals.Arrival;

namespace Enmarcha.Backend.Services.Processors;

public class SantiagoRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly SantiagoRealtimeEstimatesProvider _realtime;
    private readonly FeedService _feedService;
    private readonly ILogger<SantiagoRealTimeProcessor> _logger;

    public SantiagoRealTimeProcessor(
        HttpClient http,
        FeedService feedService,
        ILogger<SantiagoRealTimeProcessor> logger)
    {
        _realtime = new SantiagoRealtimeEstimatesProvider(http);
        _feedService = feedService;
        _logger = logger;
    }

    public override async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("tussa:")) return;

        var normalizedCode = _feedService.NormalizeStopCode("tussa", context.StopCode);
        if (!int.TryParse(normalizedCode, out var numericStopId)) return;

        try
        {
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

                var scheduledMinutes = arrival.Estimate.Minutes;
                arrival.Estimate.Minutes = estimate.Minutes;
                arrival.Estimate.Precision = ArrivalPrecision.Confident;

                // Calculate delay badge
                var delayMinutes = estimate.Minutes - scheduledMinutes;
                if (delayMinutes != 0)
                {
                    arrival.Delay = new DelayBadge { Minutes = delayMinutes };
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

}
