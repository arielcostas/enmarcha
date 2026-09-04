using Enmarcha.Backend.Dto;

namespace Enmarcha.Backend.Providers.FilterAndSort;

public class GenericFilterAndSortingProvider : IFilterAndSortingProvider
{
    public List<StopEstimate> FilterAndSort(List<StopEstimate> estimates, bool acceptsPastEstimates)
    {
        return estimates.Where(e => e.Estimate.Minutes > 0)
            .OrderBy(e => e.Estimate.Minutes)
            .ThenByDescending(e => e.Estimate.DelayMinutes)
            .ToList();
    }
}
