using Costasdev.VigoTransitApi;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Services.Providers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api/vigo")]
public partial class VigoController : ControllerBase
{
    private readonly ILogger<VigoController> _logger;
    private readonly VigoTransitApiClient _api;
    private readonly AppConfiguration _configuration;
    private readonly ShapeTraversalService _shapeService;
    private readonly VitrasaTransitProvider _vitrasaProvider;
    private readonly RenfeTransitProvider _renfeProvider;

    public VigoController(
        HttpClient http,
        IOptions<AppConfiguration> options,
        ILogger<VigoController> logger,
        ShapeTraversalService shapeService,
        VitrasaTransitProvider vitrasaProvider,
        RenfeTransitProvider renfeProvider)
    {
        _logger = logger;
        _api = new VigoTransitApiClient(http);
        _configuration = options.Value;
        _shapeService = shapeService;
        _vitrasaProvider = vitrasaProvider;
        _renfeProvider = renfeProvider;
    }

    [HttpGet("GetConsolidatedCirculations")]
    public async Task<IActionResult> GetConsolidatedCirculations(
        [FromQuery] string stopId
    )
    {
        // Use Europe/Madrid timezone consistently to avoid UTC/local skew
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
        var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);

        ITransitProvider provider;
        string effectiveStopId;

        if (stopId.StartsWith("renfe:"))
        {
            provider = _renfeProvider;
            effectiveStopId = stopId.Substring("renfe:".Length);
        }
        else if (stopId.StartsWith("vitrasa:"))
        {
            provider = _vitrasaProvider;
            effectiveStopId = stopId.Substring("vitrasa:".Length);
        }
        else
        {
            // Legacy/Default
            provider = _vitrasaProvider;
            effectiveStopId = stopId;
        }

        var result = await provider.GetCirculationsAsync(effectiveStopId, nowLocal);
        return Ok(result);
    }
}
