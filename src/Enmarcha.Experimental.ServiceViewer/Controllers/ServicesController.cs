using Enmarcha.Experimental.ServiceViewer.Data;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs;
using Enmarcha.Experimental.ServiceViewer.Data.Gtfs.Enums;
using Enmarcha.Experimental.ServiceViewer.Data.QueryExtensions;
using Enmarcha.Experimental.ServiceViewer.Views.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Controllers;

[Route("")]
public class ServicesController : Controller
{
    private readonly AppDbContext _db;

    public ServicesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("")]
    public async Task<IActionResult> DaysInFeed()
    {
        // FIXME: Use calendar too, but it requires getting the feed information
        var days = await _db.CalendarDates
            .Where(cd => cd.ExceptionType == ExceptionType.Added)
            .Select(cd => cd.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToListAsync();

        var model = new DaysInFeedModel
        {
            Days = days,
            Today = DateOnly.FromDateTime(DateTime.Now),
        };

        return View(model);
    }

    [HttpGet("{day}")]
    public IActionResult ServicesInDay(
        [FromRoute] string day
    )
    {
        var dateParsed = DateOnly.TryParseExact(day, "yyyy-MM-dd", out var dateOnly);
        if (!dateParsed)
        {
            return BadRequest("Invalid date format. Please use 'yyyy-MM-dd'.");
        }

        var dateTime = dateOnly.ToDateTime(TimeOnly.MinValue);

        // 1. Get all the calendars running that day
        var dayOfWeek = dateOnly.DayOfWeek;

        var calendars = _db.Calendars
            .WhereDayOfWeek(dayOfWeek)
            .ToList();

        var calendarDates = _db.CalendarDates
            .Where(cd => cd.Date.Date == dateTime.Date)
            .ToList();

        // 2. Combine the two lists
        HashSet<string> activeServiceIds = [];
        foreach (var calendar in calendars)
        {
            if (calendarDates.All(cd =>
                    cd.ServiceId != calendar.ServiceId || cd.ExceptionType != ExceptionType.Removed))
            {
                activeServiceIds.Add(calendar.ServiceId);
            }
        }

        foreach (var calendarDate in calendarDates.Where(cd => cd.ExceptionType == ExceptionType.Added))
        {
            activeServiceIds.Add(calendarDate.ServiceId);
        }

        // 3. Get the trips for those services
        var tripsByService = _db.Trips
            .AsSplitQuery()
            .Include(t => t.Route)
            .Where(t => activeServiceIds.Contains(t.ServiceId))
            .GroupBy(t => t.ServiceId)
            .ToDictionary(g => g.Key, g => g.ToList());

        /*
         * For each shift, we extract the trip sequence number from the trip_id, order them ascending and take first
         * one's first stop_time departure_time as shift start time and last one's last stop_time arrival_time as shift end time
         * FIXME: Heuristic only for Vitrasa, not other feeds
         * A  01LP001_008001_2, A  01LP001_008001_3, A  01LP001_008001_4, A  01LP001_008001_5...
         */
        List<ServiceInformation> serviceInformations = [];
        List<string> tripsWhoseFirstStopWeWant = [];
        List<string> tripsWhoseLastStopWeWant = [];
        foreach (var (service, trips) in tripsByService)
        {
            var orderedTrips = trips
                .Select(t => new
                {
                    Trip = t,
                    Sequence = int.TryParse(t.Id.Split('_').LastOrDefault(), out var seq) ? seq : int.MaxValue
                })
                .OrderBy(t => t.Sequence)
                .ThenBy(t => t.Trip.TripHeadsign) // Secondary sort to ensure consistent ordering
                .Select(t => t.Trip)
                .ToList();

            if (orderedTrips.Count == 0)
            {
                continue;
            }

            tripsWhoseFirstStopWeWant.Add(orderedTrips.First().Id);
            tripsWhoseLastStopWeWant.Add(orderedTrips.Last().Id);
            serviceInformations.Add(new ServiceInformation(
                service,
                GetNameForServiceId(service),
                orderedTrips,
                orderedTrips.First(),
                orderedTrips.Last()
            ));
        }

        var firstStopTimePerTrip = _db.StopTimes
            .AsSplitQuery().AsNoTracking()
            .Where(st => tripsWhoseFirstStopWeWant.Contains(st.TripId))
            .OrderBy(st => st.StopSequence)
            .GroupBy(st => st.TripId)
            .Select(g => g.First())
            .ToDictionary(st => st.TripId, st => st.Departure);

        var lastStopTimePerTrip = _db.StopTimes
            .AsSplitQuery().AsNoTracking()
            .Where(st => tripsWhoseLastStopWeWant.Contains(st.TripId))
            .OrderByDescending(st => st.StopSequence)
            .GroupBy(st => st.TripId)
            .Select(g => g.First())
            .ToDictionary(st => st.TripId, st => st.Arrival);

        // 4. Create a view model
        List<ServicesInDayItem> serviceCards = [];
        foreach (var serviceInfo in serviceInformations)
        {
            // For lines 16-24 switching during the day we want (16, 2), (24,2), (16,1), (24,2)... in sequence
            // TODO: Fix getting the trip sequence for any operator
            var tripsOrdered = serviceInfo.Trips
                .OrderBy(t => int.Parse(t.Id.Split('_').LastOrDefault() ?? string.Empty))
                .ToList();

            List<TripGroup> tripGroups = [];
            GtfsRoute currentRoute = tripsOrdered.First().Route;
            int currentRouteCount = 1;
            foreach (var trip in tripsOrdered.Skip(1))
            {
                if (trip.Route.Id == currentRoute.Id)
                {
                    currentRouteCount++;
                }
                else
                {
                    tripGroups.Add(new TripGroup(currentRoute, currentRouteCount));
                    currentRoute = trip.Route;
                    currentRouteCount = 1;
                }
            }

            tripGroups.Add(new TripGroup(currentRoute, currentRouteCount));

            serviceCards.Add(new ServicesInDayItem(
                serviceInfo.ServiceId,
                serviceInfo.ServiceName,
                serviceInfo.Trips,
                tripGroups,
                firstStopTimePerTrip.TryGetValue(serviceInfo.FirstTrip.Id, out var shiftStart)
                    ? shiftStart
                    : string.Empty,
                lastStopTimePerTrip.TryGetValue(serviceInfo.LastTrip.Id, out var shiftEnd) ? shiftEnd : string.Empty
            ));
        }

        return View(new ServiceInDayModel
        {
            Items = serviceCards,
            Date = dateOnly
        });
    }

    [HttpGet("{day}/{serviceId}")]
    public IActionResult ServiceDetails(
        [FromRoute] string day,
        [FromRoute] string serviceId
    )
    {
        #region Validation

        var dateParsed = DateOnly.TryParseExact(day, "yyyy-MM-dd", out var dateOnly);
        if (!dateParsed)
        {
            return BadRequest("Invalid date format. Please use 'yyyy-MM-dd'.");
        }

        var dateTime = dateOnly.ToDateTime(TimeOnly.MinValue);

        // 1. Get all the calendars running that day
        var dayOfWeek = dateOnly.DayOfWeek;

        var calendars = _db.Calendars
            .WhereDayOfWeek(dayOfWeek)
            .ToList();

        var calendarDates = _db.CalendarDates
            .Where(cd => cd.Date.Date == dateTime.Date)
            .ToList();

        // 2. Combine the two lists
        HashSet<string> activeServiceIds = [];
        foreach (var calendar in calendars)
        {
            if (calendarDates.All(cd =>
                    cd.ServiceId != calendar.ServiceId || cd.ExceptionType != ExceptionType.Removed))
            {
                activeServiceIds.Add(calendar.ServiceId);
            }
        }

        foreach (var calendarDate in calendarDates.Where(cd => cd.ExceptionType == ExceptionType.Added))
        {
            activeServiceIds.Add(calendarDate.ServiceId);
        }

        if (!activeServiceIds.Contains(serviceId))
        {
            return NotFound("Service not found for the given day.");
        }

        #endregion

        var trips = _db.Trips
            .AsSplitQuery()
            .Include(t => t.Route)
            .Where(t => t.ServiceId == serviceId)
            .ToList();

        var orderedTrips = trips
            .Select(t => new
            {
                Trip = t,
                Sequence = int.TryParse(t.Id.Split('_').LastOrDefault(), out var seq) ? seq : int.MaxValue
            })
            .OrderBy(t => t.Sequence)
            .ThenBy(t => t.Trip.TripHeadsign) // Secondary sort to ensure consistent ordering
            .Select(t => t.Trip)
            .ToList();

        List<ServiceDetailsItem> items = [];
        int totalDistance = 0;
        TimeSpan totalDrivingMinutes = TimeSpan.Zero;
        foreach (var trip in orderedTrips)
        {
            var stopTimes = _db.StopTimes
                .AsSplitQuery().AsNoTracking()
                .Include(gtfsStopTime => gtfsStopTime.GtfsStop)
                .Where(st => st.TripId == trip.Id)
                .OrderBy(st => st.StopSequence)
                .ToList();

            if (stopTimes.Count == 0)
            {
                continue;
            }

            var firstStop = stopTimes.First();
            var lastStop = stopTimes.Last();

            var tripDistance = (int?)(lastStop.ShapeDistTraveled - firstStop.ShapeDistTraveled);
            totalDistance += tripDistance ?? 0;
            totalDrivingMinutes += (lastStop.ArrivalTime - firstStop.DepartureTime);

            items.Add(new ServiceDetailsItem
            {
                TripId = trip.Id,
                SafeRouteId = trip.Route.SafeId,
                ShortName = trip.Route.ShortName,
                LongName = trip.TripHeadsign ?? trip.Route.LongName,
                TotalDistance = tripDistance.HasValue ? $"{tripDistance.Value/1_000:F2} km" : "N/A",
                FirstStopName = firstStop.GtfsStop.Name,
                FirstStopTime = firstStop.Departure,
                LastStopName = lastStop.GtfsStop.Name,
                LastStopTime = lastStop.Arrival
            });
        }

        return View(new ServiceDetailsModel
        {
            Date = dateOnly,
            ServiceId = serviceId,
            ServiceName = GetNameForServiceId(serviceId),
            TotalDrivingTime = totalDrivingMinutes,
            TotalDistance = totalDistance,
            Items = items
        });
    }

    private string GetNameForServiceId(string serviceId)
    {
        var serviceIndicator = serviceId[^6..]; // "008001" or "202006"
        if (string.IsNullOrEmpty(serviceIndicator))
        {
            return serviceId;
        }

        var lineNumber = int.Parse(serviceIndicator[..3]); // "008"
        var shiftNumber = int.Parse(serviceIndicator[3..]); // "001"
        var lineName = lineNumber switch
        {
            1 => "C1",
            3 => "C3",
            30 => "N1",
            33 => "N4",
            8 => "A",
            101 => "H",
            201 => "U1",
            202 => "U2",
            150 => "REF",
            500 => "TUR",
            _ => $"L{lineNumber}"
        };

        return $"Servicio {lineName}-{shiftNumber}º ({serviceId[^6..]})";
    }
}

internal class ServiceInformation
{
    internal string ServiceId { get; }
    public string ServiceName { get; set; }
    internal List<GtfsTrip> Trips { get; }
    internal GtfsTrip FirstTrip { get; }
    internal GtfsTrip LastTrip { get; }

    internal ServiceInformation(
        string serviceId,
        string serviceName,
        List<GtfsTrip> trips,
        GtfsTrip firstTrip,
        GtfsTrip lastTrip
    )
    {
        ServiceId = serviceId;
        ServiceName = serviceName;
        Trips = trips;
        FirstTrip = firstTrip;
        LastTrip = lastTrip;
    }
}
