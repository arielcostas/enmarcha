using System.Net.Http.Json;

namespace Enmarcha.Sources.Tussa;

public class SantiagoRealtimeEstimatesProvider
{
    private HttpClient _http;

    public SantiagoRealtimeEstimatesProvider(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<SantiagoEstimate>> GetEstimatesForStop(int stopId)
    {
        var url = GetRequestUrl(stopId.ToString());

        var response = await _http.GetAsync(url);
        var maisbusResponse = await response.Content.ReadFromJsonAsync<MaisbusResponse>();

        if (maisbusResponse is null)
        {
            var responseString = await response.Content.ReadAsStringAsync();
            throw new Exception("Error parsing maisbus response: " + responseString);
        }

        return maisbusResponse.Routes.Select(r => new SantiagoEstimate
        (
            r.Id.ToString(),
            r.MinutesToArrive
        )).OrderBy(a => a.Minutes).ToList();
    }

    private static string GetRequestUrl(string stopId)
    {
        return $"https://tussa.gal/maisbus/api/stop/{stopId}";
    }
}

public record SantiagoEstimate(string RouteId, int Minutes);
