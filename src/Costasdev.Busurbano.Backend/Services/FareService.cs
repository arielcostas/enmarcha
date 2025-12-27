using Costasdev.Busurbano.Backend.Configuration;
using Costasdev.Busurbano.Backend.Types.Planner;
using Microsoft.Extensions.Options;

namespace Costasdev.Busurbano.Backend.Services;

public record FareResult(double CashFareEuro, double CardFareEuro);

public class FareService
{
    private readonly AppConfiguration _config;

    public FareService(IOptions<AppConfiguration> config)
    {
        _config = config.Value;
    }

    public FareResult CalculateFare(IEnumerable<Leg> legs)
    {
        var busLegs = legs.Where(l => l.Mode != null && l.Mode.ToUpper() != "WALK").ToList();

        // Cash fare logic
        // TODO: In the future, this should depend on the operator/feed
        var cashFare = busLegs.Count * 1.63; // Defaulting to Vitrasa for now

        // Card fare logic (45-min transfer window)
        int cardTicketsRequired = 0;
        DateTime? lastTicketPurchased = null;
        int tripsPaidWithTicket = 0;

        foreach (var leg in busLegs)
        {
            if (lastTicketPurchased == null ||
                (leg.StartTime - lastTicketPurchased.Value).TotalMinutes > 45 ||
                tripsPaidWithTicket >= 3)
            {
                cardTicketsRequired++;
                lastTicketPurchased = leg.StartTime;
                tripsPaidWithTicket = 1;
            }
            else
            {
                tripsPaidWithTicket++;
            }
        }

        return new FareResult(cashFare, cardTicketsRequired * 0.67);
    }
}
