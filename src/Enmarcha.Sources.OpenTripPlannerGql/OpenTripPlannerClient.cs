using System.Net.Http.Json;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Microsoft.Extensions.Logging;

namespace Enmarcha.Sources.OpenTripPlannerGql;

public class OpenTripPlannerClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly ILogger<OpenTripPlannerClient> _logger;

    public OpenTripPlannerClient(
        HttpClient httpClient,
        string baseUrl,
        ILogger<OpenTripPlannerClient> logger
    )
    {
        _httpClient = httpClient;
        _baseUrl = baseUrl;
        _logger = logger;
    }

    public async Task GetStopsInBbox(double minLat, double minLon, double maxLat, double maxLon)
    {
        var requestContent =
            StopTileRequestContent.Query(new StopTileRequestContent.Bbox(minLon, minLat, maxLon, maxLat));

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = requestContent
        });

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopTileResponse>>();

        if (responseBody is not { IsSuccess: true })
        {
            _logger.LogError(
                "Error fetching stop data, received {StatusCode} {ResponseBody}",
                response.StatusCode,
                await response.Content.ReadAsStringAsync()
            );
        }
    }
}
