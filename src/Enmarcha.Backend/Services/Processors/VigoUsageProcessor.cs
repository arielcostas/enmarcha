using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using Enmarcha.Backend.Types.Arrivals;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;

namespace Enmarcha.Backend.Services.Processors;

public class VigoUsageProcessor : IArrivalsProcessor
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<VigoUsageProcessor> _logger;
    private readonly IHostEnvironment _environment;
    private readonly FeedService _feedService;
    private static readonly HashSet<string> _vigoStopsWhitelist = [];
    private static bool _whitelistLoaded = false;
    private static readonly object _lock = new();

    public VigoUsageProcessor(
        HttpClient httpClient,
        IMemoryCache cache,
        ILogger<VigoUsageProcessor> logger,
        IHostEnvironment environment,
        FeedService feedService)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
        _environment = environment;
        _feedService = feedService;

        LoadWhitelist();
    }

    private void LoadWhitelist()
    {
        if (_whitelistLoaded) return;

        lock (_lock)
        {
            if (_whitelistLoaded) return;

            try
            {
                var path = Path.Combine(_environment.ContentRootPath, "Data", "vitrasa_stops_p95.csv");
                if (File.Exists(path))
                {
                    using var reader = new StreamReader(path);
                    using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);
                    csv.Read();
                    csv.ReadHeader();
                    while (csv.Read())
                    {
                        var code = csv.GetField("codigo");
                        if (!string.IsNullOrWhiteSpace(code))
                        {
                            _vigoStopsWhitelist.Add(code.Trim());
                        }
                    }
                    _logger.LogInformation("Loaded {Count} Vigo stops for usage data whitelist", _vigoStopsWhitelist.Count);
                }
                else
                {
                    _logger.LogWarning("Vigo stops whitelist CSV not found at {Path}", path);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading Vigo stops whitelist");
            }
            finally
            {
                _whitelistLoaded = true;
            }
        }
    }

    public async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("vitrasa:")) return;

        var normalizedCode = _feedService.NormalizeStopCode("vitrasa", context.StopCode);
        if (!_vigoStopsWhitelist.Contains(normalizedCode)) return;

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
