using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Exceptions;
using FuzzySharp;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Enmarcha.Backend.Controllers.Version2;

[ApiController]
[Route("api/v2/stops")]
public class StopsController : ControllerBase
{
    private readonly ILogger<StopsController> _logger;
    private readonly OpenTripPlannerClient _otpClient;
    private readonly IMemoryCache _cache;

    public StopsController(
        ILogger<StopsController> logger,
        OpenTripPlannerClient otpClient,
        IMemoryCache cache
    )
    {
        _logger = logger;
        _otpClient = otpClient;
        _cache = cache;
    }


    [HttpGet("")]
    public async Task<IActionResult> SearchStops([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Problem(
                "Query parameter 'q' (query) is compulsory",
                type: "urn:enmarcha#MissingCompulsoryArgument",
                statusCode: 400
            );
        }

        const string cacheKey = "arrivals_search_mapped_stops";
        var allStopsBasics = await _cache.GetOrCreateAsync(cacheKey, async (item) =>
        {
            var result = await _otpClient.GetAllStopsBasics();

            return result.Stops;
        });

        if (allStopsBasics is null)
        {
            return Problem("Unable to retrieve stops", statusCode: 500);
        }

        // 1. Exact or prefix matches by stop code
        var codeMatches = allStopsBasics
            .Where(s => s.Code != null && s.Code.StartsWith(q, StringComparison.OrdinalIgnoreCase))
            .OrderBy(s => s.Code?.Length)
            .Take(10)
            .ToList();

        // 2. Fuzzy search stops by label
        var fuzzyResults = Process.ExtractSorted(
            q,
            allStopsBasics.Select(s => $"{s.Name} {s.Code}"),
            cutoff: 60
        ).Take(10).Select(r => allStopsBasics[r.Index]).ToList();

        // Combine and deduplicate
        var results = codeMatches.Concat(fuzzyResults)
            .GroupBy(s => s.Code)
            .Select(g => g.First())
            .Take(10)
            .ToList();

        return Ok(results);
    }

    [HttpGet("{id}")]
    [ResponseCache(VaryByQueryKeys = [nameof(id)], Duration = 60 * 5)]
    public async Task<IActionResult> GetStopBasics(
        [FromRoute] string id
    )
    {
        try
        {
            var stopBasics = await _otpClient.GetStopBasics(id);
            if (stopBasics.Stop is not null)
            {
                return Ok(stopBasics.Stop);
            }

            return NotFound();
        }
        catch (OpenTripPlannerConnectionException e)
        {
            _logger.LogError(e, "Connection error from OpenTripPlanner");
            return Problem(
                e.Message,
                type: "urn:enmarcha#OpenTripPlannerConnectionException"
            );
        }
        catch (OpenTripPlannerErrorException e)
        {
            _logger.LogError(e, "Errors returned by OpenTripPlann");
            return Problem(
                e.Message,
                type: "urn:enmarcha#OpenTripPlannerError"
            );
        }
    }

    [HttpGet("{id}/usage")]
    public async Task<IActionResult> GetStopUsage(
        [FromRoute] string id
    )
    {
        try
        {
            var stopBasics = await _otpClient.GetStopBasics(id);
            return Ok(stopBasics.Stop);
        }
        catch (OpenTripPlannerConnectionException e)
        {
            _logger.LogError(e, "Connection error from OpenTripPlanner");
            return Problem(
                e.Message,
                type: "urn:enmarcha#OpenTripPlannerConnectionException"
            );
        }
        catch (OpenTripPlannerErrorException e)
        {
            _logger.LogError(e, "Errors returned by OpenTripPlann");
            return Problem(
                e.Message,
                type: "urn:enmarcha#OpenTripPlannerError"
            );
        }
    }
}
