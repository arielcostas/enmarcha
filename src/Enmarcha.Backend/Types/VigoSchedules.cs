using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Types;

public class ScheduledStop
{
    [JsonPropertyName("trip_id")] public required string TripId { get; set; }
    [JsonPropertyName("service_id")] public required string ServiceId { get; set; }
    [JsonPropertyName("line")] public required string Line { get; set; }
    [JsonPropertyName("route")] public required string Route { get; set; }
    [JsonPropertyName("stop_sequence")] public required int StopSequence { get; set; }

    [JsonPropertyName("shape_dist_traveled")]
    public required double ShapeDistTraveled { get; set; }

    [JsonPropertyName("next_streets")] public required string[] NextStreets { get; set; }

    [JsonPropertyName("starting_code")] public required string StartingCode { get; set; }
    [JsonPropertyName("starting_name")] public required string StartingName { get; set; }
    [JsonPropertyName("starting_time")] public required string StartingTime { get; set; }
    public DateTime? StartingDateTime(DateTime? baseDate = null)
    {
        return ParseGtfsTime(StartingTime, baseDate);
    }

    [JsonPropertyName("calling_ssm")] public required int CallingSsm { get; set; }
    [JsonPropertyName("calling_time")] public required string CallingTime { get; set; }
    public DateTime? CallingDateTime(DateTime? baseDate = null)
    {
        return ParseGtfsTime(CallingTime, baseDate);
    }

    [JsonPropertyName("terminus_code")] public required string TerminusCode { get; set; }
    [JsonPropertyName("terminus_name")] public required string TerminusName { get; set; }
    [JsonPropertyName("terminus_time")] public required string TerminusTime { get; set; }

    /// <summary>
    /// Parse GTFS time format (HH:MM:SS) which can have hours >= 24 for services past midnight
    /// </summary>
    private static DateTime? ParseGtfsTime(string timeStr, DateTime? baseDate = null)
    {
        if (string.IsNullOrWhiteSpace(timeStr))
        {
            return null;
        }

        var parts = timeStr.Split(':');
        if (parts.Length != 3)
        {
            return null;
        }

        if (!int.TryParse(parts[0], out var hours) ||
            !int.TryParse(parts[1], out var minutes) ||
            !int.TryParse(parts[2], out var seconds))
        {
            return null;
        }

        // Handle GTFS times that exceed 24 hours (e.g., 25:30:00 for 1:30 AM next day)
        var days = hours / 24;
        var normalizedHours = hours % 24;

        try
        {
            var dt = (baseDate ?? DateTime.Today)
                .AddDays(days)
                .AddHours(normalizedHours)
                .AddMinutes(minutes)
                .AddSeconds(seconds);
            return dt.AddSeconds(60 - dt.Second);
        }
        catch
        {
            return null;
        }
    }
}
