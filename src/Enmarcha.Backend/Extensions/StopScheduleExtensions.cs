using Enmarcha.Backend.Types;

namespace Enmarcha.Backend.Extensions;

public static class StopScheduleExtensions
{
    public static DateTime? StartingDateTime(this StopArrivals.Types.ScheduledArrival stop, DateTime baseDate)
    {
        return ParseGtfsTime(stop.StartingTime, baseDate);
    }

    public static DateTime? CallingDateTime(this StopArrivals.Types.ScheduledArrival stop, DateTime baseDate)
    {
        return ParseGtfsTime(stop.CallingTime, baseDate);
    }

    /// <summary>
    /// Parse GTFS time format (HH:MM:SS) which can have hours >= 24 for services past midnight
    /// </summary>
    private static DateTime? ParseGtfsTime(string timeStr, DateTime baseDate)
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
            var dt = baseDate
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
