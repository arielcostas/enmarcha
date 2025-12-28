using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services.Processors;

/// <summary>
/// Filters and sorts the arrivals based on the feed and the requested limit.
/// This should run after real-time matching but before heavy enrichment (shapes, marquee).
/// </summary>
public class FilterAndSortProcessor : IArrivalsProcessor
{
    public Task ProcessAsync(ArrivalsContext context)
    {
        var feedId = context.StopId.Split(':')[0];

        // 1. Sort by minutes
        var sorted = context.Arrivals
            .OrderBy(a => a.Estimate.Minutes)
            .ToList();

        // 2. Filter based on feed rules
        var filtered = sorted.Where(a =>
        {
            if (feedId == "vitrasa")
            {
                // For Vitrasa, we hide past arrivals because we have real-time
                // If a past arrival was matched to a real-time estimate, its Minutes will be >= 0
                return a.Estimate.Minutes >= 0;
            }

            // For others, show up to 10 minutes ago
            return a.Estimate.Minutes >= -10;
        }).ToList();

        // 3. Limit results
        var limit = context.IsReduced ? 4 : 10;
        var limited = filtered.Take(limit).ToList();

        // Update the context list in-place
        context.Arrivals.Clear();
        context.Arrivals.AddRange(limited);

        return Task.CompletedTask;
    }
}
