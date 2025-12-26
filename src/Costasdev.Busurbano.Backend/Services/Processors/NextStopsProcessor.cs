using Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;

namespace Costasdev.Busurbano.Backend.Services.Processors;

public class NextStopsProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public NextStopsProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        var feedId = context.StopId.Split(':')[0];

        foreach (var arrival in context.Arrivals)
        {
            if (arrival.RawOtpTrip is not ArrivalsAtStopResponse.Arrival otpArrival) continue;

            // Filter stoptimes that are after the current stop's departure
            var currentStopDeparture = otpArrival.ScheduledDepartureSeconds;

            arrival.NextStops = otpArrival.Trip.Stoptimes
                .Where(s => s.ScheduledDeparture > currentStopDeparture)
                .OrderBy(s => s.ScheduledDeparture)
                .Select(s => _feedService.NormalizeStopName(feedId, s.Stop.Name))
                .ToList();
        }

        return Task.CompletedTask;
    }
}
