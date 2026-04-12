using System.Text.Json.Serialization;

namespace Enmarcha.Sources.Tussa;

public class MaisbusResponse
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("codigo")] public required string Code { get; set; }
    [JsonPropertyName("nombre")] public required string Name { get; set; }
    [JsonPropertyName("coordenadas")] public required Coordinates Coordinates { get; set; }
    [JsonPropertyName("lineas")] public required Route[] Routes { get; set; }
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
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("sinoptico")] public required string Sinoptico { get; set; }
    [JsonPropertyName("nombre")] public required string Name { get; set; }
    [JsonPropertyName("estilo")] public required string Colour { get; set; }
    /// <example>
    ///   2025-12-28 23:57
    /// </example>
    [JsonPropertyName("proximoPaso")] public required string NextArrival { get; set; }
    [JsonPropertyName("minutosProximoPaso")] public int MinutesToArrive { get; set; }
}

