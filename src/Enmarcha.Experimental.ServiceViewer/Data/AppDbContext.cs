using Enmarcha.Experimental.ServiceViewer.Data.Gtfs;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs.Enums;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Route -> Agency
        modelBuilder.Entity<GtfsRoute>()
            .HasOne(r => r.Agency)
            .WithMany()
            .HasForeignKey(r => new { r.AgencyId, r.FeedId })
            .HasPrincipalKey(a => new { a.Id, a.FeedId });

        // Trip -> Route
        modelBuilder.Entity<GtfsTrip>()
            .HasOne(t => t.Route)
            .WithMany()
            .HasForeignKey(t => new { t.RouteId, t.FeedId })
            .HasPrincipalKey(a => new { a.Id, a.FeedId });

        // Relación StopTimes -> Trip
        modelBuilder.Entity<GtfsStopTime>()
            .HasOne(st => st.GtfsTrip)
            .WithMany()
            .HasForeignKey(st => new { st.TripId, st.FeedId })
            .HasPrincipalKey(a => new { a.Id, a.FeedId });

        // Relación StopTimes -> Stop
        modelBuilder.Entity<GtfsStopTime>()
            .HasOne(st => st.GtfsStop)
            .WithMany()
            .HasForeignKey(st => new { st.StopId, st.FeedId })
            .HasPrincipalKey(a => new { a.Id, a.FeedId });

        modelBuilder.Entity<GtfsTrip>()
            .Property(t => t.TripWheelchairAccessible)
            .HasDefaultValue(TripWheelchairAccessible.Empty);

        modelBuilder.Entity<GtfsTrip>()
            .Property(t => t.TripBikesAllowed)
            .HasDefaultValue(TripBikesAllowed.Empty);
    }

    public DbSet<GtfsAgency> Agencies { get; set; }
    public DbSet<GtfsCalendar> Calendars { get; set; }
    public DbSet<GtfsCalendarDate> CalendarDates { get; set; }
    public DbSet<GtfsRoute> Routes { get; set; }
    public DbSet<GtfsStop> Stops { get; set; }
    public DbSet<GtfsStopTime> StopTimes { get; set; }
    public DbSet<GtfsTrip> Trips { get; set; }
}
