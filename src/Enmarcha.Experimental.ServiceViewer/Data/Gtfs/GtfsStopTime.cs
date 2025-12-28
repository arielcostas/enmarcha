using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Enmarcha.Experimental.ServiceViewer.Data.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("gtfs_stop_times")]
[PrimaryKey(nameof(TripId), nameof(StopSequence), nameof(FeedId))]
public class GtfsStopTime
{
    [Column("trip_id")]
    [ForeignKey("TripId")]
    [MaxLength(32)]
    public string TripId { get; set; } = null!;

    [Column("feed_id")]public int FeedId { get; set; }
    [ForeignKey(nameof(FeedId))] public required Feed Feed { get; set; }

    [ForeignKey(nameof(TripId))] public GtfsTrip GtfsTrip { get; set; } = null!;

    [Column("arrival_time")] public string Arrival { get; set; }
    public TimeSpan ArrivalTime => TimeSpan.FromGtfsTime(Arrival);

    [Column("departure_time")] public string Departure { get; set; }
    public TimeSpan DepartureTime => TimeSpan.FromGtfsTime(Departure);

    [Column("stop_id")]
    [ForeignKey(nameof(GtfsStop))]
    [MaxLength(32)]
    public required string StopId { get; set; }

    [ForeignKey(nameof(StopId))] public GtfsStop GtfsStop { get; set; } = null!;

    [Column("stop_sequence")] public int StopSequence { get; set; } = 0;

    // [Column("pickup_type")]
    // public int? PickupType { get; set; }
    //
    // [Column("drop_off_type")]
    // public int? DropOffType { get; set; }

    [Column("shape_dist_traveled")] public double? ShapeDistTraveled { get; set; } = null!;
}
