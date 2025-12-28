using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs.Enums;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("gtfs_calendar_dates")]
[PrimaryKey(nameof(ServiceId), nameof(Date), nameof(FeedId))]
public class GtfsCalendarDate
{
    [Column("service_id")]
    [MaxLength(32)]
    public required string ServiceId { get; set; }

    [Column("date")]
    public required DateTime Date { get; set; }

    [Column("feed_id")] public int FeedId { get; set; }
    [ForeignKey(nameof(FeedId))] public required Feed Feed { get; set; }

    [Column("exception_type")]
    public required ExceptionType ExceptionType { get; set; }
}
