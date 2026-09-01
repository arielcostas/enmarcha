using System.Collections.Frozen;
using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration.Attributes;
using Enmarcha.Backend.Dto;
using Enmarcha.Sources.Xunta;
using Position = Enmarcha.Backend.Types.Position;
using StopArrivalsResponse = Enmarcha.Sources.OpenTripPlannerGql.Queries.V2.StopArrivalsResponse;

namespace Enmarcha.Backend.Providers.RealTimeInformation;

public class EquivalenceRecord
{
    [Name("contrato")] public required string Contract { get; set; }
    [Name("linea")] public required string Line { get; set; }
    [Name("nuevoCorto")] public required string NewShortName { get; set; }

    public string FullName => $"{Contract}{Line.PadLeft(3, '0')}";
}

public class XuntaRealTimeInformationProvider : IRealTimeInformationProvider
{
    private readonly ILogger<XuntaRealTimeInformationProvider> _logger;
    private readonly XuntaRealtimeEstimatesProvider _provider;
    private readonly FrozenDictionary<string, string> _equivalenceMatrix;

    public XuntaRealTimeInformationProvider(
        ILogger<XuntaRealTimeInformationProvider> logger,
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

    public async Task<(List<StopEstimate> arrivals, IEnumerable<DataSource>? dataSources)> ApplyRealtimeInformation(
        StopArrivalsResponse.StopItem stop,
        List<StopEstimate> arrivals
    )
    {
        var agencies = arrivals
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
            return (arrivals, []);
        }

        foreach (var res in results)
        {
            if (res.Trip.RouteShortName != null && _equivalenceMatrix.ContainsKey(res.Trip.RouteShortName))
            {
                res.Trip.RouteShortName = _equivalenceMatrix[res.Trip.RouteShortName];
            }
        }

        foreach (var arrival in arrivals)
        {
            var osn = arrival.Route.OriginalShortName;
            var osnPartsMaybe = osn.Split(" - ", 2);

            if (osnPartsMaybe.Length == 2)
            {
                osn = osnPartsMaybe[1];
            }

            var possibilities = results.Where(r => r.Trip.RouteShortName == osn &&
                                                   r.Trip.DirectionId.ToString() ==
                                                   arrival.RawOtpArrival?.Trip.DirectionId);
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
                        Speed = p.Position.Speed * 3.6
                    };
                    arrival.VehicleInformation = new VehicleInformation
                    {
                        NumberPlate = p.Vehicle.LicensePlate
                    };
                }
            }
        }

        return (arrivals, []);
    }
}
