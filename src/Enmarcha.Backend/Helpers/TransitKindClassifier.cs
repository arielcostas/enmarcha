using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Helpers;

public class TransitKindClassifier
{
    public static TransitKind KindByFeed(string feedId)
    {
        return feedId switch
        {
            "vitrasa" or "tussa" or "tranvias" or "shuttle" or "ourense" => TransitKind.Bus,
            "xunta" => TransitKind.Coach,
            "renfe" => TransitKind.Train,
            _ => TransitKind.Unknown
        };
    }

    public static string StringByFeed(string feedId)
    {
        var kind = KindByFeed(feedId);
        return kind switch
        {
            TransitKind.Bus => "bus",
            TransitKind.Coach => "coach",
            TransitKind.Train => "train",
            TransitKind.Unknown => "unknown",
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
        };
    }
}

public enum TransitKind
{
    [JsonStringEnumMemberName("bus")] Bus,
    [JsonStringEnumMemberName("coach")] Coach,
    [JsonStringEnumMemberName("train")] Train,
    [JsonStringEnumMemberName("unknown")] Unknown
}
