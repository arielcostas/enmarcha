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

        // FIXME: ñapa, perhaps make the feed have different route types or whatever
        var cercanias = context.Routes.Any(r => r.ShortName == "C1");

        // TODO: Filter trips with same code for two services (cercanías and regional sinergiados)

        try
        {
            var ldRealtime = await _realtime.GetLongDistanceTrainInformation();
            System.Diagnostics.Activity.Current?.SetTag("realtime.count", ldRealtime.Count);

            Dictionary<string, CercaniasTrain>? cercaniasRealtime = null;

            if (cercanias)
            {
                cercaniasRealtime = await _realtime.GetCercaniasTrainInformation();
            }

            foreach (Arrival contextArrival in context.Arrivals)
            {
                var trainNumber = RenfeTrainNumberExpression.Match(contextArrival.TripId).Groups[1].Value;

                contextArrival.Headsign.Destination = trainNumber + " - " + contextArrival.Headsign.Destination;

                int oldEstimate = contextArrival.Estimate.Minutes;

                if (ldRealtime.TryGetValue(trainNumber, out var ldTrain))
                {
                    contextArrival.Delay = new DelayBadge
                    {
                        Minutes = ldTrain.Delay
                    };

                    contextArrival.Estimate.Minutes += ldTrain.Delay;
                    contextArrival.Estimate.Precision = ArrivalPrecision.Confident;

                    contextArrival.CurrentPosition = new Position
                    {
                        Latitude = ldTrain.Latitude,
                        Longitude = ldTrain.Longitude,
                        Bearing = null
                    };

                    // TODO: Handle multiple vehicles properly
                    var firstVehicle = ldTrain.RollingStock.Split(",")[0];
                    contextArrival.VehicleInformation = new VehicleBadge
                    {
                        Identifier = context.IsReduced || context.IsNano
                            ? $"S{firstVehicle[..3]} R{firstVehicle[3..]}"
                            : $"Serie {firstVehicle[..3]} Rama {firstVehicle[3..]}"
                    };

                    if (contextArrival.Estimate.Minutes < 0)
                    {
                        _logger.LogDebug(
                            "Train {TrainNumber} supposedly departed already ({OldEstimate} + {DelayMinutes} minutes), marking as deleted. ",
                            trainNumber, oldEstimate, ldTrain.Delay);
                        contextArrival.Delete = true;
                    }

                    continue;
                }

                if (!(cercaniasRealtime?.TryGetValue(trainNumber, out var cercaniasTrain) ?? false))
                {
                    continue;
                }

                contextArrival.Delay = new DelayBadge
                {
                    Minutes = cercaniasTrain.Delay
                };

                contextArrival.Estimate.Minutes += cercaniasTrain.Delay;
                contextArrival.Estimate.Precision = ArrivalPrecision.Confident;

                contextArrival.CurrentPosition = new Position
                {
                    Latitude = cercaniasTrain.Latitude,
                    Longitude = cercaniasTrain.Longitude,
                    Bearing = null
                };

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
