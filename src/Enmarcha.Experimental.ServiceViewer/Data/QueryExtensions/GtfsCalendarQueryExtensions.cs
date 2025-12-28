using Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

namespace Enmarcha.Experimental.ServiceViewer.Data.QueryExtensions;

public static class GtfsCalendarQueryExtensions
{
    public static IQueryable<GtfsCalendar> WhereDayOfWeek(this IQueryable<GtfsCalendar> query, DayOfWeek dayOfWeek)
    {
        return dayOfWeek switch
        {
            DayOfWeek.Monday => query.Where(c => c.Monday),
            DayOfWeek.Tuesday => query.Where(c => c.Tuesday),
            DayOfWeek.Wednesday => query.Where(c => c.Wednesday),
            DayOfWeek.Thursday => query.Where(c => c.Thursday),
            DayOfWeek.Friday => query.Where(c => c.Friday),
            DayOfWeek.Saturday => query.Where(c => c.Saturday),
            DayOfWeek.Sunday => query.Where(c => c.Sunday),
            _ => query
        };
    }
}
