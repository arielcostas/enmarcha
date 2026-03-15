using System.Globalization;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using NodaTime;
using TransitRealtime;

namespace Enmarcha.Sources.GtfsRealtime;

public partial class GtfsRealtimeEstimatesProvider
{
    private HttpClient _http;
    private ILogger<GtfsRealtimeEstimatesProvider> _logger;

    [GeneratedRegex("^(?<tripId>[0-9]{5})[0-9](?<date>[0-9]{4}-[0-9]{2}-[0-9]{2})$")]
    private static partial Regex TripInformationExpression { get; }

    public GtfsRealtimeEstimatesProvider(HttpClient http, ILogger<GtfsRealtimeEstimatesProvider> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<FeedMessage> DownloadFeed(string url)
    {
        var response = await _http.GetAsync(url);
        var body = await response.Content.ReadAsByteArrayAsync();
        return FeedMessage.Parser.ParseFrom(body);
    }

    public async Task<Dictionary<string, int?>> GetRenfeDelays()
    {
        const string url = "https://gtfsrt.renfe.com/trip_updates_LD.pb";

        var feed = await DownloadFeed(url);

        var offsetInMadrid = DateTimeZoneProviders.Tzdb["Europe/Madrid"];
        var expectedDate = SystemClock.Instance
            .GetCurrentInstant()
            .InZone(offsetInMadrid).Date
            .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        Dictionary<string, int?> delays = new();

        foreach (var entity in feed.Entity)
        {
            if (entity.TripUpdate is null)
            {
                _logger.LogWarning("Entity {entityId} entity.Id has no trip updates", entity.Id);
                continue;
            }

            if (!entity.TripUpdate.Trip.HasTripId)
            {
                continue;
            }

            var tripId = entity.TripUpdate.Trip.TripId!;
            var idMatch = TripInformationExpression.Match(tripId);
            var trainNumber = idMatch.Groups["tripId"].Value;

            if (!idMatch.Success)
            {
                _logger.LogWarning("Unable to match {tripId} ({entityId}) into trip ID and date",
                    tripId, entity.Id);
                continue;
            }

            // TODO: Revise this, since apparently some trips appear with the previous day
            // if (expectedDate != idMatch.Groups["date"].Value)
            // {
            //     _logger.LogDebug("Entity {entityId} has trip ID {tripId} which is not for today",
            //         entity.Id, tripId);
            //     continue;
            // }

            if (entity.TripUpdate.Trip.HasScheduleRelationship &&
                entity.TripUpdate.Trip.ScheduleRelationship == TripDescriptor.Types.ScheduleRelationship.Canceled
               )
            {
                delays.TryAdd(trainNumber, null);
                continue;
            }

            if (!entity.TripUpdate.HasDelay)
            {
                _logger.LogDebug("Trip {tripId} ({entityId}) has no delay information, and is not cancelled", tripId,
                    entity.Id);
                continue;
            }

            delays.TryAdd(trainNumber, entity.TripUpdate.Delay);
        }

        return delays;
    }

    public async Task<Dictionary<string, Coordinates>> GetRenfePositions()
    {
        const string url = "https://gtfsrt.renfe.com/vehicle_positions_LD.pb";

        var feed = await DownloadFeed(url);

        var offsetInMadrid = DateTimeZoneProviders.Tzdb["Europe/Madrid"];
        var expectedDate = SystemClock.Instance
            .GetCurrentInstant()
            .InZone(offsetInMadrid).Date
            .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        Dictionary<string, Coordinates> positions = new();

        foreach (var entity in feed.Entity)
        {
            if (entity.Vehicle?.Position is null)
            {
                _logger.LogWarning("Entity {entityId} entity.Id has no vehicle information", entity.Id);
                continue;
            }

            if (!entity.Vehicle.Trip.HasTripId)
            {
                continue;
            }

            var tripId = entity.Vehicle.Trip.TripId!;
            var idMatch = TripInformationExpression.Match(tripId);
            var trainNumber = idMatch.Groups["tripId"].Value;

            if (!idMatch.Success)
            {
                _logger.LogWarning("Unable to match {tripId} ({entityId}) into trip ID and date",
                    tripId, entity.Id);
                continue;
            }

            // TODO: Revise this, since apparently some trips appear with the previous day
            // if (expectedDate != idMatch.Groups["date"].Value)
            // {
            //     _logger.LogDebug("Entity {entityId} has trip ID {tripId} which is not for today",
            //         entity.Id, tripId);
            //     continue;
            // }

            positions.TryAdd(trainNumber, new Coordinates
            {
                Latitude =  entity.Vehicle.Position.Latitude,
                Longitude =  entity.Vehicle.Position.Longitude
            });

        }

        return positions;


    }
}

public class Coordinates
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}
