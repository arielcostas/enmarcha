using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Types.Arrivals;

public class BusStopUsagePoint
{
    [JsonPropertyName("h")]
    public required int Hour { get; set; }

    [JsonPropertyName("t")]
    public required int Total { get; set; }

    [JsonPropertyName("d")]
    public required int DayOfWeek { get; set; }
}
