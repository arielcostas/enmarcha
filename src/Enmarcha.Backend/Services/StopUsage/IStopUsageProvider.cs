namespace Enmarcha.Backend.Services.StopUsage;

public interface IStopUsageProvider
{
    Task<bool> HasUsageDataAsync(string stopId, CancellationToken cancellationToken = default);
    Task<IEnumerable<StopUsageRecord>?> GetUsageAsync(string stopId, CancellationToken cancellationToken = default);
}
