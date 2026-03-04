using Enmarcha.Sources.CtagShuttle;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Backend.Types;
using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services.Processors;

public class CtagShuttleRealTimeProcessor : AbstractRealTimeProcessor
{
    private readonly CtagShuttleRealtimeEstimatesProvider _shuttleProvider;
    private readonly ShapeTraversalService _shapeService;
    private readonly ILogger<CtagShuttleRealTimeProcessor> _logger;

    // Maximum distance (in meters) a GPS coordinate can be from the route shape to be considered valid
    private const double MaxDistanceFromShape = 100.0;

    // Maximum age (in minutes) for position data to be considered fresh
    private const double MaxPositionAgeMinutes = 3.0;

    public CtagShuttleRealTimeProcessor(
        CtagShuttleRealtimeEstimatesProvider shuttleProvider,
        ShapeTraversalService shapeService,
        ILogger<CtagShuttleRealTimeProcessor> logger)
    {
        _shuttleProvider = shuttleProvider;
        _shapeService = shapeService;
        _logger = logger;
    }

    public override async Task ProcessAsync(ArrivalsContext context)
    {
        // Only process shuttle stops
        if (!context.StopId.StartsWith("shuttle:"))
        {
            return;
        }

        try
        {
            // Fetch current shuttle status
            var status = await _shuttleProvider.GetShuttleStatus();
            System.Diagnostics.Activity.Current?.SetTag("shuttle.status", status.StatusValue);

            // Validate position timestamp - skip if data is stale (>3 minutes old)
            // Convert UTC timestamp to Madrid time for comparison
            var madridTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
            var lastPositionMadrid = TimeZoneInfo.ConvertTimeFromUtc(status.LastPositionAt, madridTz);
            var positionAge = (context.NowLocal - lastPositionMadrid).TotalMinutes;
            if (positionAge > MaxPositionAgeMinutes)
            {
                _logger.LogInformation(
                    "Shuttle position is stale ({Age:F1} minutes old), skipping real-time update",
                    positionAge);
                return;
            }

            // Skip processing if shuttle is idle
            if (status.StatusValue.Equals("idle", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Shuttle is idle, skipping real-time update");
                return;
            }

            // No arrivals to process
            if (context.Arrivals.Count == 0)
            {
                _logger.LogWarning("No scheduled arrivals found for shuttle stop {StopId}", context.StopId);
                return;
            }

            // Transform shuttle GPS position to EPSG:25829 (meters)
            var shuttlePosition = _shapeService.TransformToEpsg25829(status.Latitude, status.Longitude);
            _logger.LogDebug("Shuttle position: Lat={Lat}, Lon={Lon} -> X={X}, Y={Y}",
                status.Latitude, status.Longitude, shuttlePosition.X, shuttlePosition.Y);

            // Get the shape from the first arrival (assuming single circular route)
            var firstArrival = context.Arrivals.First();
            if (firstArrival.RawOtpTrip is not ArrivalsAtStopResponse.Arrival otpArrival ||
                otpArrival.Trip.Geometry?.Points == null)
            {
                _logger.LogWarning("No shape geometry available for shuttle trip");
                return;
            }

            // Decode polyline and create shape
            var decodedPoints = Decode(otpArrival.Trip.Geometry.Points)
                .Select(p => new Position { Latitude = p.Lat, Longitude = p.Lon })
                .ToList();
            var shape = _shapeService.CreateShapeFromWgs84(decodedPoints);

            if (shape.Points.Count == 0)
            {
                _logger.LogWarning("Shape has no points");
                return;
            }

            // Find closest point on shape to shuttle's current position
            var (closestPointIndex, distanceToShape) = FindClosestPointOnShape(shape.Points.ToList(), shuttlePosition);

            // Validate that shuttle is reasonably close to the route
            if (distanceToShape > MaxDistanceFromShape)
            {
                _logger.LogWarning(
                    "Shuttle position is {Distance:F1}m from route (threshold: {Threshold}m), skipping update",
                    distanceToShape, MaxDistanceFromShape);
                return;
            }

            // Calculate distance from shape start to shuttle's current position
            var shuttleDistanceAlongShape = CalculateTotalDistanceToPoint(shape.Points.ToArray(), closestPointIndex);
            _logger.LogDebug("Shuttle is {Distance:F1}m along the shape", shuttleDistanceAlongShape);

            // Calculate total shape length
            var totalShapeLength = CalculateTotalShapeLength(shape.Points.ToArray());

            if (context.StopLocation == null)
            {
                _logger.LogWarning("Stop location not available for shuttle stop {StopId}", context.StopId);
                return;
            }

            // Transform stop location to EPSG:25829
            var stopLocation = _shapeService.TransformToEpsg25829(
                context.StopLocation.Latitude,
                context.StopLocation.Longitude);

            // Find closest point on shape to this stop
            var (stopPointIndex, _) = FindClosestPointOnShape(shape.Points.ToList(), stopLocation);
            var stopDistanceAlongShape = CalculateTotalDistanceToPoint(shape.Points.ToArray(), stopPointIndex);

            // Calculate remaining distance from shuttle to stop
            var remainingDistance = stopDistanceAlongShape - shuttleDistanceAlongShape;

            // Handle circular route wraparound (if shuttle is past the stop on the loop)
            if (remainingDistance < 0)
            {
                remainingDistance += totalShapeLength;
            }

            _logger.LogDebug("Remaining distance to stop: {Distance:F1}m", remainingDistance);

            // Calculate estimated minutes based on distance and reasonable shuttle speed
            // Assume average urban shuttle speed of 20 km/h = 333 meters/minute
            const double metersPerMinute = 333.0;
            int estimatedMinutesForActive;

            if (remainingDistance < 50) // Within 50 meters
            {
                estimatedMinutesForActive = 0;
            }
            else
            {
                // Calculate time based on distance
                var minutesFromDistance = remainingDistance / metersPerMinute;
                estimatedMinutesForActive = (int)Math.Ceiling(minutesFromDistance);
            }

            _logger.LogDebug("Calculated ETA: {Minutes} min for {Distance:F1}m", estimatedMinutesForActive, remainingDistance);

            // Find the active trip - should be one where:
            // 1. Scheduled time is in the future (or very recent past, max -2 min for "arriving now" scenarios)
            // 2. Scheduled time is reasonably close to our calculated ETA
            var activeArrival = context.Arrivals
                .Where(a => a.Estimate.Minutes >= -2) // Only consider upcoming or very recent arrivals
                .Select(a => new
                {
                    Arrival = a,
                    TimeDiff = Math.Abs(a.Estimate.Minutes - estimatedMinutesForActive)
                })
                .Where(x => x.TimeDiff < 45) // Only consider if within 45 minutes difference from our estimate
                .OrderBy(x => x.TimeDiff)
                .FirstOrDefault()?.Arrival;

            // Fallback: if no good match, use the next upcoming arrival
            if (activeArrival == null)
            {
                activeArrival = context.Arrivals
                    .Where(a => a.Estimate.Minutes >= 0)
                    .OrderBy(a => a.Estimate.Minutes)
                    .FirstOrDefault();
                
                _logger.LogDebug("No matching arrival found, using next upcoming trip");
            }

            // If we found an active trip, update it with real-time data
            if (activeArrival != null)
            {
                var scheduledMinutes = activeArrival.Estimate.Minutes;
                activeArrival.Estimate.Minutes = estimatedMinutesForActive;
                activeArrival.Estimate.Precision = ArrivalPrecision.Confident;

                // Calculate delay badge
                var delayMinutes = estimatedMinutesForActive - scheduledMinutes;
                if (delayMinutes != 0)
                {
                    activeArrival.Delay = new DelayBadge { Minutes = delayMinutes };
                }

                // Set current position for visualization
                var shuttleWgs84 = new Position
                {
                    Latitude = status.Latitude,
                    Longitude = status.Longitude
                };

                // Calculate bearing from shuttle to next point on shape
                if (closestPointIndex < shape.Points.Count - 1)
                {
                    var currentPoint = shape.Points[closestPointIndex];
                    var nextPoint = shape.Points[closestPointIndex + 1];
                    var dx = nextPoint.X - currentPoint.X;
                    var dy = nextPoint.Y - currentPoint.Y;
                    var bearing = Math.Atan2(dx, dy) * 180.0 / Math.PI;
                    if (bearing < 0) bearing += 360.0;
                    shuttleWgs84.OrientationDegrees = (int)Math.Round(bearing);
                }

                activeArrival.CurrentPosition = shuttleWgs84;
                activeArrival.StopShapeIndex = stopPointIndex;

                _logger.LogInformation(
                    "Updated active trip {TripId}: {Minutes} min (was {Scheduled} min, delay: {Delay} min, distance: {Distance:F1}m)",
                    activeArrival.TripId, estimatedMinutesForActive, scheduledMinutes, delayMinutes, remainingDistance);

                _logger.LogInformation(
                    "Shuttle position set: Lat={Lat}, Lon={Lon}, Bearing={Bearing}°",
                    shuttleWgs84.Latitude, shuttleWgs84.Longitude, shuttleWgs84.OrientationDegrees);
            }
            else
            {
                _logger.LogWarning("Could not determine active trip for shuttle");
            }

            System.Diagnostics.Activity.Current?.SetTag("shuttle.active_trip_updated", activeArrival != null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing shuttle real-time data for stop {StopId}", context.StopId);
            // Don't throw - allow scheduled data to be returned
        }
    }

    /// <summary>
    /// Finds the closest point on the shape to the given location and returns the index and distance
    /// </summary>
    private (int Index, double Distance) FindClosestPointOnShape(List<Epsg25829> shapePoints, Epsg25829 location)
    {
        var minDistance = double.MaxValue;
        var closestIndex = 0;

        for (int i = 0; i < shapePoints.Count; i++)
        {
            var distance = CalculateDistance(shapePoints[i], location);
            if (distance < minDistance)
            {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return (closestIndex, minDistance);
    }

    /// <summary>
    /// Calculates Euclidean distance between two points in meters
    /// </summary>
    private double CalculateDistance(Epsg25829 p1, Epsg25829 p2)
    {
        var dx = p1.X - p2.X;
        var dy = p1.Y - p2.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    /// <summary>
    /// Calculates the total distance along the shape from the start to a given index
    /// </summary>
    private double CalculateTotalDistanceToPoint(Epsg25829[] shapePoints, int endIndex)
    {
        if (endIndex <= 0 || shapePoints.Length == 0)
        {
            return 0;
        }

        double totalDistance = 0;
        for (int i = 1; i <= endIndex && i < shapePoints.Length; i++)
        {
            totalDistance += CalculateDistance(shapePoints[i - 1], shapePoints[i]);
        }

        return totalDistance;
    }

    /// <summary>
    /// Calculates the total length of the entire shape
    /// </summary>
    private double CalculateTotalShapeLength(Epsg25829[] shapePoints)
    {
        if (shapePoints.Length <= 1)
        {
            return 0;
        }

        double totalDistance = 0;
        for (int i = 1; i < shapePoints.Length; i++)
        {
            totalDistance += CalculateDistance(shapePoints[i - 1], shapePoints[i]);
        }

        return totalDistance;
    }
}
