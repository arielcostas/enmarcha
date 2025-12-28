using System.Text.Json.Serialization;

namespace Enmarcha.Sources.TranviasCoruna;

public class QueryitrResponse
{
    [JsonPropertyName("buses")] public ArrivalInfo ArrivalInfo { get; set; }
}

public class ArrivalInfo
{
    [JsonPropertyName("parada")]
    public int StopId { get; set; }
    [JsonPropertyName("lineas")]
    public Route[] Routes { get; set; }
}

public class Route
{
    [JsonPropertyName("linea")]
    public int RouteId { get; set; }
    [JsonPropertyName("buses")]
    public Arrival[] Arrivals { get; set; }
}

public class Arrival
{
    [JsonPropertyName("bus")]
    public int VehicleNumber { get; set; }
    [JsonPropertyName("tiempo")]
    public string Minutes { get; set; }
    [JsonPropertyName("distancia")]
    public string Metres { get; set; }
}
