using System.Text.Json;
using System.Text.Json.Serialization;
using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Providers.StopUsage;

public class VitrasaStopUsageProvider : IStopUsageProvider
{
    private readonly HttpClient _httpClient;

    public VitrasaStopUsageProvider(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public Task<bool> HasUsageDataAsync(
        string gtfsId,
        CancellationToken cancellationToken = default
    )
    {
        return Task.FromResult(true);
    }

    public async Task<IEnumerable<StopUsageRecord>?> GetUsageAsync(
        string gtfsId,
        CancellationToken cancellationToken = default
    )
    {
        var stopId = gtfsId.Split(":", 2)[1]; // TODO: Unify this split logic somehow

        var url = $"https://datos.vigo.org/vci_api_app/api2.jsp?tipo=TRANSPORTE_PARADA_HORAS_USO&parada={stopId}";
        var response = await _httpClient.GetAsync(url, cancellationToken);

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var usage = JsonSerializer.Deserialize<List<BusStopUsagePoint>>(json);

        if (usage is null)
        {
            throw new Exception(""); // FIXME: Proper exception handling
        }

        return usage.Select(u => new StopUsageRecord
        {
            DayOfWeek = u.Day, // Vigo hace de 1 a 7 (lunes a domingo)
            Hour = u.Hour,
            Usage = u.Total
        });
    }
}

public class BusStopUsagePoint
{
    [JsonPropertyName("h")] public required int Hour { get; set; }

    [JsonPropertyName("t")] public required int Total { get; set; }

    [JsonPropertyName("d")] public required int Day { get; set; }
}
