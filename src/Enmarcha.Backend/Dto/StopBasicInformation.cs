using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Sources.OpenTripPlannerGql.Queries.V2;

namespace Enmarcha.Backend.Dto;

public class StopBasicInformation
{
    public required string Id { get; set; }
    public required string? Code { get; set; }
    public required string Name { get; set; }
    public required string Owner { get; set; }
    public required double Lat { get; set; }
    public required double Lon { get; set; }
    public required List<StopBasicInformationRoute> Routes { get; set; }
    public required bool HasUsageData { get; set; }
}

public class StopBasicInformationRoute
{
    public required string GtfsId { get; set; }
    public required string ShortName { get; set; }
    public required string LongName { get; set; }
    public required string Colour { get; set; }
    public required string TextColour { get; set; }
}
