namespace Costasdev.Busurbano.Backend.Types.Transit;

public class RouteDto
{
    public required string Id { get; set; }
    public string? ShortName { get; set; }
    public string? LongName { get; set; }
    public string? Color { get; set; }
    public string? TextColor { get; set; }
    public int? SortOrder { get; set; }
    public string? AgencyName { get; set; }
    public int TripCount { get; set; }
}

public class RouteDetailsDto
{
    public string? ShortName { get; set; }
    public string? LongName { get; set; }
    public string? Color { get; set; }
    public string? TextColor { get; set; }
    public string? AgencyName { get; set; }
    public List<PatternDto> Patterns { get; set; } = [];
}

public class PatternDto
{
    public required string Id { get; set; }
    public string? Name { get; set; }
    public string? Headsign { get; set; }
    public int DirectionId { get; set; }
    public string? Code { get; set; }
    public string? SemanticHash { get; set; }
    public int TripCount { get; set; }
    public List<List<double>>? Geometry { get; set; }
    public List<PatternStopDto> Stops { get; set; } = [];
}

public class PatternStopDto
{
    public required string Id { get; set; }
    public string? Code { get; set; }
    public required string Name { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public List<int> ScheduledDepartures { get; set; } = [];
}
