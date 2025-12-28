using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Types;
using Microsoft.Extensions.Options;
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;
using SysFile = System.IO.File;

namespace Enmarcha.Backend.Services;

/// <summary>
/// Service for loading shapes and calculating remaining path from a given stop point
/// </summary>
public class ShapeTraversalService
{
    private readonly AppConfiguration _configuration;
    private readonly ILogger<ShapeTraversalService> _logger;
    private readonly ICoordinateTransformation _transformation;

    public ShapeTraversalService(IOptions<AppConfiguration> options, ILogger<ShapeTraversalService> logger)
    {
        _configuration = options.Value;
        _logger = logger;

        // Set up coordinate transformation from EPSG:25829 (meters) to EPSG:4326 (lat/lng)
        var ctFactory = new CoordinateTransformationFactory();
        var csFactory = new CoordinateSystemFactory();

        // EPSG:25829 - ETRS89 / UTM zone 29N
        var source = csFactory.CreateFromWkt(
            "PROJCS[\"ETRS89 / UTM zone 29N\",GEOGCS[\"ETRS89\",DATUM[\"European_Terrestrial_Reference_System_1989\",SPHEROID[\"GRS 1980\",6378137,298.257222101,AUTHORITY[\"EPSG\",\"7019\"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY[\"EPSG\",\"6258\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9122\"]],AUTHORITY[\"EPSG\",\"4258\"]],PROJECTION[\"Transverse_Mercator\"],PARAMETER[\"latitude_of_origin\",0],PARAMETER[\"central_meridian\",-9],PARAMETER[\"scale_factor\",0.9996],PARAMETER[\"false_easting\",500000],PARAMETER[\"false_northing\",0],UNIT[\"metre\",1,AUTHORITY[\"EPSG\",\"9001\"]],AXIS[\"Easting\",EAST],AXIS[\"Northing\",NORTH],AUTHORITY[\"EPSG\",\"25829\"]]");

        // EPSG:4326 - WGS84
        var target = GeographicCoordinateSystem.WGS84;

        _transformation = ctFactory.CreateFromCoordinateSystems(source, target);
    }

    public Shape CreateShapeFromWgs84(List<Position> points)
    {
        var shape = new Shape();
        var inverseTransform = _transformation.MathTransform.Inverse();

        foreach (var point in points)
        {
            var transformed = inverseTransform.Transform(new[] { point.Longitude, point.Latitude });
            shape.Points.Add(new Epsg25829 { X = transformed[0], Y = transformed[1] });
        }
        return shape;
    }

    public Epsg25829 TransformToEpsg25829(double lat, double lon)
    {
        var inverseTransform = _transformation.MathTransform.Inverse();
        var transformed = inverseTransform.Transform(new[] { lon, lat });
        return new Epsg25829 { X = transformed[0], Y = transformed[1] };
    }

    /// <summary>
    /// Calculates the bus position by reverse-traversing the shape from the stop location
    /// </summary>
    /// <param name="shape">The shape points (in EPSG:25829 meters)</param>
    /// <param name="stopLocation">The stop location (in EPSG:25829 meters)</param>
    /// <param name="distanceMeters">Distance in meters from the stop to traverse backwards</param>
    /// <returns>The lat/lng position of the bus and the stop index on the shape</returns>
    public (Position? BusPosition, int StopIndex) GetBusPosition(Shape shape, Epsg25829 stopLocation, int distanceMeters)
    {
        if (shape.Points.Count == 0 || distanceMeters <= 0)
        {
            return (null, -1);
        }

        // Find the closest point on the shape to the stop
        int closestPointIndex = FindClosestPointIndex(shape.Points, stopLocation);

        // Calculate the total distance from the start of the shape to the stop
        double totalDistanceToStop = CalculateTotalDistance(shape.Points.ToArray(), closestPointIndex);

        // If the reported distance exceeds the total distance to the stop, the bus is likely
        // on a previous trip whose shape we don't have. Don't provide position information.
        if (distanceMeters > totalDistanceToStop)
        {
            _logger.LogDebug("Distance {Distance}m exceeds total shape distance to stop {Total}m - bus likely on previous trip", distanceMeters, totalDistanceToStop);
            return (null, closestPointIndex);
        }

        // Traverse backwards from the closest point to find the position at the given distance
        var (busPoint, forwardIndex) = TraverseBackwards(shape.Points.ToArray(), closestPointIndex, distanceMeters);

        if (busPoint == null)
        {
            return (null, closestPointIndex);
        }

        var forwardPoint = shape.Points[forwardIndex];

        // Compute orientation in EPSG:25829 (meters): 0°=North, 90°=East (azimuth)
        var dx = forwardPoint.X - busPoint.X; // Easting difference
        var dy = forwardPoint.Y - busPoint.Y; // Northing difference
        var bearing = Math.Atan2(dx, dy) * 180.0 / Math.PI; // swap for 0° north
        if (bearing < 0) bearing += 360.0;

        // Transform from EPSG:25829 (meters) to EPSG:4326 (lat/lng)
        var pos = TransformToLatLng(busPoint);
        pos.OrientationDegrees = (int)Math.Round(bearing);
        pos.ShapeIndex = forwardIndex;
        return (pos, closestPointIndex);
    }

    /// <summary>
    /// Traverses backwards along the shape from a starting point by the specified distance
    /// </summary>
    private (Epsg25829 point, int forwardIndex) TraverseBackwards(Epsg25829[] shapePoints, int startIndex, double distanceMeters)
    {
        if (startIndex <= 0)
        {
            // Already at the beginning, return the first point
            var forwardIdx = Math.Min(1, shapePoints.Length - 1);
            return (shapePoints[0], forwardIdx);
        }

        double remainingDistance = distanceMeters;
        int currentIndex = startIndex;

        while (currentIndex > 0 && remainingDistance > 0)
        {
            var segmentDistance = CalculateDistance(shapePoints[currentIndex], shapePoints[currentIndex - 1]);

            if (segmentDistance >= remainingDistance)
            {
                // The bus position is somewhere along this segment
                // Interpolate between the two points
                var ratio = remainingDistance / segmentDistance;
                var interpolated = InterpolatePoint(shapePoints[currentIndex], shapePoints[currentIndex - 1], ratio);
                // Forward direction is towards the stop (increasing index direction)
                return (interpolated, currentIndex);
            }

            remainingDistance -= segmentDistance;
            currentIndex--;
        }

        // We've reached the beginning of the shape
        var fwd = Math.Min(1, shapePoints.Length - 1);
        return (shapePoints[0], fwd);
    }

    /// <summary>
    /// Interpolates a point between two points at a given ratio
    /// </summary>
    private Epsg25829 InterpolatePoint(Epsg25829 from, Epsg25829 to, double ratio)
    {
        return new Epsg25829
        {
            X = from.X + (to.X - from.X) * ratio,
            Y = from.Y + (to.Y - from.Y) * ratio
        };
    }

    /// <summary>
    /// Finds the index of the closest point in the shape to the given location
    /// </summary>
    private int FindClosestPointIndex(IEnumerable<Epsg25829> shapePoints, Epsg25829 location)
    {
        var pointsArray = shapePoints.ToArray();
        var minDistance = double.MaxValue;
        var closestIndex = 0;

        for (int i = 0; i < pointsArray.Length; i++)
        {
            var distance = CalculateDistance(pointsArray[i], location);
            if (distance < minDistance)
            {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
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
    private double CalculateTotalDistance(Epsg25829[] shapePoints, int endIndex)
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
    /// Transforms a point from EPSG:25829 (meters) to EPSG:4326 (lat/lng)
    /// </summary>
    private Position TransformToLatLng(Epsg25829 point)
    {
        var transformed = _transformation.MathTransform.Transform(new[] { point.X, point.Y });
        return new Position
        {
            // Round to 6 decimals (~0.1m precision)
            Longitude = Math.Round(transformed[0], 6),
            Latitude = Math.Round(transformed[1], 6)
        };
    }

}
