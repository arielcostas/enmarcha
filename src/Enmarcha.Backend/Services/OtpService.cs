using System.Globalization;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Helpers;
using Enmarcha.Backend.Types.Otp;
using Enmarcha.Backend.Types.Planner;
using Enmarcha.Backend.Types.Transit;
using Enmarcha.Sources.OpenTripPlannerGql;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Services;

public class OtpService
{
    private readonly HttpClient _httpClient;
    private readonly AppConfiguration _config;
    private readonly IMemoryCache _cache;
    private readonly ILogger<OtpService> _logger;
    private readonly FareService _fareService;
    private readonly LineFormatterService _lineFormatter;
    private readonly FeedService _feedService;

    public OtpService(HttpClient httpClient, IOptions<AppConfiguration> config, IMemoryCache cache, ILogger<OtpService> logger, FareService fareService, LineFormatterService lineFormatter, FeedService feedService)
    {
        _httpClient = httpClient;
        _config = config.Value;
        _cache = cache;
        _logger = logger;
        _fareService = fareService;
        _lineFormatter = lineFormatter;
        _feedService = feedService;
    }

    public RouteDto MapRoute(RoutesListResponse.RouteItem route)
    {
        var feedId = route.GtfsId.Split(':')[0];
        return new RouteDto
        {
            Id = route.GtfsId,
            ShortName = _feedService.NormalizeRouteShortName(feedId, route.ShortName ?? string.Empty),
            LongName = route.LongName,
            Color = route.Color,
            TextColor = route.TextColor,
            SortOrder = route.SortOrder,
            AgencyName = route.Agency?.Name,
            TripCount = route.Patterns.Sum(p => p.TripsForDate.Count)
        };
    }

    public RouteDetailsDto MapRouteDetails(RouteDetailsResponse.RouteItem route)
    {
        var feedId = route.GtfsId?.Split(':')[0] ?? "unknown";
        return new RouteDetailsDto
        {
            ShortName = _feedService.NormalizeRouteShortName(feedId, route.ShortName ?? string.Empty),
            LongName = route.LongName,
            Color = route.Color,
            TextColor = route.TextColor,
            AgencyName = route.Agency?.Name,
            Patterns = route.Patterns.Select(p => MapPattern(p, feedId)).ToList()
        };
    }

    private PatternDto MapPattern(RouteDetailsResponse.PatternItem pattern, string feedId)
    {
        return new PatternDto
        {
            Id = pattern.Id,
            Name = pattern.Name,
            Headsign = pattern.Headsign,
            DirectionId = pattern.DirectionId,
            Code = pattern.Code,
            SemanticHash = pattern.SemanticHash,
            TripCount = pattern.TripsForDate.Count,
            Geometry = DecodePolyline(pattern.PatternGeometry?.Points)?.Coordinates,
            Stops = pattern.Stops.Select((s, i) => new PatternStopDto
            {
                Id = s.GtfsId,
                Code = _feedService.NormalizeStopCode(feedId, s.Code ?? string.Empty),
                Name = _feedService.NormalizeStopName(feedId, s.Name),
                Lat = s.Lat,
                Lon = s.Lon,
                ScheduledDepartures = pattern.TripsForDate
                    .Select(t => t.Stoptimes.ElementAtOrDefault(i)?.ScheduledDeparture ?? -1)
                    .Where(d => d != -1)
                    .OrderBy(d => d)
                    .ToList()
            }).ToList()
        };
    }

    public async Task<List<StopTileResponse.Stop>> GetStopsByBboxAsync(double minLon, double minLat, double maxLon, double maxLat)
    {
        const string cacheKey = "otp_all_stops_detailed";
        if (_cache.TryGetValue(cacheKey, out List<StopTileResponse.Stop>? cachedStops) && cachedStops != null)
        {
            return cachedStops;
        }

        try
        {
            var bbox = new StopTileRequestContent.Bbox(minLon, minLat, maxLon, maxLat);
            var query = StopTileRequestContent.Query(bbox);

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.OpenTripPlannerBaseUrl}/gtfs/v1");
            request.Content = JsonContent.Create(new GraphClientRequest { Query = query });

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<StopTileResponse>>();

            if (responseBody is not { IsSuccess: true } || responseBody.Data?.StopsByBbox == null)
            {
                _logger.LogError("Error fetching stops from OTP for caching");
                return new List<StopTileResponse.Stop>();
            }

            var stops = responseBody.Data.StopsByBbox;
            _cache.Set(cacheKey, stops, TimeSpan.FromHours(18));
            return stops;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception fetching stops from OTP for caching");
            return new List<StopTileResponse.Stop>();
        }
    }

    private Leg MapLeg(OtpLeg otpLeg)
    {
        return new Leg
        {
            Mode = otpLeg.Mode,
            RouteName = otpLeg.Route,
            RouteShortName = otpLeg.RouteShortName,
            RouteLongName = otpLeg.RouteLongName,
            Headsign = otpLeg.Headsign,
            AgencyName = otpLeg.AgencyName,
            RouteColor = otpLeg.RouteColor,
            RouteTextColor = otpLeg.RouteTextColor,
            From = MapPlace(otpLeg.From),
            To = MapPlace(otpLeg.To),
            StartTime = DateTimeOffset.FromUnixTimeMilliseconds(otpLeg.StartTime).UtcDateTime,
            EndTime = DateTimeOffset.FromUnixTimeMilliseconds(otpLeg.EndTime).UtcDateTime,
            DistanceMeters = otpLeg.Distance,
            Geometry = DecodePolyline(otpLeg.LegGeometry?.Points),
            Steps = otpLeg.Steps.Select(MapStep).ToList(),
            IntermediateStops = otpLeg.IntermediateStops.Select(MapPlace).Where(p => p != null).Cast<PlannerPlace>().ToList()
        };
    }

    private PlannerPlace? MapPlace(OtpPlace? otpPlace)
    {
        if (otpPlace == null) return null;
        var feedId = otpPlace.StopId?.Split(':')[0] ?? "unknown";
        return new PlannerPlace
        {
            Name = _feedService.NormalizeStopName(feedId, otpPlace.Name),
            Lat = otpPlace.Lat,
            Lon = otpPlace.Lon,
            StopId = otpPlace.StopId, // Use string directly
            StopCode = _feedService.NormalizeStopCode(feedId, otpPlace.StopCode ?? string.Empty)
        };
    }

    private Step MapStep(OtpWalkStep otpStep)
    {
        return new Step
        {
            DistanceMeters = otpStep.Distance,
            RelativeDirection = otpStep.RelativeDirection,
            AbsoluteDirection = otpStep.AbsoluteDirection,
            StreetName = otpStep.StreetName,
            Lat = otpStep.Lat,
            Lon = otpStep.Lon
        };
    }

    private PlannerGeometry? DecodePolyline(string? encodedPoints)
    {
        if (string.IsNullOrEmpty(encodedPoints)) return null;

        var coordinates = Decode(encodedPoints);
        return new PlannerGeometry
        {
            Coordinates = coordinates.Select(c => new List<double> { c.Lon, c.Lat }).ToList()
        };
    }

    // Polyline decoding algorithm
    private static List<(double Lat, double Lon)> Decode(string encodedPoints)
    {
        if (string.IsNullOrEmpty(encodedPoints))
            return new List<(double, double)>();

        var poly = new List<(double, double)>();
        char[] polylineChars = encodedPoints.ToCharArray();
        int index = 0;

        int currentLat = 0;
        int currentLng = 0;
        int next5bits;
        int sum;
        int shifter;

        while (index < polylineChars.Length)
        {
            // calculate next latitude
            sum = 0;
            shifter = 0;
            do
            {
                next5bits = (int)polylineChars[index++] - 63;
                sum |= (next5bits & 31) << shifter;
                shifter += 5;
            } while (next5bits >= 32 && index < polylineChars.Length);

            if (index >= polylineChars.Length)
                break;

            currentLat += (sum & 1) == 1 ? ~(sum >> 1) : (sum >> 1);

            // calculate next longitude
            sum = 0;
            shifter = 0;
            do
            {
                next5bits = (int)polylineChars[index++] - 63;
                sum |= (next5bits & 31) << shifter;
                shifter += 5;
            } while (next5bits >= 32 && index < polylineChars.Length);

            currentLng += (sum & 1) == 1 ? ~(sum >> 1) : (sum >> 1);

            poly.Add((Convert.ToDouble(currentLat) / 100000.0, Convert.ToDouble(currentLng) / 100000.0));
        }

        return poly;
    }

    public RoutePlan MapPlanResponse(PlanConnectionResponse response)
    {
        var itineraries = response.PlanConnection.Edges
            .Select(e => MapItinerary(e.Node))
            .ToList();

        return new RoutePlan
        {
            Itineraries = itineraries
        };
    }

    private Itinerary MapItinerary(PlanConnectionResponse.Node node)
    {
        var legs = node.Legs.Select(MapLeg).ToList();
        var fares = _fareService.CalculateFare(legs);

        return new Itinerary
        {
            DurationSeconds = node.DurationSeconds,
            StartTime = DateTime.Parse(node.Start8601, null, DateTimeStyles.RoundtripKind),
            EndTime = DateTime.Parse(node.End8601, null, DateTimeStyles.RoundtripKind),
            WalkDistanceMeters = node.WalkDistance,
            WalkTimeSeconds = node.WalkSeconds,
            TransitTimeSeconds = node.DurationSeconds - node.WalkSeconds - node.WaitingSeconds,
            WaitingTimeSeconds = node.WaitingSeconds,
            Legs = legs,
            CashFare = fares.CashFareEuro,
            CashFareIsTotal = fares.CashFareIsTotal,
            CardFare = fares.CardFareEuro,
            CardFareIsTotal = fares.CardFareIsTotal
        };
    }

    private Leg MapLeg(PlanConnectionResponse.Leg leg)
    {
        var feedId = leg.From.Stop?.GtfsId?.Split(':')[0] ?? "unknown";
        var shortName = _feedService.NormalizeRouteShortName(feedId, leg.Route?.ShortName ?? string.Empty);
        var headsign = leg.Headsign;

        if (feedId == "vitrasa")
        {
            headsign = headsign?.Replace("*", "");
            if (headsign == "FORA DE SERVIZO.G.B.")
            {
                headsign = "García Barbón, 7 (fora de servizo)";
            }

            switch (shortName)
            {
                case "A" when headsign != null && headsign.StartsWith("\"1\""):
                    shortName = "A1";
                    headsign = headsign.Replace("\"1\"", "");
                    break;
                case "6":
                    headsign = headsign?.Replace("\"", "");
                    break;
                case "FUT":
                    if (headsign == "CASTELAO-CAMELIAS-G.BARBÓN.M.GARRIDO")
                    {
                        shortName = "MAR";
                        headsign = "MARCADOR ⚽: CASTELAO-CAMELIAS-G.BARBÓN.M.GARRIDO";
                    }
                    else if (headsign == "P. ESPAÑA-T.VIGO-S.BADÍA")
                    {
                        shortName = "RIO";
                        headsign = "RÍO ⚽: P. ESPAÑA-T.VIGO-S.BADÍA";
                    }
                    else if (headsign == "NAVIA-BOUZAS-URZAIZ-G. ESPINO")
                    {
                        shortName = "GOL";
                        headsign = "GOL ⚽: NAVIA-BOUZAS-URZAIZ-G. ESPINO";
                    }
                    break;
            }
        }

        var color = leg.Route?.Color;
        var textColor = leg.Route?.TextColor;

        if (string.IsNullOrEmpty(color) || color == "FFFFFF")
        {
            var (fallbackColor, fallbackTextColor) = _feedService.GetFallbackColourForFeed(feedId);
            color = fallbackColor.Replace("#", "");
            textColor = fallbackTextColor.Replace("#", "");
        }
        else if (string.IsNullOrEmpty(textColor) || textColor == "000000")
        {
            textColor = ContrastHelper.GetBestTextColour(color).Replace("#", "");
        }

        return new Leg
        {
            Mode = leg.Mode,
            FeedId = feedId,
            RouteId = leg.Route?.GtfsId,
            RouteName = leg.Route?.LongName,
            RouteShortName = shortName,
            RouteLongName = leg.Route?.LongName,
            Headsign = headsign,
            AgencyName = leg.Route?.Agency?.Name,
            RouteColor = color,
            RouteTextColor = textColor,
            From = MapPlace(leg.From),
            To = MapPlace(leg.To),
            StartTime = DateTime.Parse(leg.Start.ScheduledTime8601, null, DateTimeStyles.RoundtripKind),
            EndTime = DateTime.Parse(leg.End.ScheduledTime8601, null, DateTimeStyles.RoundtripKind),
            DistanceMeters = leg.Distance,
            Geometry = DecodePolyline(leg.LegGeometry?.Points),
            Steps = leg.Steps.Select(MapStep).ToList(),
            IntermediateStops = leg.StopCalls.Select(sc => MapPlace(sc.StopLocation)).ToList()
        };
    }

    private PlannerPlace MapPlace(PlanConnectionResponse.LegPosition pos)
    {
        var feedId = pos.Stop?.GtfsId?.Split(':')[0] ?? "unknown";
        return new PlannerPlace
        {
            Name = _feedService.NormalizeStopName(feedId, pos.Name),
            Lat = pos.Latitude,
            Lon = pos.Longitude,
            StopId = pos.Stop?.GtfsId,
            StopCode = _feedService.NormalizeStopCode(feedId, pos.Stop?.Code ?? string.Empty),
            ZoneId = pos.Stop?.ZoneId
        };
    }

    private PlannerPlace MapPlace(PlanConnectionResponse.StopLocation stop)
    {
        var feedId = stop.GtfsId?.Split(':')[0] ?? "unknown";
        return new PlannerPlace
        {
            Name = _feedService.NormalizeStopName(feedId, stop.Name),
            Lat = stop.Latitude,
            Lon = stop.Longitude,
            StopId = stop.GtfsId,
            StopCode = _feedService.NormalizeStopCode(feedId, stop.Code ?? string.Empty)
        };
    }

    private Step MapStep(PlanConnectionResponse.Step step)
    {
        return new Step
        {
            DistanceMeters = step.Distance,
            RelativeDirection = step.RelativeDirection,
            AbsoluteDirection = step.AbsoluteDirection,
            StreetName = step.StreetName,
            Lat = step.Latitude,
            Lon = step.Longitude
        };
    }
}
