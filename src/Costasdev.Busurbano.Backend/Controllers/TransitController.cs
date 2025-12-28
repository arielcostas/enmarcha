using Costasdev.Busurbano.Backend.Configuration;
using Costasdev.Busurbano.Backend.Helpers;
using Costasdev.Busurbano.Backend.Services;
using Costasdev.Busurbano.Backend.Types.Transit;
using Costasdev.Busurbano.Sources.OpenTripPlannerGql;
using Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Costasdev.Busurbano.Backend.Controllers;

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
        if (feeds.Length == 0)
        {
            feeds = ["santiago", "vitrasa", "coruna", "feve"];
        }

        var serviceDate = DateTime.Now.ToString("yyyy-MM-dd");
        var cacheKey = $"routes_{string.Join("_", feeds)}_{serviceDate}";
        if (_cache.TryGetValue(cacheKey, out List<RouteDto>? cachedRoutes))
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
                .Where(r => r.TripCount > 0)
                .OrderBy(r => r.ShortName, Comparer<string?>.Create(SortingHelper.SortRouteShortNames))
                .ToList();

            _cache.Set(cacheKey, routes, TimeSpan.FromHours(1));

            return Ok(routes);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error fetching routes");
            return StatusCode(500, "An error occurred while fetching routes.");
        }
    }

    [HttpGet("routes/{id}")]
    public async Task<ActionResult<RouteDetailsDto>> GetRouteDetails(string id)
    {
        var serviceDate = DateTime.Now.ToString("yyyy-MM-dd");
        var cacheKey = $"route_details_{id}_{serviceDate}";

        if (_cache.TryGetValue(cacheKey, out RouteDetailsDto? cachedDetails))
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
            _logger.LogError(e, "Error fetching route details for {Id}", id);
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
