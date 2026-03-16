using System.Text;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;

namespace Enmarcha.Backend.Services.Processors;

public class NextStopsProcessor : IArrivalsProcessor
{
    private readonly FeedService _feedService;

    public NextStopsProcessor(FeedService feedService)
    {
        _feedService = feedService;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.IsNano) return Task.CompletedTask;

        var feedId = context.StopId.Split(':')[0];

        foreach (var arrival in context.Arrivals)
        {
            if (arrival.RawOtpTrip is not ArrivalsAtStopResponse.Arrival otpArrival) continue;
            if (arrival.Headsign.Marquee is not null) continue;

            // Filter stoptimes that are after the current stop's departure
            var currentStopDeparture = otpArrival.ScheduledDepartureSeconds;

            if (feedId == "xunta")
            {
                arrival.NextStops = otpArrival.Trip.Stoptimes
                    .Where(s => s.ScheduledDeparture > currentStopDeparture)
                    .OrderBy(s => s.ScheduledDeparture)
                    .Select(s => s.Stop.Description)
                    .Distinct()
                    .ToList();
            }
            else
            {
                arrival.NextStops = otpArrival.Trip.Stoptimes
                    .Where(s => s.ScheduledDeparture > currentStopDeparture)
                    .OrderBy(s => s.ScheduledDeparture)
                    .Select(s => FeedService.NormalizeStopName(feedId, s.Stop.Name))
                    .ToList();
            }

            arrival.Headsign.Marquee = GenerateMarquee(feedId, arrival.NextStops);
        }

        return Task.CompletedTask;
    }

    private static string? GenerateMarquee(string feedId, List<string> nextStops)
    {
        if (nextStops.Count == 0) return null;

        if (feedId is "vitrasa" or "tranvias" or "tussa" or "ourense")
        {
            var streets = nextStops
                .Select(FeedService.GetStreetName)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct()
                .ToList();

            return string.Join(" - ", streets);
        }

        if (feedId == "xunta")
        {
            var points = nextStops
                .Select(SplitXuntaStopDescription)
                .ToList();

            List<string> seenConcellos = new();
            List<string> seenParroquias = new();
            List<string> items = [];

            foreach (var (parroquia, concello) in points)
            {
                // Santiago de Compostela -- Santiago de Compostela > Conxo -- Santiago de Compostela > Biduído -- Ames > Calo -- Teo > Bugallido -- Ames
                // Santiago de Compostela -> Conxo -> Bidueiro (Ames) -> Calo (Teo) -> Bugallido
                string item = "";

                if (!seenParroquias.Contains(parroquia))
                {
                    seenParroquias.Add(parroquia);
                    item += $"{parroquia}";

                    if (parroquia == concello)
                    {
                        seenConcellos.Add(concello);
                    }

                    if (!seenConcellos.Contains(concello))
                    {
                        seenConcellos.Add(concello);
                        item = $"({concello}) {item}";
                    }

                    items.Add(item);
                }

            }

            return string.Join(" > ", items);
        }

        return feedId switch
        {
            "renfe" => string.Join(" - ", nextStops),
            _ => string.Join(", ", nextStops.Take(4))
        };
    }

    private static (string parroquia, string concello) SplitXuntaStopDescription(string stopName)
    {
        var parts = stopName.Split(" -- ", 2);
        if (parts.Length != 2)
        {
            return ("", ""); // TODO: Throw
        }

        return (parts[0], parts[1]);
    }
}
