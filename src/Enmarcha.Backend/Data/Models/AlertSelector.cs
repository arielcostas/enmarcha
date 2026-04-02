namespace Enmarcha.Backend.Data.Models;

/// <summary>
/// Defines the scope of an alert (e.g., "stop#vitrasa:1400", "route#xunta:123").
/// This follows a URI-like pattern for easy parsing and matching.
/// </summary>
public class AlertSelector
{
    public string Raw { get; set; } = string.Empty;

    public string Type => Raw.Split('#').FirstOrDefault() ?? string.Empty;
    public string Id => Raw.Split('#').ElementAtOrDefault(1) ?? string.Empty;

    public static AlertSelector FromStop(string feedId, string stopId) => new() { Raw = $"stop#{feedId}:{stopId}" };
    public static AlertSelector FromRoute(string feedId, string routeId) => new() { Raw = $"route#{feedId}:{routeId}" };
    /// <param name="agencyGtfsId">Full GTFS agency id in the form <c>feedId:agencyId</c> (e.g. <c>vitrasa:1</c>).</param>
    public static AlertSelector FromAgency(string agencyGtfsId) => new() { Raw = $"agency#{agencyGtfsId}" };

    public override string ToString() => Raw;
}
