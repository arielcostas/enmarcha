using System.Text.Json;
using Enmarcha.Backend.Types.Arrivals;
using Microsoft.Extensions.Caching.Memory;

namespace Enmarcha.Backend.Services.Processors;

public class VigoUsageProcessor : IArrivalsProcessor
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<VigoUsageProcessor> _logger;
    private readonly FeedService _feedService;

    public VigoUsageProcessor(
        HttpClient httpClient,
        IMemoryCache cache,
        ILogger<VigoUsageProcessor> logger,
        FeedService feedService)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
        _feedService = feedService;
    }

    public async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("vitrasa:") || context.IsReduced || context.IsNano) return;

        var normalizedCode = _feedService.NormalizeStopCode("vitrasa", context.StopCode);

        var cacheKey = $"vigo_usage_{normalizedCode}";
        if (_cache.TryGetValue(cacheKey, out List<BusStopUsagePoint>? cachedUsage))
        {
            context.Usage = cachedUsage;
            return;
        }

        try
        {
            using var activity = Telemetry.Source.StartActivity("FetchVigoUsage");
            var url = $"https://datos.vigo.org/vci_api_app/api2.jsp?tipo=TRANSPORTE_PARADA_HORAS_USO&parada={normalizedCode}";
            var response = await _httpClient.GetAsync(url);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var usage = JsonSerializer.Deserialize<List<BusStopUsagePoint>>(json);

                if (usage != null)
                {
                    _cache.Set(cacheKey, usage, TimeSpan.FromDays(7));
                    context.Usage = usage;
                }
            }
            else
            {
                _logger.LogWarning("Failed to fetch usage data for stop {StopCode}, status: {Status}", normalizedCode, response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching usage data for Vigo stop {StopCode}", normalizedCode);
        }
    }
}
