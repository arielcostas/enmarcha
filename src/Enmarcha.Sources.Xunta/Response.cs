using System.Text.Json.Serialization;

namespace Enmarcha.Sources.Xunta;

public class CompanyResponse
{
    public string requestDate { get; set; }
    public object requestIp { get; set; }
    public string pluginId { get; set; }
    public string providerId { get; set; }
    public int companyZoneId { get; set; }
    public string zoneName { get; set; }
    public object lat { get; set; }
    public object lon { get; set; }
    public string lowerLeftLatLon { get; set; }
    public string upperRightLatLon { get; set; }
    public string resourceImageId { get; set; }
    public object resourceType { get; set; }
    public VehiclePositions[] vehiclePositions { get; set; }
    public string validUntil { get; set; }
    public string lastModified { get; set; }
    public object statusCode { get; set; }
    public string etag { get; set; }
}

public class VehiclePositions
{
    public Trip trip { get; set; }
    public Position position { get; set; }
    public int timestamp { get; set; }
    public string stopId { get; set; }
    public Vehicle vehicle { get; set; }
    public string occupancyStatus { get; set; }
    public Segments[] segments { get; set; }
    public string gpsQuality { get; set; }
}

public class Trip
{
    public string tripId { get; set; }
    public string startTime { get; set; }
    public string startDate { get; set; }
    public string scheduleRelationship { get; set; }
    public string routeId { get; set; }
    public int directionId { get; set; }
    public string routeShortName { get; set; }
    public string routeColor { get; set; }
    public string routeTextColor { get; set; }
}

public class Position
{
    public double latitude { get; set; }
    public double longitude { get; set; }
    public double bearing { get; set; }
    public double speed { get; set; }
}

public class Vehicle
{
    public string id { get; set; }
    public string label { get; set; }
    public string licensePlate { get; set; }
}

public class Segments
{
    public int i { get; set; }
    public S s { get; set; }
    public double len { get; set; }
    public double b { get; set; }
    public int maxt { get; set; }
    public double v { get; set; }
}

public class S
{
    public double x { get; set; }
    public double y { get; set; }
}


