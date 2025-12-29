using System.Net.Http.Json;

namespace Enmarcha.Sources.Tussa;

public class SantiagoRealtimeEstimatesProvider
{
    private HttpClient _http;

    public SantiagoRealtimeEstimatesProvider(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<Route>> GetEstimatesForStop(int stopId)
    {
        var url = GetRequestUrl(stopId.ToString());

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Accept", "application/json");
        request.Headers.Add("User-Agent", "Mozilla/5.0 (compatible; EnMarcha/0.1; https://enmarcha.app)");

        var response = await _http.GetAsync(url);
        var maisbusResponse = await response.Content.ReadFromJsonAsync<MaisbusResponse>();

        if (maisbusResponse is null)
        {
            var responseString = await response.Content.ReadAsStringAsync();
            throw new Exception("Error parsing maisbus response: " + responseString);
        }

        return maisbusResponse.Routes.ToList();
    }

    private static string GetRequestUrl(string stopId)
    {
        return $"https://app.tussa.org/tussa/api/paradas/{stopId}";
    }
}
