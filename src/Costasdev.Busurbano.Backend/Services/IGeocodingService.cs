using Costasdev.Busurbano.Backend.Types.Planner;

namespace Costasdev.Busurbano.Backend.Services;

public interface IGeocodingService
{
    Task<List<PlannerSearchResult>> GetAutocompleteAsync(string query);
    Task<PlannerSearchResult?> GetReverseGeocodeAsync(double lat, double lon);
}
