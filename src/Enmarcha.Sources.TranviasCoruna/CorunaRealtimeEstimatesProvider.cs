using System.Net.Http.Json;

namespace Enmarcha.Sources.TranviasCoruna;

public class CorunaRealtimeEstimatesProvider
{
    private HttpClient _http;

    public CorunaRealtimeEstimatesProvider(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<CorunaEstimate>> GetEstimatesForStop(int stopId)
    {
        var url = GetRequestUrl(stopId.ToString());

        var response = await _http.GetAsync(url);
        var queryitrResponse = await response.Content.ReadFromJsonAsync<QueryitrResponse>();

        if (queryitrResponse is null)
        {
            var responseString = await response.Content.ReadAsStringAsync();
            throw new Exception("Error parsing queryitr_v3 response: " + responseString);
        }

        return queryitrResponse.ArrivalInfo.Routes.SelectMany(r =>
        {
            return r.Arrivals.Select(arrival =>
            {
                var minutes = arrival.Minutes == "<1" ? 0 : int.Parse(arrival.Minutes);
                var metres = arrival.Metres == "--" ? 0 : int.Parse(arrival.Metres);

                return new CorunaEstimate
                (
                    r.RouteId.ToString(),
                    minutes,
                    metres,
                    arrival.VehicleNumber.ToString()
                );
            }).ToList();
        }).OrderBy(a => a.Minutes).ToList();
    }

    private static string GetRequestUrl(string stopId)
    {
        return $"https://itranvias.com/queryitr_v3.php?&func=0&dato={stopId}";
    }
}

public record CorunaEstimate(string RouteId, int Minutes, int Metres, string VehicleNumber);
