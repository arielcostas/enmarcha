namespace Enmarcha.Backend.Types;

public class ConsolidatedCirculation
{
    public required string Line { get; set; }
    public required string Route { get; set; }

    public ScheduleData? Schedule { get; set; }
    public RealTimeData? RealTime { get; set; }
    public Position? CurrentPosition { get; set; }
    public int? StopShapeIndex { get; set; }
    public bool IsPreviousTrip { get; set; }
    public string? PreviousTripShapeId { get; set; }
    public string[] NextStreets { get; set; } = [];
}

public class RealTimeData
{
    public required int Minutes { get; set; }
    public required int Distance { get; set; }
}

public class ScheduleData
{
    public bool Running { get; set; }
    public required int Minutes { get; set; }
    public required string ServiceId { get; set; }
    public required string TripId { get; set; }
    public string? ShapeId { get; set; }
}

public class Position
{
    public required double Latitude { get; set; }
    public required double Longitude { get; set; }
    public int OrientationDegrees { get; set; }
    public int ShapeIndex { get; set; }
}
