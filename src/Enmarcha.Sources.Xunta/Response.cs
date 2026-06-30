using System.Text.Json.Serialization;

namespace Enmarcha.Sources.Xunta;

public class CompanyResponse
{
    [JsonPropertyName("companyZoneId")] public int CompanyZoneId { get; set; }
    [JsonPropertyName("vehiclePositions")] public required VehiclePositions[] VehiclePositions { get; set; }
}

public class VehiclePositions
{
    [JsonPropertyName("trip")] public required Trip Trip { get; set; }
    [JsonPropertyName("position")] public required Position Position { get; set; }
    [JsonPropertyName("vehicle")] public required Vehicle Vehicle { get; set; }
    [JsonPropertyName("occupancyStatus")] public string? OccupancyStatus { get; set; }
}

public class Trip
{
    [JsonPropertyName("startTime")] public required string StartTime { get; set; }
    [JsonPropertyName("directionId")] public int DirectionId { get; set; }
    [JsonPropertyName("routeShortName")] public string? RouteShortName { get; set; }
}

public class Position
{
    [JsonPropertyName("latitude")] public double Latitude { get; set; }
    [JsonPropertyName("longitude")] public double Longitude { get; set; }
    [JsonPropertyName("bearing")] public double Bearing { get; set; }
    [JsonPropertyName("speed")] public double Speed { get; set; }
}

public class Vehicle
{
    [JsonPropertyName("id")] public required string Id { get; set; }
    [JsonPropertyName("label")] public required string Label { get; set; }
    [JsonPropertyName("licensePlate")] public required string LicensePlate { get; set; }
}
