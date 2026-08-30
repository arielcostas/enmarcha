namespace Enmarcha.Backend.Providers.StopUsage;

public class NullStopUsageProvider : IStopUsageProvider
{
    public Task<bool> HasUsageDataAsync(
        string gtfsId,
        CancellationToken cancellationToken = default
    )
    {
        return Task.FromResult(false);
    }

    public Task<IEnumerable<StopUsageRecord>?> GetUsageAsync(
        string gtfsId,
        CancellationToken cancellationToken = default
    )
    {
        return Task.FromResult<IEnumerable<StopUsageRecord>?>(null);
    }
}
