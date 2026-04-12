using Enmarcha.Backend.Helpers;

namespace Enmarcha.Backend.Services.Processors.Normalisation;

public class ColourProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public ColourProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        var feedId = context.StopId.Split(':')[0];
        var (fallbackColor, fallbackTextColor) = _feedService.GetFallbackColourForFeed(feedId);

        foreach (var arrival in context.Arrivals)
        {
            if (string.IsNullOrEmpty(arrival.Route.Colour) || arrival.Route.Colour == "FFFFFF")
            {
                arrival.Route.Colour = fallbackColor;
                arrival.Route.TextColour = fallbackTextColor;
            }
            else if (string.IsNullOrEmpty(arrival.Route.TextColour) || arrival.Route.TextColour == "000000")
            {
                arrival.Route.TextColour = ContrastHelper.GetBestTextColour(arrival.Route.Colour);
            }
        }

        return Task.CompletedTask;
    }
}
