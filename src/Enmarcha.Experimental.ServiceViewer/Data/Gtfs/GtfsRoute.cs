using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs.Enums;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("gtfs_routes")]
[PrimaryKey(nameof(Id), nameof(FeedId))]
public class GtfsRoute
{
    [Column("route_id")]
    [MaxLength(255)]
    public required string Id { get; set; }

    public string SafeId => Id.Replace(" ", "_").Replace("-", "_");

    [Column("feed_id")]public int FeedId { get; set; }
    [ForeignKey(nameof(FeedId))] public required Feed Feed { get; set; }

    [Column("agency_id")]
    [ForeignKey(nameof(Agency))]
    [MaxLength(255)]
    public required string AgencyId { get; set; }

    [ForeignKey(nameof(AgencyId))]
    public GtfsAgency Agency { get; set; } = null!;

    /// <summary>
    /// Short name of a route. Often a short, abstract identifier (e.g., "32", "100X", "Green")
    /// that riders use to identify a route. Both route_short_name and route_long_name may be defined.
    /// </summary>
    [Column("route_short_name")]
    [MaxLength(32)]
    public string ShortName { get; set; } = string.Empty;

    /// <summary>
    /// Full name of a route. This name is generally more descriptive than the route_short_name and often
    /// includes the route's destination or stop. Both route_short_name and route_long_name may be defined.
    /// </summary>
    [Column("route_long_name")]
    [MaxLength(255)]
    public string LongName { get; set; } = string.Empty;

    [Column("route_desc")]
    [MaxLength(255)]
    public string? Description { get; set; } = string.Empty;

    [Column("route_type")]
    public RouteType Type { get; set; } = RouteType.Bus;

    [Column("route_url")]
    [MaxLength(255)]
    public string? Url { get; set; } = string.Empty;

    [Column("route_color")]
    [MaxLength(7)]
    public string? Color { get; set; } = string.Empty;

    [Column("route_text_color")]
    [MaxLength(7)]
    public string? TextColor { get; set; } = string.Empty;

    /// <summary>
    /// Orders the routes in a way which is ideal for presentation to customers.
    /// Routes with smaller route_sort_order values should be displayed first.
    /// </summary>
    [Column("route_sort_order")]
    public int SortOrder { get; set; } = 1;
}
