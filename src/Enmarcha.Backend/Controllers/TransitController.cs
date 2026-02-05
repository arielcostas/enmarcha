using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types.Transit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Globalization;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api/transit")]
public class TransitController : ControllerBase
{
    private readonly ILogger<TransitController> _logger;
    private readonly OtpService _otpService;
    private readonly AppConfiguration _config;
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;

    public TransitController(
        ILogger<TransitController> logger,
        OtpService otpService,
        IOptions<AppConfiguration> config,
        HttpClient httpClient,
        IMemoryCache cache
    )
    {
        _logger = logger;
        _otpService = otpService;
        _config = config.Value;
        _httpClient = httpClient;
        _cache = cache;
    }

    [HttpGet("routes")]
    public async Task<ActionResult<List<RouteDto>>> GetRoutes([FromQuery] string[] feeds)
    {
        using var activity = Telemetry.Source.StartActivity("GetRoutes");
        if (feeds.Length == 0)
        {
            feeds = ["tussa", "vitrasa", "tranvias", "feve", "shuttle"];
        }
        activity?.SetTag("feeds", string.Join(",", feeds));

        var serviceDate = DateTime.Now.ToString("yyyy-MM-dd");
        var cacheKey = $"routes_{string.Join("_", feeds)}_{serviceDate}";
        var cacheHit = _cache.TryGetValue(cacheKey, out List<RouteDto>? cachedRoutes);
        activity?.SetTag("cache.hit", cacheHit);

        if (cacheHit && cachedRoutes != null)
        {
            return Ok(cachedRoutes);
        }

        try
        {
            var query = RoutesListContent.Query(new RoutesListContent.Args(feeds, serviceDate));
            var response = await SendOtpQueryAsync<RoutesListResponse>(query);

            if (response?.Data == null)
            {
                return StatusCode(500, "Failed to fetch routes from OTP.");
            }

            var routes = response.Data.Routes
                .Select(_otpService.MapRoute)
                .OrderBy(r => r.ShortName, Comparer<string?>.Create(SortingHelper.SortRouteShortNames))
                .ToList();

            _cache.Set(cacheKey, routes, TimeSpan.FromHours(1));

            return Ok(routes);
        }
        catch (Exception e)
        {
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, e.Message);
            _logger.LogError(e, "Error fetching routes");
            return StatusCode(500, "An error occurred while fetching routes.");
        }
    }

    [HttpGet("routes/{id}")]
    public async Task<ActionResult<RouteDetailsDto>> GetRouteDetails(
        string id,
        [FromQuery] string? date
    )
    {
        using var activity = Telemetry.Source.StartActivity("GetRouteDetails");
        activity?.SetTag("route.id", id);

        string serviceDate;
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
            {
                return BadRequest("Invalid date. Use yyyy-MM-dd.");
            }

            serviceDate = parsedDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        else
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
            var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);
            serviceDate = nowLocal.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        var cacheKey = $"route_details_{id}_{serviceDate}";

        var cacheHit = _cache.TryGetValue(cacheKey, out RouteDetailsDto? cachedDetails);
        activity?.SetTag("cache.hit", cacheHit);

        if (cacheHit && cachedDetails != null)
        {
            return Ok(cachedDetails);
        }

        try
        {
            var query = RouteDetailsContent.Query(new RouteDetailsContent.Args(id, serviceDate));
            var response = await SendOtpQueryAsync<RouteDetailsResponse>(query);

            if (response?.Data?.Route == null)
            {
                return NotFound();
            }

            var details = _otpService.MapRouteDetails(response.Data.Route);
            _cache.Set(cacheKey, details, TimeSpan.FromHours(1));

            return Ok(details);
        }
        catch (Exception e)
        {
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, e.Message); _logger.LogError(e, "Error fetching route details for {Id}", id);
            return StatusCode(500, "An error occurred while fetching route details.");
        }
    }

    private async Task<GraphClientResponse<T>?> SendOtpQueryAsync<T>(string query) where T : AbstractGraphResponse
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest { Query = query });

        var response = await _httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("OTP query failed with status {StatusCode}", response.StatusCode);
            return null;
        }

        return await response.Content.ReadFromJsonAsync<GraphClientResponse<T>>();
    }
}
