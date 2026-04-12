using System.Text.Json.Serialization;

namespace Enmarcha.Sources.TranviasCoruna;

public class QueryitrResponse
{
    [JsonPropertyName("buses")] public required ArrivalInfo ArrivalInfo { get; set; }
}

public class ArrivalInfo
{
    [JsonPropertyName("parada")]
    public int StopId { get; set; }
    [JsonPropertyName("lineas")]
    public required Route[] Routes { get; set; }
}

public class Route
{
    [JsonPropertyName("linea")]
    public int RouteId { get; set; }
    [JsonPropertyName("buses")]
    public required Arrival[] Arrivals { get; set; }
}

public class Arrival
{
    [JsonPropertyName("bus")]
    public int VehicleNumber { get; set; }
    [JsonPropertyName("tiempo")]
    public required string Minutes { get; set; }
    [JsonPropertyName("distancia")]
    public required string Metres { get; set; }
}
