using System.Text.Json.Serialization;

namespace Enmarcha.Sources.Renfe;

public class RenfeStatus
{
    [JsonPropertyName("fechaActualizacion")] public DateTime FechaActualizacion { get; set; }
    [JsonPropertyName("trenes")] public List<Train> Trenes { get; set; }
}

public class Train
{
    [JsonPropertyName("codComercial")] public required string TrainCode { get; set; }
    [JsonPropertyName("codEstAnt")] public required string LastStationCalled { get; set; }
    [JsonPropertyName("codEstSig")] public required string NextStationCalling { get; set; }
    [JsonPropertyName("horaLlegadaSigEst")] public required DateTime NextStationCallingTime { get; set; }
    [JsonPropertyName("codProduct")] public required int ProductCode { get; set; }
    [JsonPropertyName("codOrigen")] public required string OriginStationCode { get; set; }
    [JsonPropertyName("codDestino")] public required string DestinationStationCode { get; set; }
    [JsonPropertyName("accesible")] public required bool Accessible { get; set; }
    [JsonPropertyName("ultRetraso")] public required string LastDelay { get; set; }
    [JsonIgnore] public int LastDelayValue => int.Parse(LastDelay);
    [JsonPropertyName("latitud")] public required double Latitude { get; set; }
    [JsonPropertyName("longitud")] public required double Longitude { get; set; }
    [JsonPropertyName("time")] public required int Timestamp { get; set; }
    [JsonPropertyName("p")] public required string P { get; set; }
    [JsonPropertyName("mat")] public required string RollingStock { get; set; }
}
