using Enmarcha.Backend.Helpers;
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

            foreach (var estimate in realtime)
            {
                var bestMatch = context.Arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.RouteIdInGtfs.Trim() == estimate.Id.ToString())
                    .Select(a => new
                    {
                        Arrival = a,
                        TimeDiff = estimate.MinutesToArrive - a.Estimate.Minutes, // RealTime - Schedule
                        RouteMatch = true
                    })
                    .Where(x => x.RouteMatch) // Strict route matching
                    .Where(x => x.TimeDiff is >= -5 and <= 25) // Allow 2m early (RealTime < Schedule) or 25m late (RealTime > Schedule)
                    .OrderBy(x => Math.Abs(x.TimeDiff)) // Best time fit
                    .FirstOrDefault();

                if (bestMatch is null)
                {
                    context.Arrivals.Add(new Arrival
                    {
                        TripId = $"tussa:rt:{estimate.Id}:{estimate.MinutesToArrive}",
                        Route = new RouteInfo
                        {
                            GtfsId = $"tussa:{estimate.Id}",
                            ShortName = estimate.Sinoptico,
                            Colour = estimate.Colour,
                            TextColour = ContrastHelper.GetBestTextColour(estimate.Colour)
                        },
                        Headsign = new HeadsignInfo
                        {
                            Badge = "T.REAL",
                            Destination = estimate.Name
                        },
                        Estimate = new ArrivalDetails
                        {
                            Minutes = estimate.MinutesToArrive,
                            Precision = ArrivalPrecision.Confident
                        }
                    });
                    continue;
                }

                var arrival = bestMatch.Arrival;

                arrival.Estimate.Minutes = estimate.MinutesToArrive;
                arrival.Estimate.Precision = ArrivalPrecision.Confident;

                usedTripIds.Add(arrival.TripId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Santiago real-time data for stop {StopId}", context.StopId);
        }
    }

}
