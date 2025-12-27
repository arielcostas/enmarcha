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
        double cashFare = 0;
        foreach (var leg in busLegs)
        {
            // TODO: In the future, this should depend on the operator/feed
            if (leg.FeedId == "vitrasa")
            {
                cashFare += 1.63;
            }
            else
            {
                cashFare += 1.63; // Default fallback
            }
        }

        // Card fare logic (45-min transfer window)
        int cardTicketsRequired = 0;
        DateTime? lastTicketPurchased = null;
        int tripsPaidWithTicket = 0;
        string? lastFeedId = null;

        foreach (var leg in busLegs)
        {
            // If no ticket purchased, ticket expired (no free transfers after 45 mins), or max trips with ticket reached
            // Also check if we changed operator (assuming no free transfers between different operators for now)
            if (lastTicketPurchased == null ||
                (leg.StartTime - lastTicketPurchased.Value).TotalMinutes > 45 ||
                tripsPaidWithTicket >= 3 ||
                leg.FeedId != lastFeedId)
            {
                cardTicketsRequired++;
                lastTicketPurchased = leg.StartTime;
                tripsPaidWithTicket = 1;
                lastFeedId = leg.FeedId;
            }
            else
            {
                tripsPaidWithTicket++;
            }
        }

        return new FareResult(cashFare, cardTicketsRequired * 0.67);
    }
}
