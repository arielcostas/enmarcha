using System.Net.Http.Json;

namespace Enmarcha.Sources.Renfe;

public class RenfeRealtimeEstimatesProvider
{
    private HttpClient _http;

    public RenfeRealtimeEstimatesProvider(HttpClient http)
    {
        _http = http;
    }

    public async Task<Dictionary<string, Train>> GetTrainInformation()
    {
        const string url = "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json";

        var response = await _http.GetAsync(url);
        var status = await response.Content.ReadFromJsonAsync<RenfeStatus>();

        if (status is null)
        {
            throw new InvalidOperationException("Failed to retrieve Renfe status");
        }

        return status.Trenes.ToDictionary(
            k => k.TrainCode,
            v => v
        );
    }
}
