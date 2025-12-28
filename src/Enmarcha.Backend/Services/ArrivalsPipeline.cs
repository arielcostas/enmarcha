using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services;

public class ArrivalsContext
{
    /// <summary>
    /// The full GTFS ID of the stop (e.g., "vitrasa:1400")
    /// </summary>
    public required string StopId { get; set; }

    /// <summary>
    /// The public code of the stop (e.g., "1400")
    /// </summary>
    public required string StopCode { get; set; }

    /// <summary>
    /// Whether to return a reduced number of arrivals (e.g., 4 instead of 10)
    /// </summary>
    public bool IsReduced { get; set; }

    public Position? StopLocation { get; set; }

    public required List<Arrival> Arrivals { get; set; }
    public required DateTime NowLocal { get; set; }
}

public interface IArrivalsProcessor
{
    /// <summary>
    /// Processes the arrivals in the context. Processors are executed in the order they are registered.
    /// </summary>
    Task ProcessAsync(ArrivalsContext context);
}

/// <summary>
/// Orchestrates the enrichment of arrival data through a series of processors.
/// This follows a pipeline pattern where each step (processor) adds or modifies data
/// in the shared ArrivalsContext.
/// </summary>
public class ArrivalsPipeline
{
    private readonly IEnumerable<IArrivalsProcessor> _processors;

    public ArrivalsPipeline(IEnumerable<IArrivalsProcessor> processors)
    {
        _processors = processors;
    }

    /// <summary>
    /// Executes all registered processors sequentially.
    /// </summary>
    public async Task ExecuteAsync(ArrivalsContext context)
    {
        foreach (var processor in _processors)
        {
            await processor.ProcessAsync(context);
        }
    }
}
