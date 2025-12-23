using Costasdev.Busurbano.Backend.Helpers;
using Costasdev.Busurbano.Backend.Types.Arrivals;

namespace Costasdev.Busurbano.Backend.Services.Processors;

public class FeedConfigProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public FeedConfigProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        var feedId = context.StopId.Split(':')[0];
        var (fallbackColor, fallbackTextColor) = _feedService.GetFallbackColourForFeed(feedId);

        foreach (var arrival in context.Arrivals)
        {
            arrival.Route.ShortName = _feedService.NormalizeRouteShortName(feedId, arrival.Route.ShortName);
            arrival.Headsign.Destination = _feedService.NormalizeStopName(feedId, arrival.Headsign.Destination);

            // Apply Vitrasa-specific line formatting
            if (feedId == "vitrasa")
            {
                FormatVitrasaLine(arrival);
                arrival.Shift = _feedService.GetShiftBadge(feedId, arrival.TripId);
            }

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

    private static void FormatVitrasaLine(Arrival arrival)
    {
        arrival.Headsign.Destination = arrival.Headsign.Destination.Replace("*", "");

        if (arrival.Headsign.Destination == "FORA DE SERVIZO.G.B.")
        {
            arrival.Headsign.Destination = "García Barbón, 7 (fora de servizo)";
            return;
        }

        switch (arrival.Route.ShortName)
        {
            case "A" when arrival.Headsign.Destination.StartsWith("\"1\""):
                arrival.Route.ShortName = "A1";
                arrival.Headsign.Destination = arrival.Headsign.Destination.Replace("\"1\"", "");
                break;
            case "6":
                arrival.Headsign.Destination = arrival.Headsign.Destination.Replace("\"", "");
                break;
            case "FUT":
                if (arrival.Headsign.Destination == "CASTELAO-CAMELIAS-G.BARBÓN.M.GARRIDO")
                {
                    arrival.Route.ShortName = "MAR";
                    arrival.Headsign.Destination = "MARCADOR ⚽: CASTELAO-CAMELIAS-G.BARBÓN.M.GARRIDO";
                }
                else if (arrival.Headsign.Destination == "P. ESPAÑA-T.VIGO-S.BADÍA")
                {
                    arrival.Route.ShortName = "RIO";
                    arrival.Headsign.Destination = "RÍO ⚽: P. ESPAÑA-T.VIGO-S.BADÍA";
                }
                else if (arrival.Headsign.Destination == "NAVIA-BOUZAS-URZAIZ-G. ESPINO")
                {
                    arrival.Route.ShortName = "GOL";
                    arrival.Headsign.Destination = "GOL ⚽: NAVIA-BOUZAS-URZAIZ-G. ESPINO";
                }
                break;
        }
    }
}
