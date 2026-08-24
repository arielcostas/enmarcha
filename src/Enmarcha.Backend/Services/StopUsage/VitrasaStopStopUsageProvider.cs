namespace Enmarcha.Backend.Services.StopUsage;
/*
public class VitrasaStopStopUsageProvider : IStopUsageProvider
{
    public Task<bool> HasUsageDataAsync(string stopId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<IEnumerable<StopUsageRecord>?> GetUsageAsync(string stopId, CancellationToken cancellationToken = default)
    {
        var url = $"https://datos.vigo.org/vci_api_app/api2.jsp?tipo=TRANSPORTE_PARADA_HORAS_USO&parada={stopId}";
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


        throw new NotImplementedException();
}
    }*/
