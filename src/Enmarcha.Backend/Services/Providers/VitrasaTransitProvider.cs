using System.Globalization;
using System.Text;
using Enmarcha.Backend.Extensions;
using Costasdev.VigoTransitApi;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Types;
using Microsoft.Extensions.Options;
using static Enmarcha.Backend.Types.StopArrivals.Types;
using SysFile = System.IO.File;

namespace Enmarcha.Backend.Services.Providers;

[Obsolete]
public class VitrasaTransitProvider : ITransitProvider
{
    private readonly VigoTransitApiClient _api;
    private readonly AppConfiguration _configuration;
    private readonly ShapeTraversalService _shapeService;
    private readonly LineFormatterService _lineFormatter;
    private readonly ILogger<VitrasaTransitProvider> _logger;

    public VitrasaTransitProvider(HttpClient http, IOptions<AppConfiguration> options, ShapeTraversalService shapeService, LineFormatterService lineFormatter, ILogger<VitrasaTransitProvider> logger)
    {
        _api = new VigoTransitApiClient(http);
        _configuration = options.Value;
        _shapeService = shapeService;
        _lineFormatter = lineFormatter;
        _logger = logger;
    }

    public async Task<List<ConsolidatedCirculation>> GetCirculationsAsync(string stopId, DateTime nowLocal)
    {
        // Vitrasa stop IDs are integers, but we receive string "vitrasa:1234" or just "1234" if legacy
        // The caller (Controller) should probably strip the prefix, but let's handle it here just in case or assume it's stripped.
        // The user said: "Routing the request to one or tthe other will just work with the prefix. For example calling `/api/GetConsolidatedCirculations?stopId=vitrasa:1400` will call the vitrasa driver with stop 1400."
        // So I should expect the ID part only here? Or the full ID?
        // Usually providers take the ID they understand. I'll assume the controller strips the prefix.

        if (!int.TryParse(stopId, out var numericStopId))
        {
            _logger.LogError("Invalid Vitrasa stop ID: {StopId}", stopId);
            return [];
        }

        var realtimeTask = _api.GetStopEstimates(numericStopId);
        var todayDate = nowLocal.Date.ToString("yyyy-MM-dd");

        // Load both today's and tomorrow's schedules to handle night services
        var timetableTask = LoadStopArrivalsProto(stopId, todayDate);

        // Wait for real-time data and today's schedule (required)
        await Task.WhenAll(realtimeTask, timetableTask);

        var realTimeEstimates = realtimeTask.Result.Estimates
            .Where(e => !string.IsNullOrWhiteSpace(e.Route) && !e.Route.Trim().EndsWith('*'))
            .ToList();

        // Handle case where schedule file doesn't exist - return realtime-only data
        if (timetableTask.Result == null)
        {
            _logger.LogWarning("No schedule data available for stop {StopId} on {Date}, returning realtime-only data", stopId, todayDate);

            var realtimeOnlyCirculations = realTimeEstimates.Select(estimate => new ConsolidatedCirculation
            {
                Line = estimate.Line,
                Route = estimate.Route,
                Schedule = null,
                RealTime = new RealTimeData
                {
                    Minutes = estimate.Minutes,
                    Distance = estimate.Meters
                }
            }).OrderBy(c => c.RealTime!.Minutes).ToList();

            return realtimeOnlyCirculations;
        }

        var timetable = timetableTask.Result.Arrivals
            .Where(c => c.StartingDateTime(nowLocal.Date) != null && c.CallingDateTime(nowLocal.Date) != null)
            .ToList();

        var stopLocation = timetableTask.Result.Location;

        var now = nowLocal.AddSeconds(60 - nowLocal.Second);
        // Define the scope end as the time of the last realtime arrival (no extra buffer)
        var scopeEnd = realTimeEstimates.Count > 0
            ? now.AddMinutes(Math.Min(realTimeEstimates.Max(e => e.Minutes) + 5, 75))
            : now.AddMinutes(60); // If no estimates, show next hour of scheduled only

        List<ConsolidatedCirculation> consolidatedCirculations = [];
        var usedTripIds = new HashSet<string>();

        foreach (var estimate in realTimeEstimates)
        {
            var estimatedArrivalTime = now.AddMinutes(estimate.Minutes);

            var possibleCirculations = timetable
                .Where(c =>
                {
                    // Match by line number
                    if (c.Line.Trim() != estimate.Line.Trim())
                        return false;

                    // Match by route (destination) - compare with both Route field and Terminus stop name
                    // Normalize both sides: remove non-ASCII-alnum characters and lowercase
                    var estimateRoute = NormalizeRouteName(estimate.Route);
                    var scheduleRoute = NormalizeRouteName(c.Route);
                    var scheduleTerminus = NormalizeRouteName(c.TerminusName);

                    // TODO: Replace ñapa with  fuzzy matching or better logic
                    return scheduleRoute == estimateRoute || scheduleTerminus == estimateRoute ||
                        scheduleRoute.Contains(estimateRoute) || estimateRoute.Contains(scheduleRoute);
                })
                .OrderBy(c => c.CallingDateTime(nowLocal.Date)!.Value)
                .ToArray();

            StopArrivals.Types.ScheduledArrival? closestCirculation = null;

            const int maxEarlyArrivalMinutes = 7;

            var bestMatch = possibleCirculations
                .Select(c => new
                {
                    Circulation = c,
                    TimeDiff = (c.CallingDateTime(nowLocal.Date)!.Value - estimatedArrivalTime).TotalMinutes
                })
                .Where(x => x.TimeDiff <= maxEarlyArrivalMinutes && x.TimeDiff >= -75)
                .OrderBy(x => Math.Abs(x.TimeDiff))
                .FirstOrDefault();

            if (bestMatch != null)
            {
                closestCirculation = bestMatch.Circulation;
            }

            if (closestCirculation == null)
            {
                // No scheduled match: include realtime-only entry
                _logger.LogWarning("No schedule match for realtime line {Line} towards {Route} in {Minutes} minutes (tried matching {NormalizedRoute})", estimate.Line, estimate.Route, estimate.Minutes, NormalizeRouteName(estimate.Route));
                consolidatedCirculations.Add(new ConsolidatedCirculation
                {
                    Line = estimate.Line,
                    Route = estimate.Route,
                    Schedule = null,
                    RealTime = new RealTimeData
                    {
                        Minutes = estimate.Minutes,
                        Distance = estimate.Meters
                    }
                });

                continue;
            }

            // Ensure each scheduled trip is only matched once to a realtime estimate
            if (usedTripIds.Contains(closestCirculation.TripId))
            {
                _logger.LogInformation("Skipping duplicate realtime match for TripId {TripId}", closestCirculation.TripId);
                continue;
            }

            var isRunning = closestCirculation.StartingDateTime(nowLocal.Date)!.Value <= now;
            Position? currentPosition = null;
            int? stopShapeIndex = null;
            bool usePreviousShape = false;

            consolidatedCirculations.Add(new ConsolidatedCirculation
            {
                Line = estimate.Line,
                Route = estimate.Route == closestCirculation.TerminusName ? closestCirculation.Route : estimate.Route,
                NextStreets = [.. closestCirculation.NextStreets],
                Schedule = new ScheduleData
                {
                    Running = isRunning,
                    Minutes = (int)(closestCirculation.CallingDateTime(nowLocal.Date)!.Value - now).TotalMinutes,
                    TripId = closestCirculation.TripId,
                    ServiceId = closestCirculation.ServiceId,
                    ShapeId = closestCirculation.ShapeId,
                },
                RealTime = new RealTimeData
                {
                    Minutes = estimate.Minutes,
                    Distance = estimate.Meters
                },
                CurrentPosition = currentPosition,
                StopShapeIndex = stopShapeIndex,
                IsPreviousTrip = usePreviousShape,
                PreviousTripShapeId = usePreviousShape ? closestCirculation.PreviousTripShapeId : null
            });

            usedTripIds.Add(closestCirculation.TripId);
        }

        // Add scheduled-only circulations between now and the last realtime arrival
        if (scopeEnd > now)
        {
            var matchedTripIds = new HashSet<string>(usedTripIds);

            var scheduledWindow = timetable
                .Where(c => c.CallingDateTime(nowLocal.Date)!.Value >= now && c.CallingDateTime(nowLocal.Date)!.Value <= scopeEnd)
                .OrderBy(c => c.CallingDateTime(nowLocal.Date)!.Value);

            foreach (var sched in scheduledWindow)
            {
                if (matchedTripIds.Contains(sched.TripId))
                {
                    continue; // already represented via a matched realtime
                }

                var minutes = (int)(sched.CallingDateTime(nowLocal.Date)!.Value - now).TotalMinutes;
                if (minutes == 0)
                {
                    continue;
                }

                consolidatedCirculations.Add(new ConsolidatedCirculation
                {
                    Line = sched.Line,
                    Route = sched.Route,
                    Schedule = new ScheduleData
                    {
                        Running = sched.StartingDateTime(nowLocal.Date)!.Value <= now,
                        Minutes = minutes,
                        TripId = sched.TripId,
                        ServiceId = sched.ServiceId,
                        ShapeId = sched.ShapeId,
                    },
                    RealTime = null
                });
            }
        }

        // Sort by ETA (RealTime minutes if present; otherwise Schedule minutes)
        var sorted = consolidatedCirculations
            .OrderBy(c => c.RealTime?.Minutes ?? c.Schedule!.Minutes)
            .Select(_lineFormatter.Format)
            .ToList();

        return sorted;
    }

    private async Task<StopArrivals?> LoadStopArrivalsProto(string stopId, string dateString)
    {
        return new StopArrivals();
        // var file = Path.Combine(_configuration.VitrasaScheduleBasePath, dateString, stopId + ".pb");
        // if (!SysFile.Exists(file))
        // {
        //     _logger.LogWarning("Stop arrivals proto file not found: {File}", file);
        //     return null;
        // }
        //
        // var contents = await SysFile.ReadAllBytesAsync(file);
        // var stopArrivals = StopArrivals.Parser.ParseFrom(contents);
        // return stopArrivals;
    }

    private static string NormalizeRouteName(string route)
    {
        var normalized = route.Trim().ToLowerInvariant();
        // Remove diacritics/accents first, then filter to alphanumeric
        normalized = RemoveDiacritics(normalized);
        return new string(normalized.Where(char.IsLetterOrDigit).ToArray());
    }

    private static string RemoveDiacritics(string text)
    {
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var stringBuilder = new StringBuilder();

        foreach (var c in normalizedString)
        {
            var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }

        return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
    }
}
