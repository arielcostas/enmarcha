using Costasdev.Busurbano.Backend.GraphClient;
using Costasdev.Busurbano.Backend.GraphClient.App;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Costasdev.Busurbano.Backend.Controllers;

[ApiController]
[Route("api")]
public class ArrivalsController : ControllerBase
{
    private readonly ILogger<ArrivalsController> _logger;
    private readonly IMemoryCache _cache;
    private readonly HttpClient _httpClient;

    public ArrivalsController(
        ILogger<ArrivalsController> logger,
        IMemoryCache cache,
        HttpClient httpClient
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
    }

    [HttpGet("arrivals")]
    public async Task<IActionResult> GetArrivals(string id)
    {
        var requestContent = ArrivalsAtStopContent.Query(id);
        var request = new HttpRequestMessage(HttpMethod.Post, "http://100.67.54.115:3957/otp/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = requestContent
        });

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<ArrivalsAtStopResponse>>();

        if (responseBody is not { IsSuccess: true })
        {
            _logger.LogError(
                "Error fetching stop data, received {StatusCode} {ResponseBody}",
                response.StatusCode,
                await response.Content.ReadAsStringAsync()
            );
            return StatusCode(500, "Error fetching stop data");
        }

        return Ok(responseBody.Data?.Stop);
    }
}
