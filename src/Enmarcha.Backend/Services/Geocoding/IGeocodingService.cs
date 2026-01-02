using Enmarcha.Backend.Types.Planner;

namespace Enmarcha.Backend.Services.Geocoding;

public interface IGeocodingService
{
    Task<List<PlannerSearchResult>> GetAutocompleteAsync(string query);
    Task<PlannerSearchResult?> GetReverseGeocodeAsync(double lat, double lon);
}
