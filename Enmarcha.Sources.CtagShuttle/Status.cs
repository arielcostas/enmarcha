using System.Text.Json.Serialization;

namespace Enmarcha.Sources.CtagShuttle;

public class CtagShuttleStatus
{
    [JsonPropertyName("status")] public required string StatusValue { get; set; }
    [JsonPropertyName("lat")] public double Latitude { get; set; }
    [JsonPropertyName("lng")] public double Longitude { get; set; }
    [JsonPropertyName("last_position_at")] public required string LastPositionAtValue { get; set; }
    [JsonPropertyName("free_seats")] public int FreeSeats { get; set; }

    [JsonPropertyName("last_occupancy_at")]
    public required string LastOccupancyAtValue { get; set; }

    [JsonIgnore]
    public Status Status => Status.Parse(StatusValue);
    
    [JsonIgnore]
    public DateTime LastPositionAt => DateTime.Parse(LastPositionAtValue, null, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal);
    
    [JsonIgnore]
    public DateTime LastOccupancyAt => DateTime.Parse(LastOccupancyAtValue, null, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal);
}

public enum Status
{
    Idle,
    Operating
}

public static class StatusExtensions
{
    extension(Status)
    {
        public static Status Parse(string value)
        {
            return value switch
            {
                "idle" => Status.Idle,
                "operating" => Status.Operating,
                _ => throw new ArgumentException($"Invalid status value: {value}")
            };
        }
    }
}
