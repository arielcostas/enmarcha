namespace Enmarcha.Backend.Services.Processors.Normalisation;

public class TranviasNormalizationProcessor : IArrivalsProcessor
{
    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.StopId.Split(':')[0] != "tranvias")
            return Task.CompletedTask;

        foreach (var arrival in context.Arrivals)
        {
            arrival.Shift = FeedService.GetShiftBadge("tranvias", arrival.TripId);
        }

        return Task.CompletedTask;
    }
}
