using System.Text.RegularExpressions;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Enmarcha.Sources.GtfsRealtime;
using Arrival = Enmarcha.Backend.Types.Arrivals.Arrival;

namespace Enmarcha.Backend.Services.Processors;

public partial class RenfeRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly GtfsRealtimeEstimatesProvider _realtime;
    private readonly ILogger<RenfeRealTimeProcessor> _logger;

    public RenfeRealTimeProcessor(
        GtfsRealtimeEstimatesProvider realtime,
        ILogger<RenfeRealTimeProcessor> logger
    )
    {
        _realtime = realtime;
        _logger = logger;
    }

    public override async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("renfe:")) return;

        try
        {
            var delays = await _realtime.GetRenfeDelays();
            var positions = await _realtime.GetRenfePositions();
            System.Diagnostics.Activity.Current?.SetTag("realtime.count", delays.Count);

            foreach (Arrival contextArrival in context.Arrivals)
            {
                // var trainNumber = contextArrival.TripId.Split(":")[1][..5];
                var trainNumber = RenfeTrainNumberExpression.Match(contextArrival.TripId).Groups[1].Value;

                contextArrival.Headsign.Destination = trainNumber + " - " + contextArrival.Headsign.Destination;

                if (delays.TryGetValue(trainNumber, out var delay))
                {
                    if (delay is null)
                    {
                        // TODO: Indicate train got cancelled
                        _logger.LogDebug("Train {TrainNumber} has no delay information, skipping", trainNumber);
                        continue;
                    }

                    var delayMinutes = delay.Value / 60;
                    contextArrival.Delay = new DelayBadge()
                    {
                        Minutes = delayMinutes
                    };

                    var oldEstimate = contextArrival.Estimate.Minutes;
                    contextArrival.Estimate.Minutes += delayMinutes;
                    contextArrival.Estimate.Precision = ArrivalPrecision.Confident;

                    if (contextArrival.Estimate.Minutes < 0)
                    {
                        _logger.LogDebug("Train {TrainNumber} supposedly departed already ({OldEstimate} + {DelayMinutes} minutes), marking as deleted. ", trainNumber, oldEstimate, delayMinutes);
                        contextArrival.Delete = true;
                    }
                }

                if (positions.TryGetValue(trainNumber, out var position))
                {
                    contextArrival.CurrentPosition = new Position
                    {
                        Latitude = position.Latitude,
                        Longitude = position.Longitude,
                        Bearing = null // TODO: Set the proper degrees
                    };
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Renfe real-time data");
        }
    }

    [GeneratedRegex(@"renfe:(?:\d{4}[A-Z]|)(\d{5})")]
    public partial Regex RenfeTrainNumberExpression { get; }
}
