using Enmarcha.Backend.Dto;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Services;
using Enmarcha.Sources.Tussa;
using HeadsignInfo = Enmarcha.Backend.Dto.HeadsignInfo;
using RouteInfo = Enmarcha.Backend.Dto.RouteInfo;
using StopArrivalsResponse = Enmarcha.Sources.OpenTripPlannerGql.Queries.V2.StopArrivalsResponse;

namespace Enmarcha.Backend.Providers.RealTimeInformation;

public class TussaRealTimeInformationProvider : IRealTimeInformationProvider
{
    private readonly SantiagoRealtimeEstimatesProvider _realtime;
    private readonly ILogger<TussaRealTimeInformationProvider> _logger;

    public TussaRealTimeInformationProvider(
        SantiagoRealtimeEstimatesProvider realtime,
        ILogger<TussaRealTimeInformationProvider> logger)
    {
        _realtime = realtime;
        _logger = logger;
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
            var realtime = await _realtime.GetEstimatesForStop(numericStopId);

            var usedTripIds = new HashSet<string>();

            foreach (var estimate in realtime)
            {
                var bestMatch = arrivals
                    .Where(a => !usedTripIds.Contains(a.TripId))
                    .Where(a => a.Route.RouteIdInGtfs.Trim() == estimate.Id.ToString())
                    .Select(a => new
                    {
                        Arrival = a,
                        TimeDiff = estimate.MinutesToArrive - a.Estimate.Minutes, // RealTime - Schedule
                        RouteMatch = true
                    })
                    .Where(x => x.RouteMatch) // Strict route matching
                    .Where(x => x.TimeDiff is >= -5
                        and <= 35) // Allow 2m early (RealTime < Schedule) or 25m late (RealTime > Schedule)
                    .OrderBy(x => Math.Abs(x.TimeDiff)) // Best time fit
                    .FirstOrDefault();

                if (bestMatch is null)
                {
                    arrivals.Add(new StopEstimate
                    {
                        TripId = $"tussa:rtonly_{estimate.Id}_{estimate.MinutesToArrive}",
                        RealTimeOnly = true,
                        Route = new RouteInfo
                        {
                            GtfsId = $"tussa:{estimate.Id}",
                            OriginalShortName = estimate.Sinoptico,
                            ShortName = estimate.Sinoptico,
                            Colour = estimate.Colour,
                            TextColour = ContrastHelper.GetBestTextColour(estimate.Colour)
                        },
                        Headsign = new HeadsignInfo
                        {
                            Destination = estimate.Name
                        },
                        Estimate = new EstimateDetails
                        {
                            Minutes = estimate.MinutesToArrive,
                            Confidence = ArrivalConfidence.RealtimeCirculating,
                            Relationship = ArrivalRelationship.New
                        }
                    });
                    continue;
                }

                var arrival = bestMatch.Arrival;

                var scheduledMinutes = arrival.Estimate.Minutes;

                arrival.Estimate.Minutes = estimate.MinutesToArrive;
                arrival.Estimate.DelayMinutes = estimate.MinutesToArrive - scheduledMinutes;
                arrival.Estimate.Confidence =
                    arrival.RawOtpArrival?.Trip.DepartureStoptime.ScheduledDeparture -
                    DateTime.UtcNow.TimeOfDay.TotalSeconds > 0
                        ? ArrivalConfidence.RealtimeCirculating
                        : ArrivalConfidence.RealtimeBeforeDeparture;

                usedTripIds.Add(arrival.TripId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Santiago real-time data for stop {StopCode}", stop.Code);
        }

        return (arrivals, null);
    }
}
