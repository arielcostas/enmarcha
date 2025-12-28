using System.Net;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types.Planner;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api/planner")]
public partial class RoutePlannerController : ControllerBase
{
    private readonly ILogger<RoutePlannerController> _logger;
    private readonly OtpService _otpService;
    private readonly IGeocodingService _geocodingService;
    private readonly AppConfiguration _config;
    private readonly HttpClient _httpClient;

    public RoutePlannerController(
        ILogger<RoutePlannerController> logger,
        OtpService otpService,
        IGeocodingService geocodingService,
        IOptions<AppConfiguration> config,
        HttpClient httpClient
    )
    {
        _logger = logger;
        _otpService = otpService;
        _geocodingService = geocodingService;
        _config = config.Value;
        _httpClient = httpClient;
    }

    [HttpGet("autocomplete")]
    public async Task<ActionResult<List<PlannerSearchResult>>> Autocomplete([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty");
        }

        var results = await _geocodingService.GetAutocompleteAsync(query);
        return Ok(results);
    }

    [HttpGet("reverse")]
    public async Task<ActionResult<PlannerSearchResult>> Reverse([FromQuery] double lat, [FromQuery] double lon)
    {
        var result = await _geocodingService.GetReverseGeocodeAsync(lat, lon);
        if (result == null)
        {
            return NotFound();
        }
        return Ok(result);
    }

    [HttpGet("plan")]
    public async Task<ActionResult<RoutePlan>> Plan(
        [FromQuery] double fromLat,
        [FromQuery] double fromLon,
        [FromQuery] double toLat,
        [FromQuery] double toLon,
        [FromQuery] DateTimeOffset? time,
        [FromQuery] bool arriveBy = false)
    {
        try
        {
            var requestContent = PlanConnectionContent.Query(
                new PlanConnectionContent.Args(fromLat, fromLon, toLat, toLon, time ?? DateTimeOffset.Now, arriveBy)
            );

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
            request.Content = JsonContent.Create(new GraphClientRequest
            {
                Query = requestContent
            });

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<PlanConnectionResponse>>();

            if (responseBody is not { IsSuccess: true })
            {
                LogErrorFetchingRoutes(response.StatusCode, await response.Content.ReadAsStringAsync());
                return StatusCode(500, "An error occurred while planning the route.");
            }

            var plan = _otpService.MapPlanResponse(responseBody.Data!);
            return Ok(plan);
        }
        catch (Exception e)
        {
            _logger.LogError("Exception planning route: {e}", e);
            return StatusCode(500, "An error occurred while planning the route.");
        }
    }

    [LoggerMessage(LogLevel.Error, "Error fetching route planning, received {statusCode} {responseBody}")]
    partial void LogErrorFetchingRoutes(HttpStatusCode? statusCode, string responseBody);
}
