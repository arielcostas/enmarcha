using System.Net.Http.Json;

namespace Enmarcha.Sources.CtagShuttle;

public class CtagShuttleRealtimeEstimatesProvider
{
    private HttpClient _http;

    public CtagShuttleRealtimeEstimatesProvider(HttpClient http)
    {
        _http = http;
    }

    public async Task<CtagShuttleStatus> GetShuttleStatus()
    {
        const string url = "https://shuttle.brain4mobility.com/status";

        var response = await _http.GetAsync(url);
        var status = await response.Content.ReadFromJsonAsync<CtagShuttleStatus>();

        if (status is null)
        {
            throw new InvalidOperationException("Failed to retrieve shuttle status");
        }

        return status;
    }

}

