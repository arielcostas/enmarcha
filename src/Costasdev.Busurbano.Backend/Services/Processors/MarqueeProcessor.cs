namespace Costasdev.Busurbano.Backend.Services.Processors;

public class MarqueeProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public MarqueeProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        var feedId = context.StopId.Split(':')[0];

        foreach (var arrival in context.Arrivals)
        {
            if (string.IsNullOrEmpty(arrival.Headsign.Marquee))
            {
                arrival.Headsign.Marquee = _feedService.GenerateMarquee(feedId, arrival.NextStops);
            }
        }

        return Task.CompletedTask;
    }
}
