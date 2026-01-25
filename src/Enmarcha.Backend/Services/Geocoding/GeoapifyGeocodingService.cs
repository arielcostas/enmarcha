using System.Globalization;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Types.Geoapify;
using Enmarcha.Backend.Types.Planner;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Services.Geocoding;

public class GeoapifyGeocodingService : IGeocodingService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GeoapifyGeocodingService> _logger;
    private readonly AppConfiguration _config;

    private static readonly string[] ForbiddenResultTypes = ["city", "state", "county", "postcode"];

    public GeoapifyGeocodingService(HttpClient httpClient, IMemoryCache cache, ILogger<GeoapifyGeocodingService> logger, IOptions<AppConfiguration> config)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
        _config = config.Value;

        // Geoapify requires a User-Agent
        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Compatible; Enmarcha/0.1; https://enmarcha.app; ariel@costas.dev)");
        }
    }

    public async Task<List<PlannerSearchResult>> GetAutocompleteAsync(string query)
    {
        using var activity = Telemetry.Source.StartActivity("GeoapifyAutocomplete");
        activity?.SetTag("query", query);

        if (string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        var cacheKey = $"nominatim_autocomplete_{query.ToLowerInvariant()}";
        var cacheHit = _cache.TryGetValue(cacheKey, out List<PlannerSearchResult>? cachedResults);
        activity?.SetTag("cache.hit", cacheHit);

        if (cacheHit && cachedResults != null)
        {
            return cachedResults;
        }

        var url = $"https://api.geoapify.com/v1/geocode/autocomplete?text={Uri.EscapeDataString(query)}&lang=gl&limit=5&filter=rect:-9.449497230816405,41.89720361654395,-6.581039728137625,43.92616367306067&format=json";

        try
        {
            var response = await _httpClient.GetFromJsonAsync<GeoapifyResult>(url + $"&apiKey={_config.GeoapifyApiKey}");


            var results = response?.results
                .Where(x => !ForbiddenResultTypes.Contains(x.result_type))
                .Select(MapToPlannerSearchResult)
                .ToList() ?? [];

            activity?.SetTag("results.count", results.Count);
            _cache.Set(cacheKey, results, TimeSpan.FromMinutes(60));
            return results;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, ex.Message);
            _logger.LogError(ex, "Error fetching Geoapify autocomplete results from {Url}", url);
            return new List<PlannerSearchResult>();
        }
    }

    public async Task<PlannerSearchResult?> GetReverseGeocodeAsync(double lat, double lon)
    {
        using var activity = Telemetry.Source.StartActivity("GeoapifyReverseGeocode");
        activity?.SetTag("lat", lat);
        activity?.SetTag("lon", lon);

        var cacheKey = $"nominatim_reverse_{lat:F5}_{lon:F5}";
        var cacheHit = _cache.TryGetValue(cacheKey, out PlannerSearchResult? cachedResult);
        activity?.SetTag("cache.hit", cacheHit);

        if (cacheHit && cachedResult != null)
        {
            return cachedResult;
        }

        var url =
            $"https://api.geoapify.com/v1/geocode/reverse?lat={lat.ToString(CultureInfo.InvariantCulture)}&lon={lon.ToString(CultureInfo.InvariantCulture)}&lang=gl&format=json";
        try
        {
            var response = await _httpClient.GetFromJsonAsync<GeoapifyResult>(url + $"&apiKey={_config.GeoapifyApiKey}");

            if (response == null) return null;

            var result = MapToPlannerSearchResult(response.results[0]);

            _cache.Set(cacheKey, result, TimeSpan.FromMinutes(60));
            return result;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, ex.Message);
            _logger.LogError(ex, "Error fetching Geoapify reverse geocode results from {Url}", url);
            return null;
        }
    }

    private PlannerSearchResult MapToPlannerSearchResult(Result result)
    {
        var name = result.name ?? result.address_line1;
        var label = $"{result.street} ({result.postcode} {result.city}, {result.county})";

        return new PlannerSearchResult
        {
            Name = name,
            Label = label,
            Lat = result.lat,
            Lon = result.lon,
            Layer = result.result_type
        };
    }
}
