using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services.Processors.Normalisation;

public class CorunaNormalizationProcessor : IArrivalsProcessor
{
    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.StopId.Split(':')[0] != "tranvias")
            return Task.CompletedTask;

        // FIXME: Ñapa suponiendo que no hay más dos líneas con la misma cabecera, donde una arranca de ahí y la otra
        // se va a otro sitio a arrancar
        var sharedTerminus = context.Arrivals.Any(a => a.Operation == VehicleOperation.Arrival) &&
                             context.Arrivals.Any(a => a.Operation == VehicleOperation.Departure);

        foreach (var arrival in context.Arrivals)
        {
            if (arrival.RealTimeOnly) continue;
            arrival.Shift = FeedService.GetShiftBadge("tranvias", arrival.TripId);

            if (sharedTerminus && arrival.Operation == VehicleOperation.Arrival)
            {
                arrival.Delete = true;
            }
        }

        return Task.CompletedTask;
    }
}
