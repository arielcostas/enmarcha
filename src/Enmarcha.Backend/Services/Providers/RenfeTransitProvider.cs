using Enmarcha.Backend.Extensions;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Types;
using Microsoft.Extensions.Options;
using SysFile = System.IO.File;

namespace Enmarcha.Backend.Services.Providers;

[Obsolete]
public class RenfeTransitProvider : ITransitProvider
{
    private readonly AppConfiguration _configuration;
    private readonly ILogger<RenfeTransitProvider> _logger;

    public RenfeTransitProvider(IOptions<AppConfiguration> options, ILogger<RenfeTransitProvider> logger)
    {
        _configuration = options.Value;
        _logger = logger;
    }

    public async Task<List<ConsolidatedCirculation>> GetCirculationsAsync(string stopId, DateTime nowLocal)
    {
        var todayDate = nowLocal.Date.ToString("yyyy-MM-dd");
        StopArrivals stopArrivals = null!;

        if (stopArrivals == null)
        {
            return [];
        }

        var now = nowLocal.AddSeconds(60 - nowLocal.Second);
        var scopeEnd = now.AddMinutes(8 * 60);

        var scheduledWindow = stopArrivals.Arrivals
            .Where(c => c.CallingDateTime(nowLocal.Date) != null)
            .Where(c => c.CallingDateTime(nowLocal.Date)!.Value >= now && c.CallingDateTime(nowLocal.Date)!.Value <= scopeEnd)
            .OrderBy(c => c.CallingDateTime(nowLocal.Date)!.Value);

        var consolidatedCirculations = new List<ConsolidatedCirculation>();

        foreach (var sched in scheduledWindow)
        {
            var minutes = (int)(sched.CallingDateTime(nowLocal.Date)!.Value - now).TotalMinutes;

            consolidatedCirculations.Add(new ConsolidatedCirculation
            {
                Line = sched.Line,
                Route = sched.Route,
                Schedule = new ScheduleData
                {
                    Running = sched.StartingDateTime(nowLocal.Date)!.Value <= now,
                    Minutes = minutes,
                    TripId = sched.ServiceId[(sched.ServiceId.Length - 6)..(sched.ServiceId.Length - 1)],
                    ServiceId = sched.ServiceId[(sched.ServiceId.Length - 6)..(sched.ServiceId.Length - 1)],
                    ShapeId = sched.ShapeId,
                },
                RealTime = null,
                NextStreets = [.. sched.NextStreets]
            });
        }

        return consolidatedCirculations;
    }
}
