using System.Text.Json.Serialization;

namespace Enmarcha.Sources.Tussa;

public class MaisbusResponse
{
    [JsonPropertyName("id")] public string Id { get; set; }
    [JsonPropertyName("codigo")] public string Code { get; set; }
    [JsonPropertyName("nombre")] public string Name { get; set; }
    [JsonPropertyName("coordenadas")] public Coordinates Coordinates { get; set; }
    [JsonPropertyName("lineas")] public Route[] Routes { get; set; }
}

public class Coordinates
{
    [JsonPropertyName("latitud")]
    public double Latitude { get; set; }
    [JsonPropertyName("longitud")]
    public double Longitude { get; set; }
}

public class Route
{
    [JsonPropertyName("id")] public string Id { get; set; }
    [JsonPropertyName("sinoptico")] public string Sinoptico { get; set; }
    [JsonPropertyName("nombre")] public string Name { get; set; }
    [JsonPropertyName("estilo")] public string Colour { get; set; }
    /// <example>
    ///   2025-12-28 23:57
    /// </example>
    [JsonPropertyName("proximoPaso")] public string NextArrival { get; set; }
    [JsonPropertyName("minutosProximoPaso")] public int MinutesToArrive { get; set; }
}

