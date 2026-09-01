using Enmarcha.Backend.Providers.StopUsage;

namespace Enmarcha.Backend.Dto;

public class StopUsageResponse
{
    public required IEnumerable<StopUsageRecord> Usage { get; set; }
}
