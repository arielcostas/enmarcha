using System.Collections.Frozen;
using System.Globalization;
using System.Text.RegularExpressions;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Costasdev.VigoTransitApi;
using CsvHelper;
using CsvHelper.Configuration.Attributes;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Services.Providers;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;
using Enmarcha.Sources.Xunta;
using Position = Enmarcha.Backend.Types.Position;

namespace Enmarcha.Backend.Services.Processors.RealTime;

public class EquivalenceRecord
{
    [Name("contrato")] public required string Contract { get; set; }
    [Name("linea")] public required string Line { get; set; }
    [Name("nuevoCorto")] public required string NewShortName { get; set; }

    public string FullName => $"{Contract}{Line.PadLeft(3, '0')}";
}

public class XuntaRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly ILogger<XuntaRealTimeProcessor> _logger;
    private readonly XuntaRealtimeEstimatesProvider _provider;
    private readonly FrozenDictionary<string, string> _equivalenceMatrix;

    public XuntaRealTimeProcessor(
        ILogger<XuntaRealTimeProcessor> logger,
        XuntaRealtimeEstimatesProvider provider,
        IWebHostEnvironment env
    )
    {
        _logger = logger;
        _provider = provider;

        var filePath = Path.Combine(env.ContentRootPath, "Content", "xunta_route_equivalentes.csv");

        using var reader = new StreamReader(filePath);
        using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);

        // We do GroupBy first to prevent duplicates from throwing an exception
        _equivalenceMatrix = csv.GetRecords<EquivalenceRecord>()
            .ToFrozenDictionary(
                record => record.FullName,
                record => record.NewShortName
            );

    }

    public override async Task ProcessAsync(ArrivalsContext context)
    {
        if (!context.StopId.StartsWith("xunta:") || context.IsNano || context.IsReduced) return;

        var agencies = context.Arrivals
            .Where(a => a.AgencyId != null)
            .Select(a => a.AgencyId!)
            .Distinct()
            .ToArray();
        List<VehiclePositions> results;

        try
        {
            results = await _provider.GetEstimatesForAgencies(agencies);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching realtime information");
            return;
        }

        foreach (var res in results)
        {
            if (_equivalenceMatrix.ContainsKey(res.Trip.RouteShortName))
            {
                res.Trip.RouteShortName = _equivalenceMatrix[res.Trip.RouteShortName];
            }
        }

        foreach (var arrival in context.Arrivals)
        {
            var osn = arrival.Route.OriginalShortName;
            var osnPartsMaybe = osn.Split(" - ", 2);

            if (osnPartsMaybe.Length == 2)
            {
                osn = osnPartsMaybe[1];
            }

            var possibilities = results.Where(r => r.Trip.RouteShortName == osn &&
                                                   r.Trip.DirectionId.ToString() == arrival.RawOtpArrival?.Trip.DirectionId);
            foreach (var p in possibilities)
            {
                var totalSeconds = (int)TimeSpan.Parse(p.Trip.StartTime).TotalSeconds;

                if (totalSeconds == arrival.RawOtpArrival?.Trip.DepartureStoptime.ScheduledDeparture)
                {
                    arrival.CurrentPosition = new Position
                    {
                        Latitude = p.Position.Latitude,
                        Longitude = p.Position.Longitude,
                        Bearing = (int)p.Position.Bearing,
                    };
                    arrival.VehicleInformation = new VehicleBadge
                    {
                        Identifier = p.Vehicle.LicensePlate
                    };
                    arrival.Shift = new ShiftBadge
                    {
                        ShiftName = p.Trip.StartTime,
                        ShiftTrip = p.Trip.DirectionId == 1 ? "Vuelta" : "Ida"
                    };
                }

            }
        }
    }
}
