using System.Net.Http.Json;

namespace Enmarcha.Sources.Xunta;

public class XuntaRealtimeEstimatesProvider
{
    private HttpClient _http;

    public XuntaRealtimeEstimatesProvider(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<VehiclePositions>> GetEstimatesForAgencies(string[] agencyIds)
    {
        var chunks = agencyIds.Chunk(5);

        List<CompanyResponse> allResponses = [];

        var tasks = chunks.Select(async c =>
        {
            var request = new HttpRequestMessage(
                HttpMethod.Post,
                "https://www.mobt.xunta.gal/api/meep/tripplan/api/v1/rtprocessor/galicia/vehiclePositions"
            );
            request.Headers.Add("Accept", "application/json");
            request.Headers.Add("User-Agent", "Mozilla/5.0 (compatible; EnMarcha/0.1; https://enmarcha.app)");

            request.Content = JsonContent.Create(new
            {
                minX = -15,
                minY = 40,
                maxX = 10,
                maxY = 45,
                companyZoneIds = c
            });

            var response = await _http.SendAsync(request);
            response.EnsureSuccessStatusCode();
            allResponses.AddRange(await response.Content.ReadFromJsonAsync<List<CompanyResponse>>() ??
                                  []); // TODO: Error handling
        });

        Task.WaitAll(tasks);

        return allResponses.SelectMany(r => r.vehiclePositions).ToList();
    }
}
