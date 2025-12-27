using Costasdev.Busurbano.Backend.Configuration;
using Costasdev.Busurbano.Backend.Services.Providers;
using Costasdev.Busurbano.Backend.Types.Planner;
using Microsoft.Extensions.Options;

namespace Costasdev.Busurbano.Backend.Services;

public record FareResult(decimal CashFareEuro, decimal CardFareEuro);

public class FareService
{
    private readonly AppConfiguration _config;
    private readonly XuntaFareProvider _xuntaFareProvider;
    private readonly ILogger<FareService> _logger;

    private const decimal VitrasaCashFare = 1.63M;
    private const decimal VitrasaCardFare = 0.67M;

    private const decimal CorunaCashFare = 1.30M;
    private const decimal CorunaCardFare = 0.45M;

    private const decimal SantiagoCashFare = 1.00M;
    private const decimal SantiagoCardFare = 0.36M;

    public FareService(
        IOptions<AppConfiguration> config,
        XuntaFareProvider xuntaFareProvider,
        ILogger<FareService> logger
    )
    {
        _config = config.Value;
        _xuntaFareProvider = xuntaFareProvider;
        _logger = logger;
    }

    public FareResult CalculateFare(IEnumerable<Leg> legs)
    {
        var transitLegs = legs
            .Where(l => l.Mode != null && !l.Mode.Equals("WALK", StringComparison.CurrentCultureIgnoreCase))
            .ToList();

        if (!transitLegs.Any())
        {
            return new FareResult(0, 0);
        }

        return new FareResult(
            CalculateCashTotal(transitLegs),
            CalculateCardTotal(transitLegs)
        );
    }

    private decimal CalculateCashTotal(IEnumerable<Leg> legs)
    {
        decimal total = 0L;
        foreach (var leg in legs)
        {
            switch (leg.FeedId)
            {
                case "santiago":
                    total += SantiagoCashFare;
                    break;
                case "coruna":
                    total += CorunaCashFare;
                    break;
                case "vitrasa":
                    total += VitrasaCashFare;
                    break;
                case "xunta":
                    // TODO: Handle potentiall blow-ups
                    if (leg.From is not { ZoneId: not null })
                    {
                        _logger.LogInformation("Ignored fare calculation for leg without From ZoneId. {FromStop}", leg.From?.StopId);
                    }

                    if (leg.To is not { ZoneId: not null })
                    {
                        _logger.LogInformation("Ignored fare calculation for leg without To ZoneId. {ToStop}", leg.To?.StopId);
                    }

                    total += _xuntaFareProvider.GetPrice(leg.From!.ZoneId!, leg.To!.ZoneId!)!.PriceCash;
                    break;
            }
        }

        return total;
    }

    private decimal CalculateCardTotal(IEnumerable<Leg> legs)
    {
        List<TicketPurchased> wallet = [];
        decimal totalCost = 0;

        foreach (var leg in legs)
        {
            _logger.LogDebug("Processing leg {leg}", leg);

            int maxMinutes;
            int maxUsages;
            string? metroArea = null;
            decimal initialFare = 0;

            switch (leg.FeedId)
            {
                case "vitrasa":
                    maxMinutes = 45;
                    maxUsages = 3;
                    initialFare = VitrasaCardFare;
                    break;
                case "coruna":
                    maxMinutes = 45;
                    maxUsages = 2;
                    initialFare = CorunaCardFare;
                    break;
                case "santiago":
                    maxMinutes = 60;
                    maxUsages = 2;
                    initialFare = SantiagoCardFare;
                    break;
                case "xunta":
                    if (leg.From?.ZoneId == null || leg.To?.ZoneId == null)
                    {
                        _logger.LogWarning("Missing ZoneId for Xunta leg. From: {From}, To: {To}", leg.From?.StopId, leg.To?.StopId);
                        continue;
                    }

                    var priceRecord = _xuntaFareProvider.GetPrice(leg.From.ZoneId, leg.To.ZoneId);
                    if (priceRecord == null)
                    {
                        _logger.LogWarning("No price record found for Xunta leg from {From} to {To}", leg.From.ZoneId, leg.To.ZoneId);
                        continue;
                    }

                    metroArea = priceRecord.MetroArea;
                    initialFare = priceRecord.PriceCard;
                    maxMinutes = 60;
                    maxUsages = (metroArea != null && metroArea.StartsWith("ATM", StringComparison.OrdinalIgnoreCase)) ? 3 : 1;
                    break;
                default:
                    _logger.LogWarning("Unknown FeedId: {FeedId}", leg.FeedId);
                    continue;
            }

            var validTicket = wallet.FirstOrDefault(t => t.FeedId == leg.FeedId && t.IsValid(leg.StartTime, maxMinutes, maxUsages));

            if (validTicket != null)
            {
                if (leg.FeedId == "xunta" && maxUsages > 1) // ATM upgrade logic
                {
                    var upgradeRecord = _xuntaFareProvider.GetPrice(validTicket.StartZone, leg.To!.ZoneId!);
                    if (upgradeRecord != null)
                    {
                        decimal upgradeCost = Math.Max(0, upgradeRecord.PriceCard - validTicket.TotalPaid);
                        totalCost += upgradeCost;
                        validTicket.TotalPaid += upgradeCost;
                        validTicket.UsedTimes++;
                        _logger.LogDebug("Xunta ATM upgrade: added {Cost}€, total paid for ticket: {TotalPaid}€", upgradeCost, validTicket.TotalPaid);
                    }
                    else
                    {
                        // Fallback: treat as new ticket if upgrade path not found
                        totalCost += initialFare;
                        wallet.Add(new TicketPurchased
                        {
                            FeedId = leg.FeedId,
                            PurchasedAt = leg.StartTime,
                            MetroArea = metroArea,
                            StartZone = leg.From!.ZoneId!,
                            TotalPaid = initialFare
                        });
                    }
                }
                else
                {
                    // Free transfer for city systems or non-ATM Xunta (though non-ATM Xunta has maxUsages=1)
                    validTicket.UsedTimes++;
                    _logger.LogDebug("Free transfer for {FeedId}", leg.FeedId);
                }
            }
            else
            {
                // New ticket
                totalCost += initialFare;
                wallet.Add(new TicketPurchased
                {
                    FeedId = leg.FeedId!,
                    PurchasedAt = leg.StartTime,
                    MetroArea = metroArea,
                    StartZone = leg.FeedId == "xunta" ? leg.From!.ZoneId! : string.Empty,
                    TotalPaid = initialFare
                });
                _logger.LogDebug("New ticket for {FeedId}: {Cost}€", leg.FeedId, initialFare);
            }
        }

        return totalCost;
    }
}

public class TicketPurchased
{
    public string FeedId { get; set; }

    public DateTime PurchasedAt { get; set; }
    public string? MetroArea { get; set; }
    public string StartZone { get; set; }

    public int UsedTimes = 1;
    public decimal TotalPaid { get; set; }

    public bool IsValid(DateTime startTime, int maxMinutes, int maxUsagesIncluded)
    {
        return (startTime - PurchasedAt).TotalMinutes <= maxMinutes && UsedTimes < maxUsagesIncluded;
    }
}
