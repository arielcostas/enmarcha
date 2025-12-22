namespace Costasdev.Busurbano.Backend.Types.Planner;

public class RoutePlan
{
    public List<Itinerary> Itineraries { get; set; } = new();
    public long? TimeOffsetSeconds { get; set; }
}

public class Itinerary
{
    public double DurationSeconds { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public double WalkDistanceMeters { get; set; }
    public double WalkTimeSeconds { get; set; }
    public double TransitTimeSeconds { get; set; }
    public double WaitingTimeSeconds { get; set; }
    public List<Leg> Legs { get; set; } = new();
    public double? CashFareEuro { get; set; }
    public double? CardFareEuro { get; set; }
}

public class Leg
{
    public string? Mode { get; set; } // WALK, BUS, etc.
    public string? RouteName { get; set; }
    public string? RouteShortName { get; set; }
    public string? RouteLongName { get; set; }
    public string? Headsign { get; set; }
    public string? AgencyName { get; set; }
    public string? RouteColor { get; set; }
    public string? RouteTextColor { get; set; }
    public PlannerPlace? From { get; set; }
    public PlannerPlace? To { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public double DistanceMeters { get; set; }

    // GeoJSON LineString geometry
    public PlannerGeometry? Geometry { get; set; }

    public List<Step> Steps { get; set; } = new();

    public List<PlannerPlace> IntermediateStops { get; set; } = new();
}

public class PlannerPlace
{
    public string? Name { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public string? StopId { get; set; }
    public string? StopCode { get; set; }
}

public class PlannerGeometry
{
    public string Type { get; set; } = "LineString";
    public List<List<double>> Coordinates { get; set; } = new(); // [[lon, lat], ...]
}

public class Step
{
    public double DistanceMeters { get; set; }
    public string? RelativeDirection { get; set; }
    public string? AbsoluteDirection { get; set; }
    public string? StreetName { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
}

// For Autocomplete/Reverse
public class PlannerSearchResult
{
    public string? Name { get; set; }
    public string? Label { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public string? Layer { get; set; }
}
