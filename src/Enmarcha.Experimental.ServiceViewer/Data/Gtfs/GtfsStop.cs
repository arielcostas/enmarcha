using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs.Enums;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("gtfs_stops")]
[PrimaryKey(nameof(Id), nameof(FeedId))]
public class GtfsStop
{
    [Column("stop_id")]
    [MaxLength(32)]
    public required string Id { get; set; }

    [Column("feed_id")]public int FeedId { get; set; }
    [ForeignKey(nameof(FeedId))] public required Feed Feed { get; set; }

    [Column("stop_code")]
    [MaxLength(32)]
    public string Code { get; set; } = string.Empty;

    [Column("stop_name")]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [Column("stop_desc")]
    [MaxLength(255)]
    public string? Description { get; set; }

    [Column("stop_pos")]
    public Point? Position { get; set; }

    [Column("stop_url")]
    [MaxLength(255)]
    public string? Url { get; set; }

    [Column("stop_timezone")]
    [MaxLength(50)]
    public string? Timezone { get; set; }

    [Column("wheelchair_boarding")]
    public WheelchairBoarding WheelchairBoarding { get; set; } = WheelchairBoarding.Unknown;

    // [Column("location_type")]
    // public int LocationType { get; set; }
    //
    // [Column("parent_station")]
    // public int? ParentStationId { get; set; }
}
