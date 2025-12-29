using System.Globalization;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Types.Nominatim;
using Enmarcha.Backend.Types.Planner;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Services;

public class NominatimGeocodingService : IGeocodingService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<NominatimGeocodingService> _logger;
    private readonly AppConfiguration _config;

    private const string GaliciaBounds = "-9.3,43.8,-6.7,41.7";

    public NominatimGeocodingService(HttpClient httpClient, IMemoryCache cache, ILogger<NominatimGeocodingService> logger, IOptions<AppConfiguration> config)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
        _config = config.Value;

        // Nominatim requires a User-Agent
        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Compatible; Enmarcha/0.1; https://enmarcha.app)");
        }
    }

    public async Task<List<PlannerSearchResult>> GetAutocompleteAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return new List<PlannerSearchResult>();

        var cacheKey = $"nominatim_autocomplete_{query.ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out List<PlannerSearchResult>? cachedResults) && cachedResults != null)
        {
            return cachedResults;
        }

        try
        {
            var url = $"{_config.NominatimBaseUrl}/search?q={Uri.EscapeDataString(query)}&format=jsonv2&viewbox={GaliciaBounds}&bounded=1&countrycodes=es&addressdetails=1";
            var response = await _httpClient.GetFromJsonAsync<List<NominatimSearchResult>>(url);

            var results = response?.Select(MapToPlannerSearchResult).ToList() ?? new List<PlannerSearchResult>();

            _cache.Set(cacheKey, results, TimeSpan.FromMinutes(30));
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Nominatim autocomplete results from {Url}", _config.NominatimBaseUrl);
            return new List<PlannerSearchResult>();
        }
    }

    public async Task<PlannerSearchResult?> GetReverseGeocodeAsync(double lat, double lon)
    {
        var cacheKey = $"nominatim_reverse_{lat:F5}_{lon:F5}";
        if (_cache.TryGetValue(cacheKey, out PlannerSearchResult? cachedResult) && cachedResult != null)
        {
            return cachedResult;
        }

        try
        {
            var url = $"{_config.NominatimBaseUrl}/reverse?lat={lat.ToString(CultureInfo.InvariantCulture)}&lon={lon.ToString(CultureInfo.InvariantCulture)}&format=jsonv2&addressdetails=1";
            var response = await _httpClient.GetFromJsonAsync<NominatimSearchResult>(url);

            if (response == null) return null;

            var result = MapToPlannerSearchResult(response);

            _cache.Set(cacheKey, result, TimeSpan.FromMinutes(60));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Nominatim reverse geocode results from {Url}", _config.NominatimBaseUrl);
            return null;
        }
    }

    private PlannerSearchResult MapToPlannerSearchResult(NominatimSearchResult result)
    {
        var name = result.Address?.Road ?? result.DisplayName?.Split(',').FirstOrDefault();
        var label = result.DisplayName;

        return new PlannerSearchResult
        {
            Name = name,
            Label = label,
            Lat = double.TryParse(result.Lat, CultureInfo.InvariantCulture, out var lat) ? lat : 0,
            Lon = double.TryParse(result.Lon, CultureInfo.InvariantCulture, out var lon) ? lon : 0,
            Layer = result.Type
        };
    }
}
