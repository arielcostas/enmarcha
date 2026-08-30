namespace Enmarcha.Backend.Providers.StopUsage;

public interface IStopUsageProvider
{
    Task<bool> HasUsageDataAsync(string gtfsId, CancellationToken cancellationToken = default);
    Task<IEnumerable<StopUsageRecord>?> GetUsageAsync(string gtfsId, CancellationToken cancellationToken = default);
}
