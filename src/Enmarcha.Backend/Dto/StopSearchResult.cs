using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Sources.OpenTripPlannerGql.Queries.V2;

namespace Enmarcha.Backend.Dto;

public record StopSearchResult(string Id, string? Code, string Owner, string Name, IEnumerable<StopSearchRoute> Routes)
{
    public override string ToString()
    {
        return $"{{ Id = {Id}, Code = {Code}, Owner = {Owner}, Name = {Name}, Routes = {Routes} }}";
    }
}

public record StopSearchRoute(
    string GtfsId,
    string? ShortName,
    string? Color,
    string? TextColor
);
