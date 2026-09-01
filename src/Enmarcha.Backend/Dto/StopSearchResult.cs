namespace Enmarcha.Backend.Dto;

public class StopSearchResult
{
    public required string Id { get; init; }
    public required string? Code { get; init; }
    public required string Owner { get; init; }
    public required string Name { get; init; }
    public required IEnumerable<StopSearchRoute> Routes { get; init; }
}

public class StopSearchRoute
{
    public required string GtfsId { get; init; }
    public required string? ShortName { get; init; }
    public required string? Color { get; init; }
    public required string? TextColor { get; init; }
}
