using System.ComponentModel.DataAnnotations;
using Enmarcha.Backend.Dto;
using Enmarcha.Backend.Providers.Normalisation;
using Enmarcha.Backend.Providers.RealTimeInformation;
using Enmarcha.Backend.Providers.StopUsage;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Types;
using Enmarcha.Sources.OpenTripPlannerGql;
using Enmarcha.Sources.OpenTripPlannerGql.Exceptions;
using FuzzySharp;
using Microsoft.AspNetCore.Mvc;
using StopArrivalsResponse = Enmarcha.Sources.OpenTripPlannerGql.Queries.V2.StopArrivalsResponse;

namespace Enmarcha.Backend.Controllers.Version2;

[ApiController]
[Route("api/v2/stops")]
public class StopsController : ControllerBase
{
    private readonly ILogger<StopsController> _logger;
    private readonly OpenTripPlannerClient _otpClient;
    private readonly IServiceProvider _serviceProvider;

    public StopsController(
        ILogger<StopsController> logger,
        OpenTripPlannerClient otpClient,
        IServiceProvider serviceProvider
    )
    {
        _logger = logger;
        _otpClient = otpClient;
        _serviceProvider = serviceProvider;
    }

    [HttpGet("")]
    [ResponseCache(VaryByQueryKeys = [nameof(q)], Duration = 60 * 60)]
    public async Task<ActionResult<List<StopSearchResult>>> SearchStops([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Problem(
                "Query parameter 'q' (query) is compulsory",
                type: "urn:enmarcha#MissingCompulsoryArgument",
                statusCode: 400
            );
        }

        var allStopsBasics = (await _otpClient.GetAllStopsBasics()).Stops;

        // 1. Exact or prefix matches by stop code
        var codeMatches = allStopsBasics
            .Where(s => s.Code != null && s.Code.StartsWith(q, StringComparison.OrdinalIgnoreCase))
            .OrderBy(s => s.Code?.Length)
            .Take(10)
            .ToList();

        // 2. Fuzzy search stops by label
        var fuzzyResults = Process.ExtractSorted(
            q,
            allStopsBasics.Select(s => $"{s.Name} {s.Code}"),
            cutoff: 60
        ).Take(10).Select(r => allStopsBasics[r.Index]).ToList();

        // Combine and deduplicate
        var results = codeMatches.Concat(fuzzyResults)
            .GroupBy(s => s.Code)
            .Select(g => g.First())
            .Take(10)
            .Select(s =>
                new StopSearchResult
                {
                    Id = s.GtfsId,
                    Code = s.Code,
                    Owner = FeedService.GetStopOwnerByStopGtfsId(s.GtfsId),
                    Name = s.Name,
                    Routes = s.Routes.Select(r => new StopSearchRoute
                        {
                            GtfsId = r.GtfsId,
                            ShortName = r.ShortName,
                            Color = r.Color,
                            TextColor = r.TextColor
                        }
                    )
                }
            ).ToList();

        return Ok(results);
    }

    [HttpGet("{id}")]
    [ResponseCache(Duration = 60 * 5)]
    public async Task<ActionResult<StopBasicInformation>> GetStopBasics(
        [FromRoute] string id
    )
    {
        try
        {
            var stopBasics = await _otpClient.GetStopBasics(id);

            var usageProvider = GetStopUsageProvider(id.Split(":", 2)[0]); // TODO: Unify this split logic somehow

            if (stopBasics.Stop is null)
            {
                return NotFound();
            }

            var hasUsageData = await usageProvider.HasUsageDataAsync(id);
            return Ok(
                new StopBasicInformation
                {
                    Id = id,
                    Code = stopBasics.Stop.Code,
                    Name = stopBasics.Stop.Name,
                    Owner = FeedService.GetStopOwnerByStopGtfsId(id),
                    Lon = stopBasics.Stop.Lon,
                    Lat = stopBasics.Stop.Lat,
                    Routes = stopBasics.Stop.Routes,
                    HasUsageData = hasUsageData
                }
            );
        }
        catch (OpenTripPlannerConnectionException e)
        {
            _logger.LogError(e, "Connection error from OpenTripPlanner");
            return Problem(
                e.Message,
                type: "urn:enmarcha#OpenTripPlannerConnectionException"
            );
        }
        catch (OpenTripPlannerErrorException e)
        {
            _logger.LogError(e, "Errors returned by OpenTripPlann");
            return Problem(
                e.Message,
                type: "urn:enmarcha#OpenTripPlannerError"
            );
        }
    }

    [HttpGet("{id}/estimates")]
    [ResponseCache(Duration = 10)]
    public async Task<ActionResult<StopEstimatesResponse>> GetStopEstimates(
        [FromRoute] string id,
        [FromQuery] bool includeGeometry,
        [FromQuery] bool includeVehiclePosition,
        [FromQuery, Range(0, int.MaxValue)] int limit // 0 -> everything
    )
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
        var nowLocal = TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);

        var feedId = id.Split(':')[0];

        var requestContent = await _otpClient.GetStopArrivals(id, includeGeometry || includeVehiclePosition);

        var stop = requestContent.Stop;
        _logger.LogInformation("Fetched {Count} arrivals for stop {StopName} ({StopId})", stop.Arrivals.Count,
            stop.Name, id);

        List<StopEstimate> estimates = [];
        foreach (var item in stop.Arrivals)
        {
            var serviceDayLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(item.ServiceDay), tz);
            var departureTime = serviceDayLocal.Date.AddSeconds(item.ScheduledAt);
            var minutesToArrive = (int)(departureTime - nowLocal).TotalMinutes;

            var operation = GetVehicleOperation(
                item,
                item.Trip.ArrivalStoptime.Stop.GtfsId == id && item.Trip.DepartureStoptime.Stop.GtfsId == id
            );

            string? departureFromOriginTime = null;
            if (item.Trip.DepartureStoptime.ScheduledDeparture is not null)
            {
                departureFromOriginTime = (DateTime.Today + TimeSpan.FromSeconds(item.Trip.DepartureStoptime
                    .ScheduledDeparture ?? 0)).ToString("HH:mm");
            }

            estimates.Add(new StopEstimate
            {
                TripId = item.Trip.GtfsId,
                Route = new RouteInfo
                {
                    GtfsId = item.Trip.Route.GtfsId,
                    OriginalShortName = item.Trip.RouteShortName,
                    ShortName = item.Trip.RouteShortName,
                    Colour = item.Trip.Route.Color ?? "FFFFFF",
                    TextColour = item.Trip.Route.TextColor ?? "000000"
                },
                Headsign = new HeadsignInfo
                {
                    Destination = item.Trip.TripHeadsign ?? item.Headsign
                },
                Estimate = new EstimateDetails
                {
                    Minutes = minutesToArrive
                },
                Circulation = new EstimateCirculation
                {
                    DepartureTime = departureFromOriginTime,
                    Way = item.Trip.DirectionId == "1" ? CirculationDirection.Inbound : CirculationDirection.Outbound
                },
                Shape = includeGeometry ? GenerateArrivalShape(item) : null,
                AgencyId = item.Trip.Route.Agency?.Id,
                Operator = feedId == "xunta" ? item.Trip.Route.Agency?.Name : null,
                Operation = operation,
                PatternId = item.Trip.Pattern?.Id,
                RawOtpArrival = item,
            });
        }

        var dataSources = GetStaticDataSources(feedId);

        var rtiProvider = GetRealTimeInformationProvider(feedId);
        if (rtiProvider is not null)
        {
            var rtinfo = await rtiProvider.ApplyRealtimeInformation(stop, estimates);
            estimates = rtinfo.arrivals;

            if (rtinfo.dataSources is not null)
            {
                dataSources.AddRange(rtinfo.dataSources);
            }
        }

        var normalisationProvider = GetNormalisationProvider(feedId);
        if (rtiProvider is not null)
        {
        }


        return Ok(new StopEstimatesResponse
        {
            Estimates = estimates,
            DataSources = dataSources
        });
    }

    private static object? GenerateArrivalShape(StopArrivalsResponse.Arrival arrival)
    {
        if (arrival.Trip.Geometry is not { Points: not null })
        {
            return null;
        }

        var decodedPoints = ShapeDecoder.Decode(arrival.Trip.Geometry.Points)
            .Select(p => new Position { Latitude = p.Lat, Longitude = p.Lon })
            .ToList();

        var features = new List<object>();
        features.Add(new
        {
            type = "Feature",
            geometry = new
            {
                type = "LineString",
                coordinates = decodedPoints.Select(p => new[] { p.Longitude, p.Latitude }).ToList()
            },
            properties = new { type = "route" }
        });

        // Add stops if available
        foreach (var stoptime in arrival.Trip.Stoptimes)
        {
            features.Add(new
            {
                type = "Feature",
                geometry = new
                {
                    type = "Point",
                    coordinates = new[] { stoptime.Stop.Lon, stoptime.Stop.Lat }
                },
                properties = new
                {
                    type = "stop",
                    name = stoptime.Stop.Name
                }
            });
        }

        return new
        {
            type = "FeatureCollection",
            features
        };
    }

    private static List<DataSource> GetStaticDataSources(string feedId)
    {
        return feedId switch
        {
            "vitrasa" =>
            [
                new DataSource
                {
                    DatasetName = "GTFS Vigo",
                    Authors = ["Concello de Vigo", "Viguesa de Transportes SL"],
                    Source = "Open Data Vigo",
                    Url = "https://datos-ckan.vigo.org/dataset/gtfs-vitrasa"
                },
                new DataSource
                {
                    DatasetName = "Arreglos feed Vitrasa",
                    Authors = ["arielcostas", "gmontes", "otros"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/build_vitrasa"
                }
            ],
            "renfe" =>
            [
                new DataSource
                {
                    DatasetName = "Media, Larga Distancia y AVE",
                    Authors = ["Renfe Viajeros SME S.A."],
                    Source = "NAP Transportes",
                    Url = "https://nap.transportes.gob.es/Files/Detail/897"
                },
                new DataSource
                {
                    DatasetName = "Generador de GTFS Renfe Galicia",
                    Authors = ["arielcostas", "gmontes", "otros"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/build_renfe"
                }
            ],
            "xunta" =>
            [
                new DataSource
                {
                    DatasetName = "Autobuses Xunta de Galicia",
                    Authors = ["Xunta de Galicia"],
                    Source = "NAP Transportes",
                    Url = "https://nap.transportes.gob.es/Files/Detail/1386"
                },
                new DataSource
                {
                    DatasetName = "Feed GTFS mejorado de la Xunta de Galicia",
                    Authors = ["arielcostas", "gmontes", "otros"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/build_xunta"
                }
            ],
            "tranvias" =>
            [
                new DataSource
                {
                    DatasetName = "Autobús urbano de la Coruña",
                    Authors = ["Compañía de Tranvías de La Coruña S.A."],
                    Source = "NAP Transportes",
                    Url = "https://nap.transportes.gob.es/Files/Detail/1376"
                },
                new DataSource
                {
                    DatasetName = "Generador de GTFS Transporte Urbano de A Coruña",
                    Authors = ["arielcostas", "gmontes", "otros"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/build_tranvias"
                }
            ],
            "lugo" =>
            [
                new DataSource
                {
                    DatasetName = "Feed autobuses urbanos de Lugo",
                    Authors = ["gmontes"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/custom_feeds"
                }
            ],
            "barco" =>
            [
                new DataSource
                {
                    DatasetName = "Feed barcos Ría de Vigo",
                    Authors = ["gmontes"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/custom_feeds"
                }
            ],
            "ourense" =>
            [
                new DataSource
                {
                    DatasetName = "Feed autobuses urbanos de Ourense",
                    Authors = ["arielcostas"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/custom_feeds"
                }
            ],
            "tussa" =>
            [
                new DataSource
                {
                    DatasetName = "Feed transporte urbano de Santiago",
                    Authors = ["arielcostas", "gmontes"],
                    Source = "Codeberg",
                    Url = "https://codeberg.org/tpgalicia/opentripplanner-galicia/src/branch/main/custom_feeds"
                }
            ],
            _ => []
        };
    }

    private static VehicleOperation GetVehicleOperation(
        StopArrivalsResponse.Arrival item,
        bool isCircular = false
    )
    {
        var pickup = item.PickupTypeParsed;
        var dropoff = item.DropoffTypeParsed;

        if (item.StopPositionInPattern == 0)
        {
            return VehicleOperation.Departure;
        }

        if (item.StopPositionInPattern == item.Trip.Stoptimes.Count - 1)
        {
            return isCircular ? VehicleOperation.CircularTerminus : VehicleOperation.Arrival;
        }

        // TODO: Handle coordinated pickup/dropoff (none atm)
        if (Equals(pickup, dropoff))
        {
            return VehicleOperation.PickupDropoff;
        }

        if (!Equals(pickup, StopArrivalsResponse.PickupType.None))
        {
            return VehicleOperation.PickupOnly;
        }

        if (!Equals(dropoff, StopArrivalsResponse.PickupType.None))
        {
            return VehicleOperation.DropoffOnly;
        }

        return VehicleOperation.PickupDropoff;
    }

    private IRealTimeInformationProvider? GetRealTimeInformationProvider(string feedId)
    {
        return _serviceProvider.GetKeyedService<IRealTimeInformationProvider>(feedId);
    }

    private INormalisationProvider? GetNormalisationProvider(string feedId)
    {
        return _serviceProvider.GetKeyedService<INormalisationProvider>(feedId);
    }

    // [HttpGet("{id}/timetable")]
    // [ResponseCache(VaryByQueryKeys = [nameof(date)], Duration = 60 * 5)]
    // public async Task<IActionResult> GetStopTimetable(
    //     [FromRoute] string id,
    //     [FromQuery] string date
    // )
    // {
    //     return Ok();
    // }

    [HttpGet("{id}/usage")]
    public async Task<ActionResult<StopUsageResponse>> GetStopUsage(
        [FromRoute] string id
    )
    {
        var usageProvider = GetStopUsageProvider(id.Split(":", 2)[0]); // TODO: Unify this split logic somehow
        var usageData = await usageProvider.GetUsageAsync(id);

        if (usageData is null)
        {
            return NotFound();
        }

        return Ok(new StopUsageResponse
        {
            Usage = usageData
        });
    }

    private IStopUsageProvider GetStopUsageProvider(string feedId)
    {
        // Resolves keyed provider if registered, otherwise falls back to NullUsageDataProvider
        return _serviceProvider.GetKeyedService<IStopUsageProvider>(feedId)
               ?? _serviceProvider.GetRequiredService<IStopUsageProvider>();
    }
}
