using Enmarcha.Backend.Dto;

namespace Enmarcha.Backend.Providers.FilterAndSort;

public class XuntaFilterAndSortingProvider : IFilterAndSortingProvider
{
    public List<StopEstimate> FilterAndSort(List<StopEstimate> estimates, bool acceptsPastEstimates)
    {
        var minutesToFilter = acceptsPastEstimates ? -20 : 0;

        return estimates.Where(e => e.Estimate.Minutes > minutesToFilter)
            .OrderBy(e => e.Estimate.Minutes)
            .ThenByDescending(e => e.Estimate.DelayMinutes)
            .ToList();
    }
}
