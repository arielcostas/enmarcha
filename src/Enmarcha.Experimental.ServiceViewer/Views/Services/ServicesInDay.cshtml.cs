using Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

namespace Enmarcha.Experimental.ServiceViewer.Views.Services;

public class ServiceInDayModel
{
    public List<ServicesInDayItem> Items { get; set; } = [];
    public DateOnly Date { get; set; }
}

public class ServicesInDayItem
{
    public string ServiceId { get; set; }
    public string ServiceName { get; set; }
    public List<GtfsTrip> Trips { get; set; }
    public List<TripGroup> TripGroups { get; set; }

    public string ShiftStart { get; set; }
    public string ShiftEnd { get; set; }

    public ServicesInDayItem(
        string serviceId,
        string serviceName,
        List<GtfsTrip> trips,
        List<TripGroup> tripGroups,
        string shiftStart,
        string shiftEnd
    ) {
        ServiceId = serviceId;
        ServiceName = serviceName;
        Trips = trips;
        TripGroups = tripGroups;

        ShiftStart = shiftStart;
        ShiftEnd = shiftEnd;
    }
}

public record TripGroup(GtfsRoute route, int count);
