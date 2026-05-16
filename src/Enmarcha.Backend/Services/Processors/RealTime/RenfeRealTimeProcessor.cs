using System.Text.RegularExpressions;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Enmarcha.Sources.GtfsRealtime;
using Enmarcha.Sources.Renfe;
using Arrival = Enmarcha.Backend.Types.Arrivals.Arrival;

namespace Enmarcha.Backend.Services.Processors.RealTime;

public partial class RenfeRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly RenfeRealtimeEstimatesProvider _realtime;
    private readonly ILogger<RenfeRealTimeProcessor> _logger;

    public RenfeRealTimeProcessor(
        RenfeRealtimeEstimatesProvider realtime,
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
            var realtime = await _realtime.GetTrainInformation();
            System.Diagnostics.Activity.Current?.SetTag("realtime.count", realtime.Count);

            foreach (Arrival contextArrival in context.Arrivals)
            {
                var trainNumber = RenfeTrainNumberExpression.Match(contextArrival.TripId).Groups[1].Value;

                contextArrival.Headsign.Destination = trainNumber + " - " + contextArrival.Headsign.Destination;

                if (realtime.TryGetValue(trainNumber, out var train))
                {
                    contextArrival.Delay = new DelayBadge
                    {
                        Minutes = train.LastDelayValue
                    };

                    var oldEstimate = contextArrival.Estimate.Minutes;
                    contextArrival.Estimate.Minutes += train.LastDelayValue;
                    contextArrival.Estimate.Precision = ArrivalPrecision.Confident;

                    contextArrival.CurrentPosition = new Position
                    {
                        Latitude = train.Latitude,
                        Longitude = train.Longitude,
                        Bearing = null
                    };

                    // TODO: Handle multiple vehicles properly
                    var firstVehicle = train.RollingStock.Split(",")[0];
                    contextArrival.VehicleInformation = new VehicleBadge
                    {
                        Identifier = context.IsReduced || context.IsNano ?
                            $"S{firstVehicle[..3]} R{firstVehicle[3..]}" :
                            $"Serie {firstVehicle[..3]} Rama {firstVehicle[3..]}"
                    };

                    if (contextArrival.Estimate.Minutes < 0)
                    {
                        _logger.LogDebug("Train {TrainNumber} supposedly departed already ({OldEstimate} + {DelayMinutes} minutes), marking as deleted. ", trainNumber, oldEstimate, train.LastDelayValue);
                        contextArrival.Delete = true;
                    }
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
