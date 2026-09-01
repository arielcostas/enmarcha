using System.Text.RegularExpressions;
using Enmarcha.Backend.Dto;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Services.Processors;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Enmarcha.Sources.Renfe;
using Arrival = Enmarcha.Backend.Types.Arrivals.Arrival;
using StopArrivalsResponse = Enmarcha.Sources.OpenTripPlannerGql.Queries.V2.StopArrivalsResponse;

namespace Enmarcha.Backend.Providers.RealTimeInformation;

public partial class RenfeRealTimeInformationProvider : IRealTimeInformationProvider
{
    private readonly RenfeRealtimeEstimatesProvider _realtime;
    private readonly ILogger<RenfeRealTimeInformationProvider> _logger;

    public RenfeRealTimeInformationProvider(
        RenfeRealtimeEstimatesProvider realtime,
        ILogger<RenfeRealTimeInformationProvider> logger
    )
    {
        _realtime = realtime;
        _logger = logger;
    }

    public async Task<(List<StopEstimate> arrivals, IEnumerable<DataSource>? dataSources)> ApplyRealtimeInformation(
        StopArrivalsResponse.StopItem stop,
        List<StopEstimate> arrivals
    )
    {
        // FIXME: ñapa, perhaps make the feed have different route types or whatever
        var cercanias = stop.Routes.Any(r => r.ShortName == "C1");

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

            foreach (StopEstimate contextArrival in arrivals)
            {
                var trainNumber = RenfeTrainNumberExpression.Match(contextArrival.TripId).Groups[1].Value;

                int oldEstimate = contextArrival.Estimate.Minutes;

                if (ldRealtime.TryGetValue(trainNumber, out var ldTrain))
                {
                    contextArrival.Estimate.DelayMinutes = ldTrain.Delay;
                    contextArrival.Estimate.Minutes += ldTrain.Delay;
                    contextArrival.Estimate.Confidence =
                        (contextArrival.RawOtpArrival?.Trip.DepartureStoptime.ScheduledDeparture -
                         DateTime.UtcNow.TimeOfDay.TotalSeconds) > 0
                            ? ArrivalConfidence.RealtimeCirculating
                            : ArrivalConfidence.RealtimeBeforeDeparture;

                    contextArrival.CurrentPosition = new Position
                    {
                        Latitude = ldTrain.Latitude,
                        Longitude = ldTrain.Longitude,
                        Bearing = null
                    };

                    // TODO: Handle multiple vehicles properly
                    var material = new Dictionary<string, List<string>>();
                    var vehicles = ldTrain.RollingStock.Split(",");

                    foreach (var veh in vehicles)
                    {
                        var serie = veh[..3];
                        var rama = veh[3..];

                        if (!material.ContainsKey(serie))
                        {
                            material[serie] = new();
                        }

                        material[serie].Add(rama);
                    }

                    var mat = material.ToArray();
                    var idStrings = new string[material.Count];
                    for (int i = 0; i < idStrings.Length; i++)
                    {
                        idStrings[i] = $"S{mat[i].Key} R{string.Join('+', mat[i].Value)}";
                    }

                    contextArrival.VehicleInformation = new VehicleInformation
                    {
                        CompanyNumber =
                            string.Join("; ",
                                idStrings) // TODO: Maybe allow multiple vehicles, or another field, or smth
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

                contextArrival.Estimate.DelayMinutes = cercaniasTrain.Delay;
                contextArrival.Estimate.Minutes += cercaniasTrain.Delay;
                contextArrival.Estimate.Confidence =
                    (contextArrival.RawOtpArrival?.Trip.DepartureStoptime.ScheduledDeparture -
                     DateTime.UtcNow.TimeOfDay.TotalSeconds) > 0
                        ? ArrivalConfidence.RealtimeCirculating
                        : ArrivalConfidence.RealtimeBeforeDeparture;

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

        return (arrivals, []);
    }

    [GeneratedRegex(@"renfe:(?:\d{4}[A-Z]|)(\d{5})")]
    private static partial Regex RenfeTrainNumberExpression { get; }
}
