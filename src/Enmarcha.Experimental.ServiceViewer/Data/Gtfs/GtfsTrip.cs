using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs.Enums;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("gtfs_trips")]
[PrimaryKey(nameof(Id), nameof(FeedId))]
public class GtfsTrip
{
    [Column("trip_id")] [MaxLength(32)] public string Id { get; set; } = null!;

    [Column("feed_id")] public int FeedId { get; set; }
    [ForeignKey(nameof(FeedId))] public required Feed Feed { get; set; }

    [Column("route_id")]
    [MaxLength(32)]
    [ForeignKey(nameof(Route))]
    public string RouteId { get; set; } = null!;

    [ForeignKey(nameof(RouteId))] public GtfsRoute Route { get; set; } = null!;

    [Column("service_id")] [MaxLength(32)] public string ServiceId { get; set; } = null!;

    [Column("trip_headsign")]
    [MaxLength(255)]
    public string? TripHeadsign { get; set; }

    [Column("trip_short_name")]
    [MaxLength(255)]
    public string? TripShortName { get; set; }

    [Column("direction_id")] public DirectionId DirectionId { get; set; } = DirectionId.Outbound;

    /// <summary>
    /// Identifies the block to which the trip belongs. A block consists of a single trip or many
    /// sequential trips made using the same vehicle, defined by shared service days and block_id.
    /// A block_id may have trips with different service days, making distinct blocks.
    /// </summary>
    [Column("block_id")]
    [MaxLength(32)]
    public string? BlockId { get; set; }

    /// <summary>
    /// Identifies a geospatial shape describing the vehicle travel path for a trip.
    /// </summary>
    /// <remarks>To be implemented: will be stored as a GeoJSON file instead of database records.</remarks>
    [Column("shape_id")]
    [MaxLength(32)]
    public string? ShapeId { get; set; }

    [Column("trip_wheelchair_accessible")]
    public TripWheelchairAccessible TripWheelchairAccessible { get; set; } = TripWheelchairAccessible.Empty;

    [Column("trip_bikes_allowed")] public TripBikesAllowed TripBikesAllowed { get; set; } = TripBikesAllowed.Empty;
}
