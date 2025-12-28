namespace Enmarcha.Experimental.ServiceViewer.Views.Services;

public class ServiceDetailsModel
{
    public DateOnly Date { get; set; }
    public string ServiceId { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;

    public List<ServiceDetailsItem> Items { get; set; } = [];
    public TimeSpan TotalDrivingTime { get; set; }

    public int TotalDistance { get; set; }
    public string TotalDistanceKm => (TotalDistance / 1000.0).ToString("0.00 km");
}

public class ServiceDetailsItem
{
    public string TripId { get; set; } = string.Empty;
    public string SafeRouteId { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string LongName { get; set; } = string.Empty;
    public string TotalDistance { get; set; } = string.Empty;

    public string FirstStopTime { get; set; } = string.Empty;
    public string FirstStopName { get; set; } = string.Empty;

    public string LastStopTime { get; set; } = string.Empty;
    public string LastStopName { get; set; } = string.Empty;
}
