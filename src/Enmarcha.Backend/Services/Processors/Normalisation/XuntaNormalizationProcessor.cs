namespace Enmarcha.Backend.Services.Processors.Normalisation;

public class XuntaNormalizationProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public XuntaNormalizationProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.StopId.Split(':')[0] != "xunta")
            return Task.CompletedTask;

        foreach (var arrival in context.Arrivals)
        {
            arrival.Route.ShortName = _feedService.NormalizeRouteShortName("xunta", arrival.Route.ShortName);
        }

        return Task.CompletedTask;
    }
}
