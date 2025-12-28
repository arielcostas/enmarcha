using Enmarcha.Backend.Types.Planner;

namespace Enmarcha.Backend.Services;

public interface IGeocodingService
{
    Task<List<PlannerSearchResult>> GetAutocompleteAsync(string query);
    Task<PlannerSearchResult?> GetReverseGeocodeAsync(double lat, double lon);
}
