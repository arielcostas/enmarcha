namespace Enmarcha.Backend.Types;

public class Position
{
    public required double Latitude { get; set; }
    public required double Longitude { get; set; }
    public int? Bearing { get; set; }
    public double? Speed { get; set; }
    public int ShapeIndex { get; set; }
}

public class Epsg25829
{
    public double X { get; set; }
    public double Y { get; set; }
}

public class Shape
{
    public List<Epsg25829> Points { get; set; } = [];
}
