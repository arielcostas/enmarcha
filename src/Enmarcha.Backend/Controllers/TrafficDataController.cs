using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using NetTopologySuite.Features;
using NetTopologySuite.IO;

namespace Enmarcha.Backend.Controllers;

[ApiController]
[Route("api")]
public class TrafficDataController : ControllerBase
{
    private readonly ILogger<TrafficDataController> _logger;
    private readonly IMemoryCache _cache;
    private readonly HttpClient _httpClient;

    public TrafficDataController(
        ILogger<TrafficDataController> logger,
        IMemoryCache cache,
        HttpClient httpClient
    )
    {
        _logger = logger;
        _cache = cache;
        _httpClient = httpClient;
    }

    [HttpGet("traffic")]
    public async Task<IActionResult> Get()
    {
        var trafficData = _cache.GetOrCreate("vigo-traffic-geojson", entry =>
        {
            var data = GetTrafficData();

            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);

            return data.Result;
        });

        if (string.IsNullOrEmpty(trafficData))
        {
            return StatusCode(404);
        }

        return Content(trafficData, "application/json", Encoding.UTF8);
    }

    private async Task<string> GetTrafficData()
    {
        var resp = await _httpClient.GetAsync("https://datos.vigo.org/data/trafico/treal.geojson");
        var body = resp.Content.ReadAsStringAsync().Result;

        var reader = new GeoJsonReader();
        var featureCollection = reader.Read<FeatureCollection>(body);

        var filteredFeatures = new FeatureCollection();
        foreach (var kvp in featureCollection)
        {
            var newAttributes = new AttributesTable();

            if (
                !kvp.Attributes.Exists("actualizacion") ||
                !kvp.Attributes.Exists("style")
            )
            {
                continue;
            }

            var updateParsed = DateTime.TryParseExact(
                kvp.Attributes["actualizacion"].ToString(),
                "dd/MM/yyyy H:mm:ss",
                null,
                DateTimeStyles.None,
                out var updatedAt
            );

            if (!updateParsed || updatedAt < DateTime.Today)
            {
                continue;
            }

            var style = kvp.Attributes["style"].ToString();

            if (style == "#SINDATOS")
            {
                continue;
            }

            var vehiculosAttribute = (kvp.Attributes["vehiculos"] ?? "0").ToString();

            var vehiclesParsed = int.TryParse(vehiculosAttribute, out var vehicles);
            if (!vehiclesParsed || vehicles <= 0)
            {
                continue;
            }

            newAttributes.Add("updatedAt", updatedAt.ToString("O"));
            newAttributes.Add("style", style);
            newAttributes.Add("vehicles", vehicles);

            kvp.Attributes = newAttributes;
            filteredFeatures.Add(kvp);
        }

        var writer = new GeoJsonWriter();

        return writer.Write(filteredFeatures);
    }
}
