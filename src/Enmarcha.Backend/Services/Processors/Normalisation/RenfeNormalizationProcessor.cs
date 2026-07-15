using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services.Processors.Normalisation;

public class RenfeNormalizationProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public RenfeNormalizationProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.StopId.Split(':')[0] != "renfe")
        {
            return Task.CompletedTask;
        }

        foreach (var arrival in context.Arrivals)
        {
            arrival.Shift = new ShiftBadge()
            {
                ShiftName = arrival.TripId.Split(":", 2)[1][..5],
                ShiftTrip = ""
            };
        }

        return Task.CompletedTask;
    }
}
