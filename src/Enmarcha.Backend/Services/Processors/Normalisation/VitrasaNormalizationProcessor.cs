using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services.Processors.Normalisation;

public class VitrasaNormalizationProcessor : IArrivalsProcessor
{
    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.StopId.Split(':')[0] != "vitrasa")
            return Task.CompletedTask;

        foreach (var arrival in context.Arrivals)
        {
            arrival.Headsign.Destination = FeedService.NormalizeStopName("vitrasa", arrival.Headsign.Destination);
            FormatVitrasaLine(arrival);
            arrival.Shift = FeedService.GetShiftBadge("vitrasa", arrival.TripId);
        }

        return Task.CompletedTask;
    }

    private static void FormatVitrasaLine(Arrival arrival)
    {
        arrival.Headsign.Destination = arrival.Headsign.Destination.Replace("*", "");

        var destinationTrimmed = arrival.Headsign.Destination.TrimStart();

        if (arrival.Headsign.Destination == "FORA DE SERVIZO.G.B.")
        {
            arrival.Headsign.Destination = "García Barbón, 7 (fora de servizo)";
            return;
        }

        switch (arrival.Route.ShortName)
        {
            case "A" when destinationTrimmed.StartsWith("\"1\"", StringComparison.Ordinal) ||
                           (destinationTrimmed.Length >= 1 && destinationTrimmed[0] == '1' &&
                            (destinationTrimmed.Length == 1 || !char.IsDigit(destinationTrimmed[1]))):
                arrival.Route.ShortName = "A1";
                // NormalizeStopName() removes quotes for Vitrasa, so handle both "\"1\"" and leading "1".
                if (destinationTrimmed.StartsWith("\"1\"", StringComparison.Ordinal))
                {
                    destinationTrimmed = destinationTrimmed.Substring(3);
                }
                else
                {
                    destinationTrimmed = destinationTrimmed.Substring(1);
                }

                arrival.Headsign.Destination = destinationTrimmed.TrimStart(' ', '-', '.', ':');
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

                arrival.Route.Colour = "6CACE4";
                arrival.Route.TextColour = "000000";
                break;
        }
    }
}
