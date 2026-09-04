using Enmarcha.Backend.Dto;

namespace Enmarcha.Backend.Providers.FilterAndSort;

public interface IFilterAndSortingProvider
{
    List<StopEstimate> FilterAndSort(List<StopEstimate> estimates, bool acceptsPastEstimates);
}
