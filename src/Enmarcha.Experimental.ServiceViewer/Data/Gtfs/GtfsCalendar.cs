using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("gtfs_calendar")]
[PrimaryKey(nameof(ServiceId), nameof(FeedId))]
public class GtfsCalendar
{
    [Key]
    [Column("service_id")]
    [MaxLength(32)]
    public string ServiceId { get; set; } = null!;

    [Column("feed_id")] public int FeedId { get; set; }
    [ForeignKey(nameof(FeedId))] public required Feed Feed { get; set; }

    [Column("monday")]
    public bool Monday { get; set; }

    [Column("tuesday")]
    public bool Tuesday { get; set; }

    [Column("wednesday")]
    public bool Wednesday { get; set; }

    [Column("thursday")]
    public bool Thursday { get; set; }

    [Column("friday")]
    public bool Friday { get; set; }

    [Column("saturday")]
    public bool Saturday { get; set; }

    [Column("sunday")]
    public bool Sunday { get; set; }

    [Column("start_date")]
    public DateOnly StartDate { get; set; }

    [Column("end_date")]
    public DateOnly EndDate { get; set; }
}
