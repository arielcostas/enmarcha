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
    public required List<StopBasicsResponse.StopRoute> Routes { get; set; }
    public required bool HasUsageData { get; set; }
}
