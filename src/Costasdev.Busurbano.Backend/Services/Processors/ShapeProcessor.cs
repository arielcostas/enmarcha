using Costasdev.Busurbano.Backend.GraphClient.App;

namespace Costasdev.Busurbano.Backend.Services.Processors;

public class ShapeProcessor : IArrivalsProcessor
{
    private readonly ILogger<ShapeProcessor> _logger;

    public ShapeProcessor(ILogger<ShapeProcessor> logger)
    {
        _logger = logger;
    }

    public Task ProcessAsync(ArrivalsContext context)
    {
        if (context.IsReduced)
        {
            return Task.CompletedTask;
        }

        foreach (var arrival in context.Arrivals)
        {
            if (arrival.RawOtpTrip is not ArrivalsAtStopResponse.Arrival otpArrival) continue;

            var encodedPoints = otpArrival.Trip.Geometry?.Points;
            if (string.IsNullOrEmpty(encodedPoints))
            {
                _logger.LogDebug("No geometry found for trip {TripId}", arrival.TripId);
                continue;
            }

            try
            {
                var points = Decode(encodedPoints);
                if (points.Count == 0) continue;

                arrival.Shape = new
                {
                    type = "Feature",
                    geometry = new
                    {
                        type = "LineString",
                        coordinates = points.Select(p => new[] { p.Lon, p.Lat }).ToList()
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error decoding shape for trip {TripId}", arrival.TripId);
            }
        }

        return Task.CompletedTask;
    }

    private static List<(double Lat, double Lon)> Decode(string encodedPoints)
    {
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
            sum = 0;
            shifter = 0;
            do
            {
                next5bits = (int)polylineChars[index++] - 63;
                sum |= (next5bits & 31) << shifter;
                shifter += 5;
            } while (next5bits >= 32 && index < polylineChars.Length);

            currentLat += (sum & 1) == 1 ? ~(sum >> 1) : (sum >> 1);

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
}
