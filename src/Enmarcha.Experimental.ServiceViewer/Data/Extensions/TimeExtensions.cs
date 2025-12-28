namespace Enmarcha.Experimental.ServiceViewer.Data.Extensions;

public static class TimeExtensions
{
    extension(TimeSpan) {
        public static TimeSpan FromGtfsTime(string gtfsTime)
        {
            var parts = gtfsTime.Split(":", 3);

            var hours = int.Parse(parts[0]);
            var minutes = int.Parse(parts[1]);
            var seconds = int.Parse(parts[2]);

            int days = hours / 24;
            int leftoverHours = hours % 24;

            return new TimeSpan(days, leftoverHours, minutes, seconds);
        }
    }
}
