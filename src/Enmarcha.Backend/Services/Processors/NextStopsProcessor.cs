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
                    .Select(s => $"{s.Stop.Name} -- {s.Stop.Description}")
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

            // Remove last stop since it doesn't make sense to show "via" for the terminus
            arrival.NextStops = arrival.NextStops.Take(arrival.NextStops.Count - 1).ToList();

            if (feedId == "xunta")
            {
                arrival.OriginStops = otpArrival.Trip.Stoptimes
                    .Where(s => s.ScheduledDeparture < currentStopDeparture)
                    .OrderBy(s => s.ScheduledDeparture)
                    .Take(1)
                    .Select(s => $"{s.Stop.Name} -- {s.Stop.Description}")
                    .Distinct()
                    .ToList();
            }
            else if (feedId == "renfe")
            {
                arrival.OriginStops = otpArrival.Trip.Stoptimes
                    .Where(s => s.ScheduledDeparture < currentStopDeparture)
                    .OrderBy(s => s.ScheduledDeparture)
                    .Take(1)
                    .Select(s => FeedService.NormalizeStopName(feedId, s.Stop.Name))
                    .ToList();
            }

            arrival.Headsign.Marquee = GenerateMarquee(feedId, arrival.NextStops);
            arrival.Headsign.Origin = GenerateOrigin(feedId, arrival.OriginStops);
        }

        return Task.CompletedTask;
    }

    private static string? GenerateMarquee(string feedId, List<string> nextStops)
    {
        if (nextStops.Count == 0) return null;

        if (feedId is "vitrasa" or "tranvias" or "tussa" or "ourense" or "lugo")
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

            List<string> seenConcellos = [];
            List<string> seenParroquias = [];
            List<string> items = [];

            var maxPointsPerCouncil = points.GroupBy(p => p.concello)
                .Select(g => g.Count())
                .DefaultIfEmpty(0)
                .Max();

            if (maxPointsPerCouncil == 1)
            {
                // If there's only one stop per council, we can simplify the marquee to just show the council names
                return string.Join(" - ", points.Select(p => p.nombre).Distinct());
            }

            foreach (var (nombre, parroquia, concello) in points)
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
                        item = $"{item} ({concello})";
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

    private static string? GenerateOrigin(string feedId, List<string> originStops)
    {
        if (originStops.Count == 0) return null;

        if (feedId == "xunta")
        {
            var points = originStops.Select(SplitXuntaStopDescription).ToList();
            var concellos = points
                .Select(p => p.concello)
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return concellos.Count > 0 ? string.Join(" > ", concellos) : null;
        }

        if (feedId == "renfe")
        {
            // For trains just show the origin terminus
            return originStops.First();
        }

        // For local bus feeds, origin is generally not very informative,
        // but return the first stop for completeness
        return originStops.First();
    }

    private static (string nombre, string parroquia, string concello) SplitXuntaStopDescription(string stopName)
    {
        var parts = stopName.Split(" -- ", 3);
        if (parts.Length != 3)
        {
            return ("", "", ""); // TODO: Throw
        }

        return (parts[0], parts[1], parts[2]);
    }
}
